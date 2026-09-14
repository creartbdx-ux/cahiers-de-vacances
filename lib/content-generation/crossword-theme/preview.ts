import { generateGame } from "@/lib/game-engines/registry"
import type { CrosswordSuccess } from "@/lib/game-engines/crossword/types"
import { toCrosswordThemeEngineInput } from "./adapter"
import type { GeneratedCrosswordThemeEntry } from "./types"

export const CROSSWORD_PREVIEW_BUILD_ERROR =
  "Impossible de construire la grille avec cette sélection de mots."

export type CrosswordThemePreviewEntry = Pick<
  GeneratedCrosswordThemeEntry,
  "answer" | "normalized" | "clue" | "topicKey" | "topicLabel"
>

export type CrosswordThemePreviewResult =
  | { ok: true; crossword: CrosswordSuccess }
  | { ok: false; message: string }

/**
 * Deterministic preview grid for Editorial Lab — same entries + seed as generation.
 * Runs the existing CROSSWORD engine (no IA).
 */
export function buildCrosswordThemePreview(
  entries: CrosswordThemePreviewEntry[],
  seed: string,
): CrosswordThemePreviewResult {
  if (!entries.length || !seed.trim()) {
    return { ok: false, message: CROSSWORD_PREVIEW_BUILD_ERROR }
  }

  const result = generateGame(
    "CROSSWORD",
    toCrosswordThemeEngineInput({
      seed,
      entries: entries.map((e) => ({
        answer: e.answer,
        normalized: e.normalized,
        clue: e.clue,
        topicKey: e.topicKey,
        topicLabel: e.topicLabel,
      })),
    }),
  )

  if (!result.success || !result.cells?.length) {
    return { ok: false, message: CROSSWORD_PREVIEW_BUILD_ERROR }
  }

  return { ok: true, crossword: result }
}
