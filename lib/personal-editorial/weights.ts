import type { MemoryDensity } from "@/lib/memory-pages/types"
import type { PersonalBlockV1 } from "./types"
import { PERSONAL_PAGE_CAPACITY } from "./types"

/** Weight units for packing (capacity ≈ 4). */
export function blockWeight(block: PersonalBlockV1): number {
  if (block.type === "MEMORY") {
    return memoryWeight(block.density)
  }
  return photoWeight(block.density)
}

export function memoryWeight(density: MemoryDensity): number {
  if (density === "SHORT") return 1
  if (density === "MEDIUM") return 2
  return 3
}

export function photoWeight(density: MemoryDensity): number {
  // SHORT/MEDIUM share packing weight so two photos can share a page;
  // density still drives layout/typography. RICH fills a page alone.
  if (density === "RICH") return 4
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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * True HERO candidate — rare.
 * fullPageRecommended alone never forces a dedicated page.
 * SHORT / MEDIUM almost never qualify.
 */
export function isTrueHeroCandidate(block: PersonalBlockV1): boolean {
  if (block.density !== "RICH") return false
  if (block.type === "MEMORY") {
    return wordCount(block.body) >= 45
  }
  // Photo: RICH density + enough editorial text (not vision)
  if (block.weakSource) return false
  return wordCount(block.body) >= 30 || Boolean(block.caption?.trim() && block.anecdote?.trim())
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
  if (block.type === "MEMORY") {
    return "Raison HERO : souvenir RICH + texte substantiel"
  }
  return "Raison HERO : photo RICH + texte RICH"
}
