import { QUIZ_CHOICE_COUNT } from "./types"
import type { QuizQuestion, QuizQuestionInput, QuizValidation } from "./types"

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Independently validate raw quiz questions. Does not invent or repair content:
 * invalid input yields structured errors and never a fabricated quiz.
 */
export function validateQuizQuestions(inputs: QuizQuestionInput[]): {
  questions: QuizQuestion[]
  validation: QuizValidation
} {
  const errors: string[] = []
  const questions: QuizQuestion[] = []

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return {
      questions: [],
      validation: { ok: false, errors: ["Aucune question fournie."] },
    }
  }

  inputs.forEach((raw, i) => {
    const n = i + 1
    const question = (raw?.question ?? "").trim()
    if (!question) {
      errors.push(`Question ${n}: énoncé vide.`)
      return
    }

    const choices = Array.isArray(raw.choices) ? raw.choices.map((c) => (c ?? "").trim()) : []
    if (choices.length !== QUIZ_CHOICE_COUNT) {
      errors.push(`Question ${n}: exactement ${QUIZ_CHOICE_COUNT} réponses requises (reçu ${choices.length}).`)
      return
    }
    if (choices.some((c) => !c)) {
      errors.push(`Question ${n}: aucune réponse ne peut être vide.`)
      return
    }

    const keys = choices.map(normalizeKey)
    if (new Set(keys).size !== keys.length) {
      errors.push(`Question ${n}: propositions dupliquées.`)
      return
    }

    const correctIndex = raw.correctIndex
    if (
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= QUIZ_CHOICE_COUNT
    ) {
      errors.push(`Question ${n}: correctIndex invalide (attendu 0–${QUIZ_CHOICE_COUNT - 1}).`)
      return
    }

    const explanation = raw.explanation?.trim()
    questions.push({
      index: questions.length,
      question,
      choices: choices as [string, string, string, string],
      correctIndex: correctIndex as 0 | 1 | 2 | 3,
      ...(explanation ? { explanation } : {}),
    })
  })

  return {
    questions,
    validation: { ok: errors.length === 0 && questions.length > 0, errors },
  }
}
