import type { PersonalBlockV1, PersonalEditorialLayoutId } from "./types"

/**
 * Deterministic layout pick from the block mix.
 * Does not invent narrative links between blocks.
 */
export function pickPersonalEditorialLayout(
  blocks: PersonalBlockV1[],
): PersonalEditorialLayoutId {
  const photos = blocks.filter((b) => b.type === "PHOTO_MEMORY")
  const memories = blocks.filter((b) => b.type === "MEMORY")

  if (blocks.length === 1 && memories.length === 1) return "HERO_MEMORY"
  if (blocks.length === 1 && photos.length === 1) return "HERO_PHOTO_MEMORY"

  if (photos.length === 1 && memories.length === 1) return "PHOTO_PLUS_MEMORY"
  if (photos.length === 2 && memories.length === 0) return "TWO_PHOTOS"
  if (photos.length === 0 && memories.length === 2) return "TWO_MEMORIES"
  if (photos.length === 0 && memories.length === 3) return "THREE_SNIPPETS"
  if (photos.length === 1 && memories.length === 2) return "PHOTO_PLUS_TWO_SNIPPETS"

  // Fallbacks for edge packs (still within max 3 / max 2 photos)
  if (photos.length === 2 && memories.length === 1) return "PHOTO_PLUS_TWO_SNIPPETS"
  if (photos.length === 1 && memories.length === 0) return "HERO_PHOTO_MEMORY"
  if (memories.length >= 2) return memories.length >= 3 ? "THREE_SNIPPETS" : "TWO_MEMORIES"
  return "HERO_MEMORY"
}

export function isHeroLayout(layoutId: PersonalEditorialLayoutId): boolean {
  return layoutId === "HERO_MEMORY" || layoutId === "HERO_PHOTO_MEMORY"
}
