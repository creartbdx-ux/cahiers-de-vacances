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
    /** Always present under Structured Outputs; null when unused. */
    explanation: string | null
    sourceRefs: Array<{ type: string; id: string }>
  }>
}

/**
 * OpenAI Structured Outputs (strict=true) compatible schema.
 * Every object has additionalProperties:false and required listing ALL properties.
 * Optional business fields use nullable types (e.g. explanation).
 */
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
        required: [
          "id",
          "question",
          "choices",
          "correctIndex",
          "explanation",
          "sourceRefs",
        ],
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
          explanation: { type: ["string", "null"] },
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
  return payload.questions.map((q, i) => {
    const explanation =
      typeof q.explanation === "string" && q.explanation.trim()
        ? q.explanation.trim()
        : undefined
    return {
      id: typeof q.id === "string" && q.id.trim() ? q.id.trim() : `q_${i + 1}`,
      question: String(q.question ?? "").trim(),
      choices: (Array.isArray(q.choices) ? q.choices : []).map((c) => String(c ?? "").trim()) as [
        string,
        string,
        string,
        string,
      ],
      correctIndex: q.correctIndex as 0 | 1 | 2 | 3,
      ...(explanation ? { explanation } : {}),
      sourceRefs: (Array.isArray(q.sourceRefs) ? q.sourceRefs : []).map((r) => ({
        type: r.type as GeneratedQuizPersonalQuestion["sourceRefs"][number]["type"],
        id: String(r.id ?? "").trim(),
      })),
    }
  })
}

type SchemaNode = {
  type?: string | string[]
  properties?: Record<string, SchemaNode>
  items?: SchemaNode
  required?: string[]
  additionalProperties?: boolean
}

/**
 * Assert OpenAI Structured Outputs strict object rules recursively.
 * Returns human-readable violation messages (empty = ok).
 */
export function collectOpenAiStrictSchemaViolations(
  schema: SchemaNode,
  path = "$",
): string[] {
  const errors: string[] = []
  const type = schema.type
  const isObject =
    type === "object" || (Array.isArray(type) && type.includes("object"))

  if (isObject) {
    if (!Array.isArray(schema.required)) {
      errors.push(`${path}: missing required array`)
    }
    if (schema.additionalProperties !== false) {
      errors.push(`${path}: additionalProperties must be false`)
    }
    const props = schema.properties ?? {}
    const propKeys = Object.keys(props).sort()
    const requiredKeys = [...(schema.required ?? [])].sort()
    if (propKeys.join(",") !== requiredKeys.join(",")) {
      errors.push(
        `${path}: required must list every properties key (required=[${requiredKeys.join(",")}] properties=[${propKeys.join(",")}])`,
      )
    }
    for (const [key, child] of Object.entries(props)) {
      errors.push(...collectOpenAiStrictSchemaViolations(child, `${path}.${key}`))
    }
  }

  if (type === "array" || (Array.isArray(type) && type.includes("array"))) {
    if (schema.items) {
      errors.push(...collectOpenAiStrictSchemaViolations(schema.items, `${path}.items`))
    }
  }

  return errors
}
