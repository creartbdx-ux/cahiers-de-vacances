/** Theme quiz question — general knowledge, no personal sourceRefs. */
import type { QuizThemeQuestionStyle } from "./styles"

export interface GeneratedQuizThemeQuestion {
  id: string
  question: string
  questionStyle: QuizThemeQuestionStyle
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  /** Canonical allowed topic from the universe (exact match). */
  topicKey: string
  /** Optional precise sub-theme for debug / admin. */
  topicLabel: string
}

export interface GeneratedQuizTheme {
  slotId: string
  gameId: "QUIZ_THEME"
  seed: string
  title: string
  universeId: string
  questions: GeneratedQuizThemeQuestion[]
}

export interface QuizThemeQuestionIssue {
  /** 0-based index in the questions array. */
  index: number
  errors: string[]
}

export interface QuizThemeValidationSuccess {
  ok: true
  questions: GeneratedQuizThemeQuestion[]
  title: string
  /** Distinct topicKeys used. */
  topics: string[]
  styles: QuizThemeQuestionStyle[]
  styleDistinctCount: number
  styleDiversityOk: true
  warnings: string[]
}

export interface QuizThemeValidationFailure {
  ok: false
  errors: string[]
  warnings: string[]
  /** Per-question issues when identifiable (for targeted repair). */
  questionIssues: QuizThemeQuestionIssue[]
}

export type QuizThemeValidationResult = QuizThemeValidationSuccess | QuizThemeValidationFailure
