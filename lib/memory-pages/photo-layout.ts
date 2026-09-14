import type { MemoryDensity, PhotoMemoryLayout, PhotoMemorySourceV1 } from "./types"
import { classifyBodyTextDensity, wordCount } from "./density"

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

/**
 * Text density from caption+anecdote only.
 * Having a photo does NOT make short caption/anecdote RICH —
 * visual packing weight is handled separately in personal-editorial weights.
 */
export function classifyPhotoMemoryDensity(source: PhotoMemorySourceV1): MemoryDensity {
  return classifyBodyTextDensity(photoMemoryCombinedText(source))
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
