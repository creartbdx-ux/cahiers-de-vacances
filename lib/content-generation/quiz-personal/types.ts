import type { SourceRef } from "../types"

export interface GeneratedQuizPersonalQuestion {
  id: string
  question: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation?: string
  sourceRefs: SourceRef[]
}

export interface GeneratedQuizPersonal {
  slotId: string
  gameId: "QUIZ_PERSONAL"
  seed: string
  questions: GeneratedQuizPersonalQuestion[]
}

export interface QuizPersonalValidationSuccess {
  ok: true
  questions: GeneratedQuizPersonalQuestion[]
  usedSourceIds: { factIds: string[]; memoryIds: string[]; jokeIds: string[]; participantIds: string[] }
  unusedSourceIds: { factIds: string[]; memoryIds: string[]; jokeIds: string[]; participantIds: string[] }
  warnings: string[]
}

export interface QuizPersonalValidationFailure {
  ok: false
  errors: string[]
  warnings: string[]
}

export type QuizPersonalValidationResult =
  | QuizPersonalValidationSuccess
  | QuizPersonalValidationFailure
