/**
 * Visual composition for collage pages — does NOT change which photos are planned.
 * Picks variant, hero, order, optional page title from orientations + seed.
 */

import type { PhotoCollageLayoutId, PhotoPageItem } from "./types"
import {
  classifyPhotoOrientation,
  type PhotoOrientation,
} from "./orientation"

export type Collage3Variant = "HERO_LEFT" | "HERO_TOP" | "HERO_RIGHT"
export type Collage2Variant = "SIDE_BY_SIDE" | "STACKED"
export type Collage4Variant = "GRID_2X2" | "HERO_PLUS_THREE"

export type CollageVariant = Collage3Variant | Collage2Variant | Collage4Variant

export interface EnrichedPhotoItem extends PhotoPageItem {
  orientation: PhotoOrientation
  aspectRatio: number | null
}

export interface CollageComposition {
  layoutId: PhotoCollageLayoutId
  variant: CollageVariant
  heroPhotoId: string | null
  photos: EnrichedPhotoItem[]
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

export function enrichPhotoOrientation(
  photo: PhotoPageItem,
  aspectRatio?: number | null,
): EnrichedPhotoItem {
  const ratio =
    aspectRatio ??
    (photo as PhotoPageItem & { aspectRatio?: number }).aspectRatio ??
    null
  return {
    ...photo,
    aspectRatio: ratio,
    orientation: classifyPhotoOrientation(ratio),
  }
}

function scoreAsHero(
  photo: EnrichedPhotoItem,
  variant: Collage3Variant,
  seed: string,
): number {
  let score = (hash(`${seed}:hero:${photo.sourcePhotoId}`) % 20) / 20
  if (variant === "HERO_TOP") {
    // Wide top slot — landscape preferred
    if (photo.orientation === "LANDSCAPE") score += 3
    if (photo.orientation === "SQUARE") score += 1.5
    if (photo.orientation === "PORTRAIT") score -= 1.5
  } else {
    // Tall side slot — portrait preferred, landscape still ok
    if (photo.orientation === "PORTRAIT") score += 3
    if (photo.orientation === "SQUARE") score += 1.2
    if (photo.orientation === "LANDSCAPE") score += 0.8
  }
  return score
}

function pickCollage3Variant(
  photos: EnrichedPhotoItem[],
  seed: string,
): Collage3Variant {
  const landscapes = photos.filter((p) => p.orientation === "LANDSCAPE").length
  const portraits = photos.filter((p) => p.orientation === "PORTRAIT").length
  const h = hash(`${seed}:c3-variant`) % 3

  // Strong landscape majority → prefer top hero
  if (landscapes >= 2 && portraits <= 1) {
    return h === 0 ? "HERO_LEFT" : "HERO_TOP"
  }
  // Strong portrait presence → side hero
  if (portraits >= 2) {
    return h === 0 ? "HERO_RIGHT" : "HERO_LEFT"
  }
  // Mixed / unknown
  if (h === 0) return "HERO_LEFT"
  if (h === 1) return "HERO_TOP"
  return "HERO_RIGHT"
}

function orderWithHero(
  photos: EnrichedPhotoItem[],
  heroId: string,
): EnrichedPhotoItem[] {
  const hero = photos.find((p) => p.sourcePhotoId === heroId)!
  const rest = photos.filter((p) => p.sourcePhotoId !== heroId)
  return [hero, ...rest]
}

const PAGE_TITLES = [
  "Quelques photos",
  "Quelques souvenirs en images",
  "En images",
]

function pickPageTitle(
  layoutId: PhotoCollageLayoutId,
  seed: string,
  show: boolean,
): string | null {
  if (!show) return null
  return PAGE_TITLES[hash(`${seed}:title:${layoutId}`) % PAGE_TITLES.length]!
}

/**
 * Resolve visual composition for a collage page.
 * Preserves every sourcePhotoId; only reorders for display.
 */
export function resolveCollageComposition(input: {
  layoutId: PhotoCollageLayoutId
  photos: PhotoPageItem[]
  seed: string
  /** Optional aspect ratios keyed by sourcePhotoId. */
  aspectRatios?: Record<string, number>
}): CollageComposition {
  const enriched = input.photos.map((p) =>
    enrichPhotoOrientation(p, input.aspectRatios?.[p.sourcePhotoId]),
  )

  if (input.layoutId === "COLLAGE_2" || enriched.length <= 2) {
    const photos = enriched.slice(0, 2)
    const bothPortrait = photos.every((p) => p.orientation === "PORTRAIT")
    const variant: Collage2Variant = bothPortrait ? "STACKED" : "SIDE_BY_SIDE"
    const showPageTitle = hash(`${input.seed}:show-title`) % 5 !== 0
    return {
      layoutId: "COLLAGE_2",
      variant,
      heroPhotoId: null,
      photos,
      showPageTitle,
      pageTitle: pickPageTitle("COLLAGE_2", input.seed, showPageTitle),
    }
  }

  if (input.layoutId === "COLLAGE_4" || enriched.length >= 4) {
    const photos = enriched.slice(0, 4)
    const landscapes = photos.filter((p) => p.orientation === "LANDSCAPE")
    const useHero =
      landscapes.length === 1 ||
      (landscapes.length >= 1 && hash(`${input.seed}:c4`) % 3 === 0)
    if (useHero && landscapes[0]) {
      const ordered = orderWithHero(photos, landscapes[0].sourcePhotoId)
      const showPageTitle = hash(`${input.seed}:show-title-4`) % 4 !== 0
      return {
        layoutId: "COLLAGE_4",
        variant: "HERO_PLUS_THREE",
        heroPhotoId: landscapes[0].sourcePhotoId,
        photos: ordered,
        showPageTitle,
        pageTitle: pickPageTitle("COLLAGE_4", input.seed, showPageTitle),
      }
    }
    const showPageTitle = hash(`${input.seed}:show-title-4b`) % 3 === 0
    return {
      layoutId: "COLLAGE_4",
      variant: "GRID_2X2",
      heroPhotoId: null,
      photos,
      showPageTitle,
      pageTitle: pickPageTitle("COLLAGE_4", input.seed, showPageTitle),
    }
  }

  // COLLAGE_3
  const photos = enriched.slice(0, 3)
  const variant = pickCollage3Variant(photos, input.seed)
  let best = photos[0]!
  let bestScore = -Infinity
  for (const p of photos) {
    const s = scoreAsHero(p, variant, input.seed)
    if (s > bestScore) {
      bestScore = s
      best = p
    }
  }
  const ordered = orderWithHero(photos, best.sourcePhotoId)
  const showPageTitle = hash(`${input.seed}:show-title-3`) % 5 > 0
  return {
    layoutId: "COLLAGE_3",
    variant,
    heroPhotoId: best.sourcePhotoId,
    photos: ordered,
    showPageTitle,
    pageTitle: pickPageTitle("COLLAGE_3", input.seed, showPageTitle),
  }
}
