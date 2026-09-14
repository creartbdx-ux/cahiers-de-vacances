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
    topicKey: string
    topicLabel: string
  }>
}

export interface QuizThemeRepairLlmPayload {
  replacements: Array<{
    index: number
    id: string
    question: string
    questionStyle: string
    choices: string[]
    correctIndex: number
    explanation: string
    topicKey: string
    topicLabel: string
  }>
}

function topicKeyProperty(allowedTopics: string[]): Record<string, unknown> {
  if (allowedTopics.length > 0) {
    return {
      type: "string",
      enum: [...allowedTopics],
    }
  }
  return { type: "string", minLength: 1 }
}

function questionItemProperties(allowedTopics: string[]): Record<string, unknown> {
  return {
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
    topicKey: topicKeyProperty(allowedTopics),
    topicLabel: { type: "string", minLength: 1 },
  }
}

const QUESTION_REQUIRED = [
  "id",
  "question",
  "questionStyle",
  "choices",
  "correctIndex",
  "explanation",
  "topicKey",
  "topicLabel",
] as const

/**
 * Build Structured Outputs schema for a full QUIZ_THEME page.
 * topicKey enum is derived from the universe allowedTopics when available.
 */
export function buildQuizThemeOutputSchema(input: {
  targetQuestions: number
  allowedTopics: string[]
}): JsonSchemaObject {
  const n = Math.min(
    QUIZ_THEME_MAX_QUESTIONS,
    Math.max(QUIZ_THEME_DEFAULT_QUESTIONS, input.targetQuestions),
  )
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "questions"],
    properties: {
      title: { type: "string", minLength: 1 },
      questions: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          additionalProperties: false,
          required: [...QUESTION_REQUIRED],
          properties: questionItemProperties(input.allowedTopics),
        },
      },
    },
  }
}

/**
 * Schema for targeted repair: only replacement questions for invalid indexes.
 * `index` is 1-based (human / prompt friendly).
 */
export function buildQuizThemeRepairOutputSchema(input: {
  invalidIndexes1Based: number[]
  allowedTopics: string[]
}): JsonSchemaObject {
  const indexes = [...new Set(input.invalidIndexes1Based)].sort((a, b) => a - b)
  const n = Math.max(1, indexes.length)
  return {
    type: "object",
    additionalProperties: false,
    required: ["replacements"],
    properties: {
      replacements: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", ...QUESTION_REQUIRED],
          properties: {
            index: {
              type: "integer",
              enum: indexes,
            },
            ...questionItemProperties(input.allowedTopics),
          },
        },
      },
    },
  }
}

/** Static baseline schema (tests / docs) — 6 questions, free topicKey. */
export const QUIZ_THEME_OUTPUT_SCHEMA: JsonSchemaObject = buildQuizThemeOutputSchema({
  targetQuestions: QUIZ_THEME_DEFAULT_QUESTIONS,
  allowedTopics: [],
})

export function isQuizThemeLlmPayload(value: unknown): value is QuizThemeLlmPayload {
  if (!value || typeof value !== "object") return false
  const o = value as { title?: unknown; questions?: unknown }
  return typeof o.title === "string" && Array.isArray(o.questions)
}

export function isQuizThemeRepairLlmPayload(value: unknown): value is QuizThemeRepairLlmPayload {
  if (!value || typeof value !== "object") return false
  const o = value as { replacements?: unknown }
  return Array.isArray(o.replacements)
}

function coerceOneQuestion(
  q: {
    id?: unknown
    question?: unknown
    questionStyle?: unknown
    choices?: unknown
    correctIndex?: unknown
    explanation?: unknown
    topicKey?: unknown
    topicLabel?: unknown
    /** legacy */
    topic?: unknown
  },
  i: number,
): GeneratedQuizThemeQuestion {
  const styleRaw = String(q.questionStyle ?? "").trim()
  const questionStyle: QuizThemeQuestionStyle = isQuizThemeQuestionStyle(styleRaw)
    ? styleRaw
    : (styleRaw as QuizThemeQuestionStyle)
  const topicKey = String(q.topicKey ?? q.topic ?? "").trim()
  const topicLabel = String(q.topicLabel ?? "").trim() || topicKey || "général"
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
    topicKey: topicKey || "général",
    topicLabel,
  }
}

export function coerceQuizThemeQuestions(
  payload: QuizThemeLlmPayload,
): { title: string; questions: GeneratedQuizThemeQuestion[] } {
  return {
    title: payload.title.trim() || "Quiz thématique",
    questions: payload.questions.map((q, i) => coerceOneQuestion(q, i)),
  }
}

export function coerceQuizThemeReplacements(
  payload: QuizThemeRepairLlmPayload,
): Array<{ index0: number; question: GeneratedQuizThemeQuestion }> {
  return payload.replacements.map((r, i) => {
    const index1 = Number(r.index)
    const index0 = Number.isFinite(index1) && index1 >= 1 ? index1 - 1 : i
    return {
      index0,
      question: coerceOneQuestion(r, index0),
    }
  })
}

/**
 * Merge targeted replacements into a full question list (keeps others unchanged).
 */
export function applyQuizThemeReplacements(
  original: GeneratedQuizThemeQuestion[],
  replacements: Array<{ index0: number; question: GeneratedQuizThemeQuestion }>,
): GeneratedQuizThemeQuestion[] {
  const next = original.map((q) => ({ ...q, choices: [...q.choices] as [string, string, string, string] }))
  for (const r of replacements) {
    if (r.index0 < 0 || r.index0 >= next.length) continue
    next[r.index0] = {
      ...r.question,
      choices: [...r.question.choices] as [string, string, string, string],
    }
  }
  return next
}

export { collectOpenAiStrictSchemaViolations }
