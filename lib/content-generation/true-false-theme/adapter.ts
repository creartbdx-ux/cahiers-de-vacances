import type {
  GenerateTrueFalseOptions,
  TrueFalseStatementInput,
} from "@/lib/game-engines/true-false/types"
import type {
  GeneratedTrueFalseTheme,
  GeneratedTrueFalseThemeStatement,
} from "./types"

/**
 * Adapt TRUE_FALSE_THEME content to the existing TRUE_FALSE engine.
 */
export function toTrueFalseThemeEngineInput(
  generated: Pick<GeneratedTrueFalseTheme, "statements" | "seed">,
): GenerateTrueFalseOptions {
  return {
    statements: generated.statements.map((s) => toTrueFalseThemeStatementInput(s)),
    seed: generated.seed,
  }
}

export function toTrueFalseThemeStatementInput(
  s: GeneratedTrueFalseThemeStatement,
): TrueFalseStatementInput {
  return {
    statement: s.statement,
    correctAnswer: s.answer,
    explanation: s.explanation,
  }
}
