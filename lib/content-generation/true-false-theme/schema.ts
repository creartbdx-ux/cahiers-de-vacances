import type { JsonSchemaObject } from "../types"
import type { GeneratedTrueFalseThemeStatement } from "./types"
import { TRUE_FALSE_THEME_DEFAULT_STATEMENTS } from "./context"
import {
  isTrueFalseThemeStatementStyle,
  TRUE_FALSE_THEME_STATEMENT_STYLES,
  type TrueFalseThemeStatementStyle,
} from "./styles"

export const TRUE_FALSE_THEME_MAX_STATEMENTS = 10

export interface TrueFalseThemeLlmPayload {
  title: string
  statements: Array<{
    id: string
    statement: string
    answer: boolean
    explanation: string
    topicKey: string
    topicLabel: string
    statementStyle: string
  }>
}

export interface TrueFalseThemeRepairLlmPayload {
  replacements: Array<{
    index: number
    id: string
    statement: string
    answer: boolean
    explanation: string
    topicKey: string
    topicLabel: string
    statementStyle: string
  }>
}

function topicKeyProperty(allowedTopics: string[]): Record<string, unknown> {
  if (allowedTopics.length > 0) {
    return { type: "string", enum: [...allowedTopics] }
  }
  return { type: "string", minLength: 1 }
}

function statementItemProperties(allowedTopics: string[]): Record<string, unknown> {
  return {
    id: { type: "string", minLength: 1 },
    statement: { type: "string", minLength: 1 },
    answer: { type: "boolean" },
    explanation: { type: "string", minLength: 1 },
    topicKey: topicKeyProperty(allowedTopics),
    topicLabel: { type: "string", minLength: 1 },
    statementStyle: {
      type: "string",
      enum: [...TRUE_FALSE_THEME_STATEMENT_STYLES],
    },
  }
}

const STATEMENT_REQUIRED = [
  "id",
  "statement",
  "answer",
  "explanation",
  "topicKey",
  "topicLabel",
  "statementStyle",
] as const

export function buildTrueFalseThemeOutputSchema(input: {
  targetStatements: number
  allowedTopics: string[]
}): JsonSchemaObject {
  const n = Math.min(
    TRUE_FALSE_THEME_MAX_STATEMENTS,
    Math.max(TRUE_FALSE_THEME_DEFAULT_STATEMENTS, input.targetStatements),
  )
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "statements"],
    properties: {
      title: { type: "string", minLength: 1 },
      statements: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          additionalProperties: false,
          required: [...STATEMENT_REQUIRED],
          properties: statementItemProperties(input.allowedTopics),
        },
      },
    },
  }
}

export function buildTrueFalseThemeRepairOutputSchema(input: {
  invalidIndexes1Based: number[]
  allowedTopics: string[]
}): JsonSchemaObject {
  const n = input.invalidIndexes1Based.length
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
          required: ["index", ...STATEMENT_REQUIRED],
          properties: {
            index: { type: "integer", minimum: 1 },
            ...statementItemProperties(input.allowedTopics),
          },
        },
      },
    },
  }
}

export function isTrueFalseThemeLlmPayload(data: unknown): data is TrueFalseThemeLlmPayload {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  return typeof d.title === "string" && Array.isArray(d.statements)
}

export function isTrueFalseThemeRepairLlmPayload(
  data: unknown,
): data is TrueFalseThemeRepairLlmPayload {
  if (!data || typeof data !== "object") return false
  return Array.isArray((data as Record<string, unknown>).replacements)
}

export function coerceTrueFalseThemeStatements(payload: TrueFalseThemeLlmPayload): {
  title: string
  statements: GeneratedTrueFalseThemeStatement[]
} {
  return {
    title: String(payload.title ?? "").trim(),
    statements: (payload.statements ?? []).map((s, i) => coerceOne(s, i)),
  }
}

export function coerceTrueFalseThemeReplacements(
  payload: TrueFalseThemeRepairLlmPayload,
): Array<GeneratedTrueFalseThemeStatement & { index0: number }> {
  return (payload.replacements ?? []).map((r) => {
    const index1 = Number(r.index)
    const index0 = Number.isFinite(index1) ? Math.max(0, index1 - 1) : 0
    return { ...coerceOne(r, index0), index0 }
  })
}

function coerceOne(
  s: {
    id?: unknown
    statement?: unknown
    answer?: unknown
    explanation?: unknown
    topicKey?: unknown
    topicLabel?: unknown
    statementStyle?: unknown
  },
  fallbackIndex: number,
): GeneratedTrueFalseThemeStatement {
  const styleRaw = String(s.statementStyle ?? "")
  const statementStyle: TrueFalseThemeStatementStyle = isTrueFalseThemeStatementStyle(styleRaw)
    ? styleRaw
    : "FACT"

  return {
    id: String(s.id ?? `tf_${fallbackIndex + 1}`).trim() || `tf_${fallbackIndex + 1}`,
    statement: String(s.statement ?? "").trim(),
    answer: Boolean(s.answer),
    explanation: String(s.explanation ?? "").trim(),
    topicKey: String(s.topicKey ?? "").trim(),
    topicLabel: String(s.topicLabel ?? "").trim(),
    statementStyle,
  }
}

export function applyTrueFalseThemeReplacements(
  statements: GeneratedTrueFalseThemeStatement[],
  replacements: Array<GeneratedTrueFalseThemeStatement & { index0: number }>,
): GeneratedTrueFalseThemeStatement[] {
  const next = statements.slice()
  for (const r of replacements) {
    if (r.index0 >= 0 && r.index0 < next.length) {
      const { index0: _i, ...rest } = r
      next[r.index0] = rest
    }
  }
  return next
}
