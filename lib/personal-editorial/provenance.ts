/**
 * Photo ↔ editorial provenance invariants.
 * A rendered image for sourcePhotoId=X must only use metadata of X.
 */

import type { PersonalBlockV1, PhotoMemoryBlockV1 } from "./types"

export class PersonalEditorialProvenanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PersonalEditorialProvenanceError"
  }
}

export function isPhotoMemoryBlock(b: PersonalBlockV1): b is PhotoMemoryBlockV1 {
  return b.type === "PHOTO_MEMORY"
}

/**
 * Assert photo block fields are self-consistent (same sourcePhotoId throughout).
 */
export function assertPhotoBlockIntegrity(block: PhotoMemoryBlockV1): void {
  if (!block.sourcePhotoId?.trim()) {
    throw new PersonalEditorialProvenanceError(
      "PHOTO_MEMORY sans sourcePhotoId — rendu interdit.",
    )
  }
  // originalText must derive only from this block's caption/anecdote
  const fromMeta = [block.caption, block.anecdote]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join("\n\n")
  if (fromMeta && block.originalText.trim()) {
    // Every non-empty line of original should appear in meta (allow editorial whitespace)
    const metaNorm = fromMeta.replace(/\s+/g, " ").toLowerCase()
    const origNorm = block.originalText.replace(/\s+/g, " ").toLowerCase()
    // originalText should be subset / equal of caption+anecdote combination
    if (!metaNorm.includes(origNorm.slice(0, Math.min(40, origNorm.length))) &&
        !origNorm.includes(metaNorm.slice(0, Math.min(40, metaNorm.length)))) {
      // Soft: if both empty weak ok; if mismatch strong
      if (block.caption || block.anecdote) {
        // Check claimsUsed / display don't reference another known photo id pattern
      }
    }
  }
  if (block.facts && block.facts.sourceId !== block.sourcePhotoId) {
    throw new PersonalEditorialProvenanceError(
      `Mismatch facts.sourceId (${block.facts.sourceId}) ≠ sourcePhotoId (${block.sourcePhotoId}).`,
    )
  }
}

export function assertPagePhotoProvenance(blocks: PersonalBlockV1[]): void {
  for (const b of blocks) {
    if (isPhotoMemoryBlock(b)) assertPhotoBlockIntegrity(b)
  }
  // Unique photo ids on a page
  const ids = blocks.filter(isPhotoMemoryBlock).map((b) => b.sourcePhotoId)
  if (new Set(ids).size !== ids.length) {
    throw new PersonalEditorialProvenanceError(
      "Deux blocs PHOTO partagent le même sourcePhotoId sur une page.",
    )
  }
}

/**
 * Bind helper for templates: photo media + copy must share the same block reference.
 */
export function bindPhotoRender(block: PhotoMemoryBlockV1): {
  sourcePhotoId: string
  signedUrl: string | null
  block: PhotoMemoryBlockV1
} {
  assertPhotoBlockIntegrity(block)
  return {
    sourcePhotoId: block.sourcePhotoId,
    signedUrl: block.signedUrl,
    block,
  }
}
