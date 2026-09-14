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
  if (density === "SHORT") return 2
  if (density === "MEDIUM") return 3
  return 4
}

export function totalWeight(blocks: PersonalBlockV1[]): number {
  return blocks.reduce((sum, b) => sum + blockWeight(b), 0)
}

export function photoCount(blocks: PersonalBlockV1[]): number {
  return blocks.filter((b) => b.type === "PHOTO_MEMORY").length
}

/**
 * Prefer a dedicated page when the block is strong enough to fill it,
 * and marked fullPageRecommended. SHORT never forces a hero page.
 */
export function prefersDedicatedPage(block: PersonalBlockV1): boolean {
  if (!block.fullPageRecommended) return false
  return blockWeight(block) >= PERSONAL_PAGE_CAPACITY - 1
}
