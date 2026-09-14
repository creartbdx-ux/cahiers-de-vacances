import type { VisualRole } from "@/lib/book-blueprint/types"
import { isHeroLayout, pickPersonalEditorialLayout } from "./layouts"
import type { PersonalBlockV1, PersonalEditorialPageV1 } from "./types"
import {
  PERSONAL_PAGE_CAPACITY,
  PERSONAL_PAGE_MAX_BLOCKS,
  PERSONAL_PAGE_MAX_PHOTOS,
} from "./types"
import {
  blockWeight,
  photoCount,
  prefersDedicatedPage,
  totalWeight,
} from "./weights"

const VISUAL_ROLES: VisualRole[] = ["LIGHT", "SECONDARY", "ACCENT", "NEUTRAL"]

function blockId(b: PersonalBlockV1): string {
  return b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId
}

function canAdd(current: PersonalBlockV1[], candidate: PersonalBlockV1): boolean {
  if (current.length >= PERSONAL_PAGE_MAX_BLOCKS) return false
  if (
    candidate.type === "PHOTO_MEMORY" &&
    photoCount(current) >= PERSONAL_PAGE_MAX_PHOTOS
  ) {
    return false
  }
  if (totalWeight(current) + blockWeight(candidate) > PERSONAL_PAGE_CAPACITY) {
    return false
  }
  // RICH photo always alone
  if (candidate.type === "PHOTO_MEMORY" && candidate.density === "RICH") {
    return current.length === 0
  }
  if (current.some((b) => b.type === "PHOTO_MEMORY" && b.density === "RICH")) {
    return false
  }
  // RICH memory: at most one tiny companion (weight 1)
  if (candidate.type === "MEMORY" && candidate.density === "RICH") {
    return current.length === 0 || totalWeight(current) <= 1
  }
  if (current.some((b) => b.type === "MEMORY" && b.density === "RICH")) {
    return blockWeight(candidate) <= 1 && current.length < 2
  }
  return true
}

function stableSort(blocks: PersonalBlockV1[], seed: string): PersonalBlockV1[] {
  // Weight desc, then id asc — seed only used for role hashing elsewhere
  void seed
  return [...blocks].sort((a, b) => {
    const dw = blockWeight(b) - blockWeight(a)
    if (dw !== 0) return dw
    return blockId(a).localeCompare(blockId(b))
  })
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function makePage(
  blocks: PersonalBlockV1[],
  seed: string,
  index: number,
): PersonalEditorialPageV1 {
  const layoutId = pickPersonalEditorialLayout(blocks)
  const roleIndex =
    Math.abs(hash(`${seed}:page:${index}:${layoutId}`)) % VISUAL_ROLES.length
  return {
    pageKey: `pep:${seed}:${index}`,
    layoutId,
    blocks,
    visualRole: VISUAL_ROLES[roleIndex]!,
    weight: totalWeight(blocks),
    isHero: isHeroLayout(layoutId),
  }
}

/**
 * Pack personal editorial blocks into composite pages.
 * Deterministic with seed. No IA. Does not invent content or fuse narratives.
 *
 * fullPageRecommended=false ⇒ never forces a dedicated page (packed when possible).
 * fullPageRecommended=true + high weight ⇒ may get a HERO page (not mandatory if it packs).
 */
export function composePersonalEditorialPages(
  blocks: PersonalBlockV1[],
  seed: string,
): PersonalEditorialPageV1[] {
  if (!blocks.length) return []

  const dedicated: PersonalBlockV1[] = []
  const packable: PersonalBlockV1[] = []

  for (const b of blocks) {
    // Prefer dedicated only when strongly recommended — still not mandatory if
    // we later allow packing; for V1 we emit HERO for these to honour richness.
    if (prefersDedicatedPage(b)) dedicated.push(b)
    else packable.push(b)
  }

  const pages: PersonalEditorialPageV1[] = []
  let pageIndex = 0
  let lastWasHero = false

  const remaining = stableSort(packable, seed)
  const heroQueue = stableSort(dedicated, `${seed}:hero`)

  const emitHero = (block: PersonalBlockV1) => {
    // Insert a composite first if consecutive heroes and packable leftovers exist
    if (lastWasHero && remaining.length > 0) {
      pages.push(packOnePage(remaining, seed, pageIndex++))
      lastWasHero = pages[pages.length - 1]!.isHero
    }
    pages.push(makePage([block], seed, pageIndex++))
    lastWasHero = true
  }

  // Alternate: fill composites, occasionally place a hero for rhythm
  while (remaining.length > 0 || heroQueue.length > 0) {
    const shouldPlaceHero =
      heroQueue.length > 0 &&
      (remaining.length === 0 || (!lastWasHero && pages.length > 0 && pages.length % 2 === 1))

    if (shouldPlaceHero && heroQueue.length) {
      emitHero(heroQueue.shift()!)
      continue
    }

    if (remaining.length > 0) {
      pages.push(packOnePage(remaining, seed, pageIndex++))
      lastWasHero = pages[pages.length - 1]!.isHero
      continue
    }

    if (heroQueue.length) {
      emitHero(heroQueue.shift()!)
    }
  }

  return pages
}

function packOnePage(
  remaining: PersonalBlockV1[],
  seed: string,
  index: number,
): PersonalEditorialPageV1 {
  const pageBlocks: PersonalBlockV1[] = []
  const first = remaining.shift()!
  pageBlocks.push(first)

  let progressed = true
  while (progressed && pageBlocks.length < PERSONAL_PAGE_MAX_BLOCKS) {
    progressed = false
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i]!
      if (canAdd(pageBlocks, cand)) {
        pageBlocks.push(cand)
        remaining.splice(i, 1)
        progressed = true
        break
      }
    }
  }

  // Avoid leaving a near-empty page when capacity remains and items fit poorly —
  // already handled by greedy canAdd.

  void PERSONAL_PAGE_CAPACITY
  return makePage(pageBlocks, seed, index)
}

export function estimatePersonalEditorialPageCount(
  blocks: PersonalBlockV1[],
  seed: string,
): number {
  return composePersonalEditorialPages(blocks, seed).length
}

export function pageProvenance(page: PersonalEditorialPageV1): {
  sourceMemoryIds: string[]
  sourcePhotoIds: string[]
} {
  const sourceMemoryIds: string[] = []
  const sourcePhotoIds: string[] = []
  for (const b of page.blocks) {
    if (b.type === "MEMORY") sourceMemoryIds.push(b.sourceMemoryId)
    else sourcePhotoIds.push(b.sourcePhotoId)
  }
  return { sourceMemoryIds, sourcePhotoIds }
}
