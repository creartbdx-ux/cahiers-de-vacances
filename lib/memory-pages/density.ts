import type { MemoryDensity, MemoryPageSource } from "./types"

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function paragraphCount(text: string): number {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length
}

/**
 * Body-volume density thresholds (editorial packing).
 * Title / place / eyebrow must NOT inflate density.
 *
 * SHORT  ≈ ≤42 words
 * MEDIUM ≈ 43–90 words
 * RICH   ≈ >90 words, or several real paragraphs with enough body
 */
export const MEMORY_DENSITY_SHORT_MAX_WORDS = 42
export const MEMORY_DENSITY_MEDIUM_MAX_WORDS = 90

/**
 * Classify from raw body text only — shared by MEMORY and PHOTO text.
 */
export function classifyBodyTextDensity(text: string): MemoryDensity {
  const trimmed = text.trim()
  if (!trimmed) return "SHORT"
  const words = wordCount(trimmed)
  const paragraphs = paragraphCount(trimmed)

  if (words <= MEMORY_DENSITY_SHORT_MAX_WORDS) return "SHORT"

  // Several paragraphs with real substance → RICH even near the upper MEDIUM band
  if (paragraphs >= 3 && words > 55) return "RICH"
  if (paragraphs >= 2 && words > 75) return "RICH"

  if (words > MEMORY_DENSITY_MEDIUM_MAX_WORDS) return "RICH"
  return "MEDIUM"
}

/**
 * App-side density — never decided by the LLM.
 * Based on originalText volume only (not title/place).
 * MEMORY_TEXT_PAGE: no photo boost (photos are not heuristically attached).
 */
export function classifyMemoryDensity(input: {
  source: MemoryPageSource
  /** Ignored for MEMORY_TEXT V1 — kept for API compatibility. */
  hasRenderablePhoto?: boolean
}): MemoryDensity {
  void input.hasRenderablePhoto
  return classifyBodyTextDensity(input.source.originalText)
}

/**
 * SHORT is a weak full-page candidate for MEMORY_TEXT_PAGE.
 * Photos never rescue a memory page (separate PHOTO_MEMORY_PAGE).
 */
export function recommendFullMemoryPage(input: {
  density: MemoryDensity
  hasRenderablePhoto?: boolean
}): boolean {
  void input.hasRenderablePhoto
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
