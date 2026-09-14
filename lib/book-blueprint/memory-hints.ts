import type { BookProfileV1 } from "@/lib/questionnaire/types"
import {
  classifyMemoryDensity,
  recommendFullMemoryPage,
  toMemoryPageSource,
  type MemoryDensity,
} from "@/lib/memory-pages"

/**
 * Memory fitness hints for MEMORY_TEXT_PAGE composition.
 * Photos are never considered — they belong to PHOTO_MEMORY_PAGE.
 */
export type MemoryContentHint = {
  memoryId: string
  density: MemoryDensity
  fullPageRecommended: boolean
  /** WEAK = SHORT text — prefer future multi-snippet composition. */
  fullPageFitness: "STRONG" | "WEAK"
}

/**
 * Assess each profile memory for full-page fitness (text only).
 */
export function listMemoryContentHints(profile: BookProfileV1): MemoryContentHint[] {
  const out: MemoryContentHint[] = []
  for (const memory of profile.memories ?? []) {
    const source = toMemoryPageSource(memory)
    if (!source) continue
    const density = classifyMemoryDensity({ source })
    const fullPageRecommended = recommendFullMemoryPage({ density })
    out.push({
      memoryId: source.memoryId,
      density,
      fullPageRecommended,
      fullPageFitness: fullPageRecommended ? "STRONG" : "WEAK",
    })
  }
  return out
}
