import { generateGame } from "@/lib/game-engines/registry"
import type { WordSearchSuccess } from "@/lib/game-engines/wordsearch/types"
import { toWordSearchThemeEngineInput } from "./adapter"
import type { GeneratedWordSearchThemeWord } from "./types"

export const WORDSEARCH_PREVIEW_BUILD_ERROR =
  "Impossible de construire la grille avec cette sélection de mots."

export type WordSearchThemePreviewWord = Pick<
  GeneratedWordSearchThemeWord,
  "display" | "normalized" | "topicKey"
>

export type WordSearchThemePreviewResult =
  | { ok: true; wordsearch: WordSearchSuccess }
  | { ok: false; message: string }

/**
 * Deterministic preview grid for Editorial Lab — same words + seed as generation.
 * Runs the existing WORDSEARCH engine (no IA, no duplication of placement logic).
 */
export function buildWordSearchThemePreview(
  words: WordSearchThemePreviewWord[],
  seed: string,
): WordSearchThemePreviewResult {
  if (!words.length || !seed.trim()) {
    return { ok: false, message: WORDSEARCH_PREVIEW_BUILD_ERROR }
  }

  const result = generateGame(
    "WORDSEARCH",
    toWordSearchThemeEngineInput({
      seed,
      words: words.map((w) => ({
        display: w.display,
        normalized: w.normalized,
        topicKey: w.topicKey,
      })),
    }),
  )

  if (!result.success || !result.grid?.length || !result.grid[0]?.length) {
    return { ok: false, message: WORDSEARCH_PREVIEW_BUILD_ERROR }
  }

  return { ok: true, wordsearch: result }
}
