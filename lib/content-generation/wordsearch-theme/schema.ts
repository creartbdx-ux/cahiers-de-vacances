import type { JsonSchemaObject } from "../types"
import { normalizeWord } from "@/lib/game-engines/wordsearch/normalize"
import type { GeneratedWordSearchThemeWord } from "./types"
import { WORDSEARCH_THEME_DEFAULT_WORDS } from "./context"

export const WORDSEARCH_THEME_MAX_WORDS = 15

export interface WordSearchThemeLlmPayload {
  title: string
  words: Array<{
    display: string
    topicKey: string
  }>
}

export interface WordSearchThemeRepairLlmPayload {
  replacements: Array<{
    index: number
    display: string
    topicKey: string
  }>
}

function topicKeyProperty(allowedTopics: string[]): Record<string, unknown> {
  if (allowedTopics.length > 0) {
    return { type: "string", enum: [...allowedTopics] }
  }
  return { type: "string", minLength: 1 }
}

const WORD_ITEM_REQUIRED = ["display", "topicKey"] as const

function wordItemProperties(allowedTopics: string[]): Record<string, unknown> {
  return {
    display: { type: "string", minLength: 1 },
    topicKey: topicKeyProperty(allowedTopics),
  }
}

export function buildWordSearchThemeOutputSchema(input: {
  targetWords: number
  allowedTopics: string[]
}): JsonSchemaObject {
  const n = Math.min(
    WORDSEARCH_THEME_MAX_WORDS,
    Math.max(WORDSEARCH_THEME_DEFAULT_WORDS, input.targetWords),
  )
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "words"],
    properties: {
      title: { type: "string", minLength: 1 },
      words: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          additionalProperties: false,
          required: [...WORD_ITEM_REQUIRED],
          properties: wordItemProperties(input.allowedTopics),
        },
      },
    },
  }
}

export function buildWordSearchThemeRepairOutputSchema(input: {
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
          required: ["index", ...WORD_ITEM_REQUIRED],
          properties: {
            index: { type: "integer", enum: indexes },
            ...wordItemProperties(input.allowedTopics),
          },
        },
      },
    },
  }
}

export const WORDSEARCH_THEME_OUTPUT_SCHEMA: JsonSchemaObject = buildWordSearchThemeOutputSchema({
  targetWords: WORDSEARCH_THEME_DEFAULT_WORDS,
  allowedTopics: [],
})

export function isWordSearchThemeLlmPayload(value: unknown): value is WordSearchThemeLlmPayload {
  if (!value || typeof value !== "object") return false
  const o = value as { title?: unknown; words?: unknown }
  return typeof o.title === "string" && Array.isArray(o.words)
}

export function isWordSearchThemeRepairLlmPayload(
  value: unknown,
): value is WordSearchThemeRepairLlmPayload {
  if (!value || typeof value !== "object") return false
  return Array.isArray((value as { replacements?: unknown }).replacements)
}

export function coerceWordSearchThemeWords(
  payload: WordSearchThemeLlmPayload,
): { title: string; words: GeneratedWordSearchThemeWord[] } {
  return {
    title: payload.title.trim() || "Mots mêlés",
    words: payload.words.map((w) => {
      const display = String(w.display ?? "").trim()
      return {
        display,
        normalized: normalizeWord(display),
        topicKey: String(w.topicKey ?? "").trim(),
      }
    }),
  }
}

export function coerceWordSearchThemeReplacements(
  payload: WordSearchThemeRepairLlmPayload,
): Array<{ index0: number; word: GeneratedWordSearchThemeWord }> {
  return payload.replacements.map((r, i) => {
    const index1 = Number(r.index)
    const index0 = Number.isFinite(index1) && index1 >= 1 ? index1 - 1 : i
    const display = String(r.display ?? "").trim()
    return {
      index0,
      word: {
        display,
        normalized: normalizeWord(display),
        topicKey: String(r.topicKey ?? "").trim(),
      },
    }
  })
}

export function applyWordSearchThemeReplacements(
  original: GeneratedWordSearchThemeWord[],
  replacements: Array<{ index0: number; word: GeneratedWordSearchThemeWord }>,
): GeneratedWordSearchThemeWord[] {
  const next = original.map((w) => ({ ...w }))
  for (const r of replacements) {
    if (r.index0 < 0 || r.index0 >= next.length) continue
    next[r.index0] = { ...r.word }
  }
  return next
}
