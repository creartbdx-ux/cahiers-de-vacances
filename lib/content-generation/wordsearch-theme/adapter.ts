import type { GenerateWordSearchOptions } from "@/lib/game-engines/wordsearch/types"
import type { GeneratedWordSearchTheme } from "./types"

/**
 * Adapt WORDSEARCH_THEME content to the existing WORDSEARCH engine input.
 */
export function toWordSearchThemeEngineInput(
  generated: Pick<GeneratedWordSearchTheme, "words" | "seed">,
): GenerateWordSearchOptions {
  const count = generated.words.length
  return {
    entries: generated.words.map((w) => ({ word: w.display })),
    seed: generated.seed,
    targetWords: count,
    minWords: Math.min(8, count),
  }
}
