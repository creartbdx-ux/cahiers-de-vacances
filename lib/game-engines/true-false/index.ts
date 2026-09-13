import { validateTrueFalseStatements } from "./validator"
import type { GenerateTrueFalseOptions, TrueFalseResult } from "./types"

/**
 * Validate and structure true/false content. Never invents statements.
 */
export function generateTrueFalse(options: GenerateTrueFalseOptions): TrueFalseResult {
  const seed = String(options.seed ?? "default")
  const received = options.statements?.length ?? 0

  if (!options.statements || options.statements.length === 0) {
    return {
      success: false,
      reason: "NO_STATEMENTS",
      message: "Au moins une affirmation est requise.",
      seed,
      stats: { seed, received: 0, validated: 0 },
      validation: { ok: false, errors: ["Aucune affirmation fournie."] },
    }
  }

  const { statements, validation } = validateTrueFalseStatements(options.statements)

  if (!validation.ok) {
    return {
      success: false,
      reason: "VALIDATION_FAILED",
      message: `Vrai/faux invalide: ${validation.errors.join(" ")}`,
      seed,
      stats: { seed, received, validated: statements.length },
      validation,
    }
  }

  return {
    success: true,
    seed,
    statements,
    stats: { seed, received, validated: statements.length },
    validation,
  }
}

export * from "./types"
export { validateTrueFalseStatements } from "./validator"
export { isTrueFalseAnswerHighlighted, sameTrueFalseContent } from "./solution"
