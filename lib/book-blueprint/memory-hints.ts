import type { BookProfileV1 } from "@/lib/questionnaire/types"
import {
  classifyMemoryDensity,
  recommendFullMemoryPage,
  toMemoryPageSource,
  type MemoryDensity,
} from "@/lib/memory-pages"

/**
 * Memory fitness hints for future composition (multi-snippet / photo pages).
 * Does not regroup memories yet — exposes signal only.
 */
export type MemoryContentHint = {
  memoryId: string
  density: MemoryDensity
  fullPageRecommended: boolean
  /** WEAK = SHORT without photo — prefer future multi-snippet / photo composition. */
  fullPageFitness: "STRONG" | "WEAK"
}

/**
 * Assess each profile memory for full-page fitness.
 * Density is text-based (no signed URL). A linked authorized photo elevates
 * fullPageRecommended so SHORT+photo can still be a strong full-page candidate.
 */
export function listMemoryContentHints(profile: BookProfileV1): MemoryContentHint[] {
  const out: MemoryContentHint[] = []
  for (const memory of profile.memories ?? []) {
    const source = toMemoryPageSource(memory, profile)
    if (!source) continue
    const hasPhotoCandidate = source.linkedPhotoIds.length > 0
    const density = classifyMemoryDensity({
      source,
      hasRenderablePhoto: false,
    })
    const fullPageRecommended = recommendFullMemoryPage({
      density,
      hasRenderablePhoto: hasPhotoCandidate,
    })
    out.push({
      memoryId: source.memoryId,
      density,
      fullPageRecommended,
      fullPageFitness: fullPageRecommended ? "STRONG" : "WEAK",
    })
  }
  return out
}
