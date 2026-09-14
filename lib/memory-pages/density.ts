import type { MemoryPageSource, MemoryDensity } from "./types"

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function sentenceCount(text: string): number {
  const parts = text
    .trim()
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return Math.max(1, parts.length)
}

/**
 * App-side density — never decided by the LLM.
 * SHORT ≈ one short anecdote; RICH ≈ detailed multi-sentence memory.
 */
export function classifyMemoryDensity(input: {
  source: MemoryPageSource
  /** True when a usable photo (signed URL) will actually render. */
  hasRenderablePhoto?: boolean
}): MemoryDensity {
  const words = wordCount(input.source.originalText)
  const sentences = sentenceCount(input.source.originalText)
  let score = Math.min(60, words * 1.4)
  if (sentences >= 2) score += 8
  if (sentences >= 3) score += 12
  if (input.source.title?.trim()) score += 8
  if (input.source.place?.trim()) score += 6
  // Soft photo boost — must not alone turn a one-liner into RICH.
  if (input.hasRenderablePhoto) score += 4
  if (words < 18) score -= 12
  if (words < 28 && sentences === 1) score -= 8

  if (score < 38) return "SHORT"
  if (score < 72) return "MEDIUM"
  return "RICH"
}

/**
 * SHORT without photo is a weak full-page candidate (future multi-snippet / photo page).
 * A real photo can still justify a full page even for SHORT text.
 */
export function recommendFullMemoryPage(input: {
  density: MemoryDensity
  hasRenderablePhoto: boolean
}): boolean {
  if (input.hasRenderablePhoto) return true
  return input.density !== "SHORT"
}

/** Soft cap for body length — proportional to source, never inflate SHORT. */
export function maxBodyWordsForSource(sourceText: string, density: MemoryDensity): number {
  const sourceWords = wordCount(sourceText)
  if (density === "SHORT") {
    return Math.max(sourceWords, Math.min(40, Math.ceil(sourceWords * 1.25) + 4))
  }
  if (density === "MEDIUM") {
    return Math.min(100, Math.max(sourceWords, Math.ceil(sourceWords * 1.2) + 8))
  }
  return Math.min(140, Math.max(sourceWords, Math.ceil(sourceWords * 1.15) + 12))
}
