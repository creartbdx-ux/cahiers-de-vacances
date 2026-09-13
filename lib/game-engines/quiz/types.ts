/**
 * Quiz engine — public types.
 *
 * Pure data: validates and structures editorial Q&A content. The engine never
 * invents questions; the AI / questionnaire / theme bank supplies them.
 */

export const QUIZ_CHOICE_COUNT = 4
export const QUIZ_CHOICE_LABELS = ["A", "B", "C", "D"] as const

export interface QuizQuestionInput {
  question: string
  /** Exactly 4 choices in V1. */
  choices: string[]
  /** Index of the correct choice (0–3). */
  correctIndex: number
  explanation?: string
}

export interface QuizQuestion {
  index: number
  question: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation?: string
}

export interface QuizValidation {
  ok: boolean
  errors: string[]
}

export interface QuizStats {
  seed: string
  received: number
  validated: number
}

export interface QuizSuccess {
  success: true
  seed: string
  questions: QuizQuestion[]
  stats: QuizStats
  validation: QuizValidation
}

export type QuizFailureReason =
  | "NO_QUESTIONS"
  | "VALIDATION_FAILED"

export interface QuizFailure {
  success: false
  reason: QuizFailureReason
  message: string
  seed: string
  stats: Partial<QuizStats>
  validation: QuizValidation
}

export type QuizResult = QuizSuccess | QuizFailure

export interface GenerateQuizOptions {
  questions: QuizQuestionInput[]
  seed?: string | number
}
