import type {
  PersonalBlockV1,
  PersonalEditorialFamily,
  PersonalEditorialLayoutId,
} from "./types"
import { isTrueHeroCandidate } from "./weights"
import { groupCompatibilityScore, isNeutralGrouping } from "./compatibility"

/**
 * Deterministic packing layout from the block mix.
 * Does not invent narrative links between blocks.
 * HERO only when the lone block truly merits a full page.
 */
export function pickPersonalEditorialLayout(
  blocks: PersonalBlockV1[],
): PersonalEditorialLayoutId {
  const photos = blocks.filter((b) => b.type === "PHOTO_MEMORY")
  const memories = blocks.filter((b) => b.type === "MEMORY")

  if (photos.length === 1 && memories.length === 2) return "PHOTO_PLUS_TWO_SNIPPETS"
  if (photos.length === 1 && memories.length === 1) return "PHOTO_PLUS_MEMORY"
  if (photos.length === 2 && memories.length === 0) return "TWO_PHOTOS"
  if (photos.length === 0 && memories.length === 2) return "TWO_MEMORIES"
  if (photos.length === 0 && memories.length === 3) return "THREE_SNIPPETS"
  if (photos.length === 2 && memories.length === 1) return "PHOTO_PLUS_TWO_SNIPPETS"

  if (photos.length === 1 && memories.length === 0) {
    return isTrueHeroCandidate(photos[0]!) ? "HERO_PHOTO_MEMORY" : "SINGLE_PHOTO_MEMORY"
  }
  if (photos.length === 0 && memories.length === 1) {
    return isTrueHeroCandidate(memories[0]!) ? "HERO_MEMORY" : "SINGLE_MEMORY"
  }
  if (memories.length >= 2) return memories.length >= 3 ? "THREE_SNIPPETS" : "TWO_MEMORIES"
  return "SINGLE_MEMORY"
}

export function isHeroLayout(layoutId: PersonalEditorialLayoutId): boolean {
  return layoutId === "HERO_MEMORY" || layoutId === "HERO_PHOTO_MEMORY"
}

/**
 * Map packing shape → editorial visual family.
 * STORY_STRIP only when semantic coherence exists.
 */
export function pickEditorialFamily(
  blocks: PersonalBlockV1[],
  layoutId: PersonalEditorialLayoutId,
): PersonalEditorialFamily {
  if (isHeroLayout(layoutId)) return "HERO"
  if (layoutId === "SINGLE_MEMORY" || layoutId === "SINGLE_PHOTO_MEMORY") return "SINGLE"

  const photos = blocks.filter((b) => b.type === "PHOTO_MEMORY").length
  const coherent = !isNeutralGrouping(blocks) && groupCompatibilityScore(blocks) >= 0.55

  if (
    layoutId === "PHOTO_PLUS_TWO_SNIPPETS" ||
    layoutId === "PHOTO_PLUS_MEMORY" ||
    (photos === 1 && blocks.length >= 2)
  ) {
    return "FEATURE_NOTES"
  }

  if (
    coherent &&
    (layoutId === "TWO_MEMORIES" || layoutId === "THREE_SNIPPETS")
  ) {
    return "STORY_STRIP"
  }

  return "MOSAIC_EDITORIAL"
}

/** Layout preference rank (lower = better product priority). */
export function layoutPreferenceRank(layoutId: PersonalEditorialLayoutId): number {
  switch (layoutId) {
    case "PHOTO_PLUS_TWO_SNIPPETS":
      return 1
    case "PHOTO_PLUS_MEMORY":
      return 2
    case "TWO_PHOTOS":
      return 3
    case "TWO_MEMORIES":
      return 4
    case "THREE_SNIPPETS":
      return 5
    case "SINGLE_MEMORY":
    case "SINGLE_PHOTO_MEMORY":
      return 8
    case "HERO_MEMORY":
    case "HERO_PHOTO_MEMORY":
      return 9
    default:
      return 7
  }
}
