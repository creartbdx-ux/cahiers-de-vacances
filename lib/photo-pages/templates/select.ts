/**
 * Select a structural photo template and assign photos to slots.
 * No free-form geometry — templates own all positions.
 */

import {
  classifyPhotoOrientation,
  type PhotoOrientation,
} from "../orientation"
import type { PhotoPageItem, PhotoPageKind } from "../types"
import { listPhotoTemplatesForCount, getPhotoPageTemplate } from "./registry"
import type {
  PhotoPageTemplateDefinition,
  PhotoSlotDefinition,
  PhotoTemplateId,
} from "./types"

export interface EnrichedPhotoForTemplate extends PhotoPageItem {
  orientation: PhotoOrientation
  aspectRatio: number | null
}

export interface PhotoSlotAssignment {
  slotId: string
  sourcePhotoId: string
  role: PhotoSlotDefinition["role"]
}

export interface PhotoTemplateSelection {
  templateId: PhotoTemplateId
  template: PhotoPageTemplateDefinition
  assignments: PhotoSlotAssignment[]
  /** Photos in slot order. */
  orderedPhotos: EnrichedPhotoForTemplate[]
  showPageTitle: boolean
  pageTitle: string | null
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function enrichForTemplate(
  photo: PhotoPageItem,
  aspectRatio?: number | null,
): EnrichedPhotoForTemplate {
  const ratio = aspectRatio ?? photo.aspectRatio ?? null
  return {
    ...photo,
    aspectRatio: ratio,
    orientation: classifyPhotoOrientation(ratio),
  }
}

function orientationCounts(photos: EnrichedPhotoForTemplate[]): {
  landscapes: number
  portraits: number
  squares: number
} {
  return {
    landscapes: photos.filter((p) => p.orientation === "LANDSCAPE").length,
    portraits: photos.filter((p) => p.orientation === "PORTRAIT").length,
    squares: photos.filter((p) => p.orientation === "SQUARE").length,
  }
}

function scoreTemplate(
  template: PhotoPageTemplateDefinition,
  photos: EnrichedPhotoForTemplate[],
  seed: string,
): number {
  if (template.photoCount !== photos.length) return -Infinity
  const counts = orientationCounts(photos)
  let bestPattern = 0
  for (const pat of template.supportedOrientationPatterns) {
    const hasAny =
      pat.landscapes != null || pat.portraits != null || pat.squares != null
    if (!hasAny) {
      bestPattern = Math.max(bestPattern, pat.weight)
      continue
    }
    let dist = 0
    let compared = 0
    if (pat.landscapes != null) {
      dist += Math.abs(pat.landscapes - counts.landscapes)
      compared++
    }
    if (pat.portraits != null) {
      dist += Math.abs(pat.portraits - counts.portraits)
      compared++
    }
    if (pat.squares != null) {
      dist += Math.abs(pat.squares - counts.squares)
      compared++
    }
    if (dist === 0) bestPattern = Math.max(bestPattern, pat.weight)
    else if (dist === 1) bestPattern = Math.max(bestPattern, pat.weight * 0.5)
    else if (compared > 0 && dist === 2) bestPattern = Math.max(bestPattern, pat.weight * 0.2)
  }

  // Heuristic boosts (print-friendly defaults)
  if (template.id === "PHOTO_3_B" && counts.landscapes >= 2) bestPattern += 4
  if (
    (template.id === "PHOTO_3_A" || template.id === "PHOTO_3_C") &&
    counts.portraits >= 2
  ) {
    bestPattern += 3
  }
  if (template.id === "PHOTO_2_A" && counts.portraits + counts.squares >= 2) {
    bestPattern += 3
  }
  if (template.id === "PHOTO_2_B" && counts.landscapes >= 2) bestPattern += 4
  if (template.id === "PHOTO_4_B" && counts.landscapes === 1) bestPattern += 2

  const jitter = (hash(`${seed}:tpl:${template.id}`) % 100) / 100
  return bestPattern * 10 + jitter
}

function scorePhotoForSlot(
  photo: EnrichedPhotoForTemplate,
  slot: PhotoSlotDefinition,
  seed: string,
): number {
  const pref = slot.preferredOrientations.indexOf(photo.orientation)
  let score = pref === -1 ? 0 : (slot.preferredOrientations.length - pref) * 3
  score += (hash(`${seed}:slot:${slot.id}:${photo.sourcePhotoId}`) % 20) / 20
  if (slot.role === "hero") {
    if (photo.orientation === slot.preferredOrientations[0]) score += 2
  }
  return score
}

/**
 * Assign each photo to exactly one slot (greedy by role: hero first).
 */
export function assignPhotosToSlots(
  template: PhotoPageTemplateDefinition,
  photos: EnrichedPhotoForTemplate[],
  seed: string,
): PhotoSlotAssignment[] {
  if (photos.length !== template.slots.length) {
    throw new Error(
      `Template ${template.id} expects ${template.slots.length} photos, got ${photos.length}`,
    )
  }
  const remaining = [...photos]
  const assignments: PhotoSlotAssignment[] = []
  const slotsOrdered = [
    ...template.slots.filter((s) => s.role === "hero"),
    ...template.slots.filter((s) => s.role !== "hero"),
  ]

  for (const slot of slotsOrdered) {
    let bestIdx = 0
    let bestScore = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const s = scorePhotoForSlot(remaining[i]!, slot, seed)
      if (s > bestScore) {
        bestScore = s
        bestIdx = i
      }
    }
    const photo = remaining.splice(bestIdx, 1)[0]!
    assignments.push({
      slotId: slot.id,
      sourcePhotoId: photo.sourcePhotoId,
      role: slot.role,
    })
  }

