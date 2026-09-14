import type { JsonSchemaObject } from "../types"
import { collectOpenAiStrictSchemaViolations } from "../quiz-personal/schema"
import type { GeneratedQuizThemeQuestion } from "./types"
import { QUIZ_THEME_DEFAULT_QUESTIONS } from "./context"
import {
  isQuizThemeQuestionStyle,
  QUIZ_THEME_QUESTION_STYLES,
  type QuizThemeQuestionStyle,
} from "./styles"

export const QUIZ_THEME_CHOICE_COUNT = 4
export const QUIZ_THEME_MAX_QUESTIONS = 10

export interface QuizThemeLlmPayload {
  title: string
  questions: Array<{
    id: string
    question: string
    questionStyle: string
    choices: string[]
    correctIndex: number
    explanation: string
    topic: string
  }>
}

/**
 * OpenAI Structured Outputs (strict=true) schema for QUIZ_THEME.
 * No personal sourceRefs — general-knowledge quiz only.
 */
export const QUIZ_THEME_OUTPUT_SCHEMA: JsonSchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["title", "questions"],
  properties: {
    title: { type: "string", minLength: 1 },
    questions: {
      type: "array",
      minItems: QUIZ_THEME_DEFAULT_QUESTIONS,
      maxItems: QUIZ_THEME_MAX_QUESTIONS,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "question",
          "questionStyle",
          "choices",
          "correctIndex",
          "explanation",
          "topic",
        ],
        properties: {
          id: { type: "string", minLength: 1 },
          question: { type: "string", minLength: 1 },
          questionStyle: {
            type: "string",
            enum: [...QUIZ_THEME_QUESTION_STYLES],
          },
          choices: {
            type: "array",
            minItems: QUIZ_THEME_CHOICE_COUNT,
            maxItems: QUIZ_THEME_CHOICE_COUNT,
            items: { type: "string", minLength: 1 },
          },
          correctIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string", minLength: 1 },
          topic: { type: "string", minLength: 1 },
        },
      },
    },
  },
}

export function isQuizThemeLlmPayload(value: unknown): value is QuizThemeLlmPayload {
  if (!value || typeof value !== "object") return false
  const o = value as { title?: unknown; questions?: unknown }
  return typeof o.title === "string" && Array.isArray(o.questions)
}

export function coerceQuizThemeQuestions(
  payload: QuizThemeLlmPayload,
): { title: string; questions: GeneratedQuizThemeQuestion[] } {
  return {
    title: payload.title.trim() || "Quiz thématique",
    questions: payload.questions.map((q, i) => {
      const styleRaw = String(q.questionStyle ?? "").trim()
      const questionStyle: QuizThemeQuestionStyle = isQuizThemeQuestionStyle(styleRaw)
        ? styleRaw
        : (styleRaw as QuizThemeQuestionStyle) // validator will reject invalid enum
      return {
        id: typeof q.id === "string" && q.id.trim() ? q.id.trim() : `q_${i + 1}`,
        question: String(q.question ?? "").trim(),
        questionStyle,
        choices: (Array.isArray(q.choices) ? q.choices : []).map((c) => String(c ?? "").trim()) as [
          string,
          string,
          string,
          string,
        ],
        correctIndex: q.correctIndex as 0 | 1 | 2 | 3,
        explanation: String(q.explanation ?? "").trim(),
        topic: String(q.topic ?? "").trim() || "général",
      }
    }),
  }
}

export { collectOpenAiStrictSchemaViolations }
