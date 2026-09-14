/** Theme quiz question — general knowledge, no personal sourceRefs. */
export interface GeneratedQuizThemeQuestion {
  id: string
  question: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  topic: string
}

export interface GeneratedQuizTheme {
  slotId: string
  gameId: "QUIZ_THEME"
  seed: string
  title: string
  universeId: string
  questions: GeneratedQuizThemeQuestion[]
}

export interface QuizThemeValidationSuccess {
  ok: true
  questions: GeneratedQuizThemeQuestion[]
  title: string
  topics: string[]
  warnings: string[]
}

export interface QuizThemeValidationFailure {
  ok: false
  errors: string[]
  warnings: string[]
}

export type QuizThemeValidationResult = QuizThemeValidationSuccess | QuizThemeValidationFailure
