import type { JsonSchemaObject } from "../types"
import { normalizeAnswer } from "@/lib/game-engines/crossword/normalize"
import type { GeneratedCrosswordThemeEntry } from "./types"
import { CROSSWORD_THEME_DEFAULT_ENTRIES } from "./context"

export const CROSSWORD_THEME_MAX_ENTRIES = 10

export interface CrosswordThemeLlmPayload {
  title: string
  entries: Array<{
    answer: string
    clue: string
    topicKey: string
    topicLabel: string
  }>
}

export interface CrosswordThemeRepairLlmPayload {
  replacements: Array<{
    index: number
    answer: string
    clue: string
    topicKey: string
    topicLabel: string
  }>
}

function topicKeyProperty(allowedTopics: string[]): Record<string, unknown> {
  if (allowedTopics.length > 0) {
    return { type: "string", enum: [...allowedTopics] }
  }
  return { type: "string", minLength: 1 }
}

const ENTRY_REQUIRED = ["answer", "clue", "topicKey", "topicLabel"] as const

function entryItemProperties(allowedTopics: string[]): Record<string, unknown> {
  return {
    answer: { type: "string", minLength: 1 },
    clue: { type: "string", minLength: 1 },
    topicKey: topicKeyProperty(allowedTopics),
    topicLabel: { type: "string", minLength: 1 },
  }
}

export function buildCrosswordThemeOutputSchema(input: {
  targetEntries: number
  allowedTopics: string[]
}): JsonSchemaObject {
  const n = Math.min(
    CROSSWORD_THEME_MAX_ENTRIES,
    Math.max(8, input.targetEntries || CROSSWORD_THEME_DEFAULT_ENTRIES),
  )
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "entries"],
    properties: {
      title: { type: "string", minLength: 1 },
      entries: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          additionalProperties: false,
          required: [...ENTRY_REQUIRED],
          properties: entryItemProperties(input.allowedTopics),
        },
      },
    },
  }
}

export function buildCrosswordThemeRepairOutputSchema(input: {
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
          required: ["index", ...ENTRY_REQUIRED],
          properties: {
            index: { type: "integer", enum: indexes },
            ...entryItemProperties(input.allowedTopics),
          },
        },
      },
    },
  }
}

export const CROSSWORD_THEME_OUTPUT_SCHEMA: JsonSchemaObject = buildCrosswordThemeOutputSchema({
  targetEntries: CROSSWORD_THEME_DEFAULT_ENTRIES,
  allowedTopics: [],
})

export function isCrosswordThemeLlmPayload(value: unknown): value is CrosswordThemeLlmPayload {
  if (!value || typeof value !== "object") return false
  const o = value as { title?: unknown; entries?: unknown }
  return typeof o.title === "string" && Array.isArray(o.entries)
}

export function isCrosswordThemeRepairLlmPayload(
  value: unknown,
): value is CrosswordThemeRepairLlmPayload {
  if (!value || typeof value !== "object") return false
  return Array.isArray((value as { replacements?: unknown }).replacements)
}

export function coerceCrosswordThemeEntries(
  payload: CrosswordThemeLlmPayload,
): { title: string; entries: GeneratedCrosswordThemeEntry[] } {
  return {
    title: payload.title.trim() || "Mots croisés",
    entries: payload.entries.map((e) => {
      const answer = String(e.answer ?? "").trim()
      return {
        answer,
        normalized: normalizeAnswer(answer),
        clue: String(e.clue ?? "").trim(),
        topicKey: String(e.topicKey ?? "").trim(),
        topicLabel: String(e.topicLabel ?? "").trim(),
      }
    }),
  }
}

export function coerceCrosswordThemeReplacements(
  payload: CrosswordThemeRepairLlmPayload,
): Array<{ index0: number; entry: GeneratedCrosswordThemeEntry }> {
  return payload.replacements.map((r, i) => {
    const index1 = Number(r.index)
    const index0 = Number.isFinite(index1) && index1 >= 1 ? index1 - 1 : i
    const answer = String(r.answer ?? "").trim()
    return {
      index0,
      entry: {
        answer,
        normalized: normalizeAnswer(answer),
        clue: String(r.clue ?? "").trim(),
        topicKey: String(r.topicKey ?? "").trim(),
        topicLabel: String(r.topicLabel ?? "").trim(),
      },
    }
  })
}

export function applyCrosswordThemeReplacements(
  original: GeneratedCrosswordThemeEntry[],
  replacements: Array<{ index0: number; entry: GeneratedCrosswordThemeEntry }>,
): GeneratedCrosswordThemeEntry[] {
  const next = original.map((e) => ({ ...e }))
  for (const r of replacements) {
    if (r.index0 < 0 || r.index0 >= next.length) continue
    next[r.index0] = { ...r.entry }
  }
  return next
}
