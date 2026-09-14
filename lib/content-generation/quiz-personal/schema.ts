import type { JsonSchemaObject } from "../types"
import type { GeneratedQuizPersonalQuestion } from "./types"

export const QUIZ_PERSONAL_MIN_QUESTIONS = 6
export const QUIZ_PERSONAL_MAX_QUESTIONS = 8
export const QUIZ_PERSONAL_CHOICE_COUNT = 4

/** Runtime-oriented TypeScript shape after parse (before business validation). */
export interface QuizPersonalLlmPayload {
  questions: Array<{
    id: string
    question: string
    choices: string[]
    correctIndex: number
    explanation?: string
    sourceRefs: Array<{ type: string; id: string }>
  }>
}

export const QUIZ_PERSONAL_OUTPUT_SCHEMA: JsonSchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      maxItems: QUIZ_PERSONAL_MAX_QUESTIONS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "choices", "correctIndex", "sourceRefs"],
        properties: {
          id: { type: "string", minLength: 1 },
          question: { type: "string", minLength: 1 },
          choices: {
            type: "array",
            minItems: QUIZ_PERSONAL_CHOICE_COUNT,
            maxItems: QUIZ_PERSONAL_CHOICE_COUNT,
            items: { type: "string", minLength: 1 },
          },
          correctIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
          sourceRefs: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "id"],
              properties: {
                type: {
                  type: "string",
                  enum: ["FACT", "MEMORY", "PARTICIPANT", "JOKE"],
                },
                id: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  },
}

export function isQuizPersonalLlmPayload(value: unknown): value is QuizPersonalLlmPayload {
  if (!value || typeof value !== "object") return false
  const q = (value as { questions?: unknown }).questions
  return Array.isArray(q)
}

export function coerceQuizPersonalQuestions(
  payload: QuizPersonalLlmPayload,
): GeneratedQuizPersonalQuestion[] {
  return payload.questions.map((q, i) => ({
    id: typeof q.id === "string" && q.id.trim() ? q.id.trim() : `q_${i + 1}`,
    question: String(q.question ?? "").trim(),
    choices: (Array.isArray(q.choices) ? q.choices : []).map((c) => String(c ?? "").trim()) as [
      string,
      string,
      string,
      string,
    ],
    correctIndex: q.correctIndex as 0 | 1 | 2 | 3,
    ...(q.explanation?.trim() ? { explanation: q.explanation.trim() } : {}),
    sourceRefs: (Array.isArray(q.sourceRefs) ? q.sourceRefs : []).map((r) => ({
      type: r.type as GeneratedQuizPersonalQuestion["sourceRefs"][number]["type"],
      id: String(r.id ?? "").trim(),
    })),
  }))
}
