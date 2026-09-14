import type { MemoryDensity, PhotoMemoryLayout, PhotoMemorySourceV1 } from "./types"

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

export function photoMemoryCombinedText(source: PhotoMemorySourceV1): string {
  return [source.caption, source.anecdote]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join("\n\n")
}

export function photoMemoryHasText(source: PhotoMemorySourceV1): boolean {
  return Boolean(source.caption?.trim() || source.anecdote?.trim())
}

/**
 * Aspect → layout. Unknown ratio defaults to LANDSCAPE (safe editorial plane).
 * No image vision — ratio must be provided explicitly when known.
 */
export function classifyPhotoMemoryLayout(aspectRatio?: number): PhotoMemoryLayout {
  if (aspectRatio == null || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return "LANDSCAPE"
  }
  if (aspectRatio >= 1.15) return "LANDSCAPE"
  if (aspectRatio <= 0.85) return "PORTRAIT"
  return "SQUARE"
}

export function classifyPhotoMemoryDensity(source: PhotoMemorySourceV1): MemoryDensity {
  const text = photoMemoryCombinedText(source)
  if (!text) return "SHORT"
  const words = wordCount(text)
  const sentences = sentenceCount(text)
  let score = Math.min(60, words * 1.4)
  if (sentences >= 2) score += 10
  if (sentences >= 3) score += 10
  if (source.caption?.trim() && source.anecdote?.trim()) score += 8
  if (words < 12) score -= 10
  if (score < 38) return "SHORT"
  if (score < 72) return "MEDIUM"
  return "RICH"
}

export function recommendFullPhotoMemoryPage(input: {
  source: PhotoMemorySourceV1
  hasRenderablePhoto: boolean
}): boolean {
  if (!input.hasRenderablePhoto) return false
  if (!photoMemoryHasText(input.source)) return false
  return true
}

export function maxPhotoMemoryBodyWords(sourceText: string, density: MemoryDensity): number {
  const sourceWords = wordCount(sourceText)
  if (!sourceWords) return 0
  if (density === "SHORT") {
    return Math.max(sourceWords, Math.min(40, Math.ceil(sourceWords * 1.25) + 4))
  }
  if (density === "MEDIUM") {
    return Math.min(100, Math.max(sourceWords, Math.ceil(sourceWords * 1.2) + 8))
  }
  return Math.min(140, Math.max(sourceWords, Math.ceil(sourceWords * 1.15) + 12))
}

/**
 * Relative photo share of the composition (0–1), by layout + density.
 * SHORT → larger photo; RICH → more room for text.
 */
export function photoShareForLayout(
  layout: PhotoMemoryLayout,
  density: MemoryDensity,
): number {
  const base =
    layout === "LANDSCAPE" ? 0.48 : layout === "PORTRAIT" ? 0.42 : 0.44
  if (density === "SHORT") return Math.min(0.55, base + 0.07)
  if (density === "RICH") return Math.max(0.36, base - 0.06)
  return base
}
