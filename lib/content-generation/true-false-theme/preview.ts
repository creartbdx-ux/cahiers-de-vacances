import { generateGame } from "@/lib/game-engines/registry"
import type { TrueFalseSuccess } from "@/lib/game-engines/true-false/types"
import { toTrueFalseThemeEngineInput } from "./adapter"
import type { TrueFalseThemeStatementStyle } from "./styles"

export const TRUE_FALSE_THEME_PREVIEW_BUILD_ERROR =
  "Impossible de construire l'aperçu vrai/faux avec ce contenu."

export type TrueFalseThemePreviewStatement = {
  id: string
  statement: string
  answer: boolean
  explanation: string
  topicKey: string
  topicLabel: string
  statementStyle: string
}

export type TrueFalseThemePreviewResult =
  | { ok: true; trueFalse: TrueFalseSuccess }
  | { ok: false; message: string }

/**
 * Deterministic TRUE_FALSE preview for Editorial Lab — same statements + seed.
 * No IA.
 */
export function buildTrueFalseThemePreview(
  statements: TrueFalseThemePreviewStatement[],
  seed: string,
): TrueFalseThemePreviewResult {
  if (!statements.length || !seed.trim()) {
    return { ok: false, message: TRUE_FALSE_THEME_PREVIEW_BUILD_ERROR }
  }

  const result = generateGame(
    "TRUE_FALSE",
    toTrueFalseThemeEngineInput({
      seed,
      statements: statements.map((s) => ({
        id: s.id,
        statement: s.statement,
        answer: s.answer,
        explanation: s.explanation,
        topicKey: s.topicKey,
        topicLabel: s.topicLabel,
        statementStyle: s.statementStyle as TrueFalseThemeStatementStyle,
      })),
    }),
  )

  if (!result.success || !result.statements.length) {
    return { ok: false, message: TRUE_FALSE_THEME_PREVIEW_BUILD_ERROR }
  }

  return { ok: true, trueFalse: result }
}
