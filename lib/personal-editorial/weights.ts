import type { MemoryDensity } from "@/lib/memory-pages/types"
import { wordCount } from "@/lib/memory-pages/density"
import type { PersonalBlockV1 } from "./types"
import { PERSONAL_PAGE_CAPACITY } from "./types"

/** Weight units for packing (capacity ≈ 4). */
export function blockWeight(block: PersonalBlockV1): number {
  if (block.type === "MEMORY") {
    return memoryWeight(block.density)
  }
  return photoWeight(block.density)
}

/**
 * MEMORY packing weights from text density:
 * SHORT → easily combinable
 * MEDIUM → pairs with light photo / short companion
 * RICH → substantial page share (not automatic HERO)
 */
export function memoryWeight(density: MemoryDensity): number {
  if (density === "SHORT") return 1
  if (density === "MEDIUM") return 2
  return 3
}

/**
 * PHOTO packing: base visual weight ≈ 2 for short/medium text.
 * RICH text (+ photo) fills a page alone — visualWeight separate from textDensity.
 */
export function photoWeight(density: MemoryDensity): number {
  if (density === "RICH") return 4
  // SHORT and MEDIUM share base visual weight so two photos / photo+shorts can pack.
  return 2
}

export function totalWeight(blocks: PersonalBlockV1[]): number {
  return blocks.reduce((sum, b) => sum + blockWeight(b), 0)
}

export function photoCount(blocks: PersonalBlockV1[]): number {
  return blocks.filter((b) => b.type === "PHOTO_MEMORY").length
}

export function pageFillScore(blocks: PersonalBlockV1[]): number {
  return Math.min(1, totalWeight(blocks) / PERSONAL_PAGE_CAPACITY)
}

/** Displayable editorial word count (body / caption+anecdote) — debug & HERO checks. */
export function blockTextWordCount(block: PersonalBlockV1): number {
  if (block.type === "MEMORY") {
    return wordCount(block.originalText || block.displayText || block.body)
  }
  const fromMeta = wordCount([block.caption, block.anecdote].filter(Boolean).join(" "))
  if (fromMeta > 0) return fromMeta
  return wordCount(block.originalText || block.displayText || block.body)
}

/**
 * True HERO candidate — rare.
 * Requires RICH density AND real body volume.
 * SHORT / MEDIUM never qualify; title/place alone never qualify.
 */
export function isTrueHeroCandidate(block: PersonalBlockV1): boolean {
  if (block.density !== "RICH") return false
  if (block.type === "MEMORY") {
    return blockTextWordCount(block) >= 70
  }
  if (block.weakSource) return false
  return blockTextWordCount(block) >= 55
}

/**
 * @deprecated Use isTrueHeroCandidate. Kept for callers/tests that meant "strong block".
 * Does NOT mean the block must have its own page.
 */
export function prefersDedicatedPage(block: PersonalBlockV1): boolean {
  return isTrueHeroCandidate(block)
}

export function heroReasonForBlock(block: PersonalBlockV1): string | null {
  if (!isTrueHeroCandidate(block)) return null
  return "RICH + volume suffisant"
}

/** Alias — packing fill only (not visual). */
export function packingFillScore(blocks: PersonalBlockV1[]): number {
  return pageFillScore(blocks)
}
