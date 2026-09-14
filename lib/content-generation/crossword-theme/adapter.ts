import type { GenerateCrosswordOptions } from "@/lib/game-engines/crossword/types"
import type { GeneratedCrosswordTheme } from "./types"

/**
 * Adapt CROSSWORD_THEME content to the existing CROSSWORD engine input.
 */
export function toCrosswordThemeEngineInput(
  generated: Pick<GeneratedCrosswordTheme, "entries" | "seed">,
): GenerateCrosswordOptions {
  const count = generated.entries.length
  return {
    entries: generated.entries.map((e) => ({
      answer: e.answer,
      clue: e.clue,
    })),
    seed: generated.seed,
    targetEntries: count,
    minEntries: Math.min(4, count),
    maxEntries: Math.max(count, 10),
  }
}
