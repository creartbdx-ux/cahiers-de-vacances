import { validateQuizQuestions } from "./validator"
import type { GenerateQuizOptions, QuizResult } from "./types"

/**
 * Validate and structure quiz content. Never invents questions — only checks
 * V1 constraints and returns a reproducible structured result.
 */
export function generateQuiz(options: GenerateQuizOptions): QuizResult {
  const seed = String(options.seed ?? "default")
  const received = options.questions?.length ?? 0

  if (!options.questions || options.questions.length === 0) {
    return {
      success: false,
      reason: "NO_QUESTIONS",
      message: "Au moins une question est requise.",
      seed,
      stats: { seed, received: 0, validated: 0 },
      validation: { ok: false, errors: ["Aucune question fournie."] },
    }
  }

  const { questions, validation } = validateQuizQuestions(options.questions)

  if (!validation.ok) {
    return {
      success: false,
      reason: "VALIDATION_FAILED",
      message: `Quiz invalide: ${validation.errors.join(" ")}`,
      seed,
      stats: { seed, received, validated: questions.length },
      validation,
    }
  }

  return {
    success: true,
    seed,
    questions,
    stats: { seed, received, validated: questions.length },
    validation,
  }
}

export * from "./types"
export { validateQuizQuestions } from "./validator"
export { isCorrectChoiceHighlighted, sameQuizContent } from "./solution"