  // Return in template slot order
  return template.slots.map((slot) => {
    const a = assignments.find((x) => x.slotId === slot.id)!
    return a
  })
}

const PAGE_TITLES = [
  "Quelques photos",
  "Quelques souvenirs en images",
  "En images",
]

/**
 * Select the best compatible template and bind photos to slots.
 */
export function selectPhotoTemplate(input: {
  photos: PhotoPageItem[]
  pageType: PhotoPageKind
  seed: string
  aspectRatios?: Record<string, number>
  /** Lab-only override — must be compatible (same count + pageType). */
  forceTemplateId?: PhotoTemplateId | null
}): PhotoTemplateSelection {
  const enriched = input.photos.map((p) =>
    enrichForTemplate(p, input.aspectRatios?.[p.sourcePhotoId]),
  )
  const n = enriched.length
  const candidates = listPhotoTemplatesForCount(input.pageType, n)
  if (!candidates.length) {
    throw new Error(
      `Aucun template photo pour ${input.pageType} × ${n} photo(s)`,
    )
  }

  let template: PhotoPageTemplateDefinition | undefined
  if (input.forceTemplateId) {
    const forced = getPhotoPageTemplate(input.forceTemplateId)
    if (
      forced &&
      forced.pageType === input.pageType &&
      forced.photoCount === n
    ) {
      template = forced
    }
  }
  if (!template) {
    let best = candidates[0]!
    let bestScore = -Infinity
    for (const c of candidates) {
      const s = scoreTemplate(c, enriched, input.seed)
      if (s > bestScore) {
        bestScore = s
        best = c
      }
    }
    template = best
  }

  const assignments = assignPhotosToSlots(template, enriched, input.seed)
  const byId = new Map(enriched.map((p) => [p.sourcePhotoId, p]))
  const orderedPhotos = assignments.map((a) => byId.get(a.sourcePhotoId)!)

  const showPageTitle =
    Boolean(template.pageTitleSlot) &&
    hash(`${input.seed}:title:${template.id}`) % 5 !== 0
  const pageTitle = showPageTitle
    ? PAGE_TITLES[hash(`${input.seed}:title-pick:${template.id}`) % PAGE_TITLES.length]!
    : null

  return {
    templateId: template.id,
    template,
    assignments,
    orderedPhotos,
    showPageTitle,
    pageTitle,
  }
}

/** Compatible templates for Lab comparison (same count + page type). */
export function listCompatiblePhotoTemplates(
  pageType: PhotoPageKind,
  photoCount: number,
): PhotoPageTemplateDefinition[] {
  return listPhotoTemplatesForCount(pageType, photoCount)
}
