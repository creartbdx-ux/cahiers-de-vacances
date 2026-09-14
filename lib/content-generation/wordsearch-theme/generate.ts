import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import type { WordSearchResult } from "@/lib/game-engines/wordsearch/types"
import type { UniverseEditorialFields } from "@/lib/universes/editorial"
import type { ContentGenerationError, ContentGenerationProvider } from "../types"
import { createDefaultContentGenerationProvider } from "../provider"
import { toWordSearchThemeEngineInput } from "./adapter"
import {
  buildWordSearchThemeContext,
  buildWordSearchThemeUserPayload,
  type WordSearchThemeContext,
} from "./context"
import {
  buildWordSearchThemeRepairSystemPrompt,
  buildWordSearchThemeSystemPrompt,
  buildWordSearchThemeTargetedRepairPrompt,
} from "./prompt"
import {
  applyWordSearchThemeReplacements,
  buildWordSearchThemeOutputSchema,
  buildWordSearchThemeRepairOutputSchema,
  coerceWordSearchThemeReplacements,
  coerceWordSearchThemeWords,
  isWordSearchThemeLlmPayload,
  isWordSearchThemeRepairLlmPayload,
} from "./schema"
import { validateWordSearchThemeGeneration } from "./validate"
import type { GeneratedWordSearchTheme, WordSearchThemeValidationResult } from "./types"

export interface GenerateWordSearchThemeInput {
  slot: EditorialGameSlot
  universe?: UniverseEditorialFields | null
  universeName?: string | null
  bookProjectId?: string
  maxRepairAttempts?: 0 | 1
  provider?: ContentGenerationProvider
}

export interface GenerateWordSearchThemeSuccess {
  ok: true
  generated: GeneratedWordSearchTheme
  validation: Extract<WordSearchThemeValidationResult, { ok: true }>
  engineResult: Extract<WordSearchResult, { success: true }>
  context: WordSearchThemeContext
  durationMs: number
  repaired: boolean
  repairedCount: number
}

export type GenerateWordSearchThemeResult =
  | GenerateWordSearchThemeSuccess
  | ContentGenerationError

function logGeneration(meta: {
  bookProjectId?: string
  slotId: string
  gameId: string
  universeId: string
  ok: boolean
  durationMs: number
  repaired?: boolean
  repairedCount?: number
  code?: string
}): void {
  console.info("[content-generation]", {
    bookProjectId: meta.bookProjectId ?? null,
    slotId: meta.slotId,
    gameId: meta.gameId,
    universeId: meta.universeId || null,
    sourceCount: 0,
    ok: meta.ok,
    durationMs: meta.durationMs,
    repaired: meta.repaired ?? false,
    repairedCount: meta.repairedCount ?? 0,
    code: meta.code ?? null,
  })
}

async function callFullGeneration(
  provider: ContentGenerationProvider,
  system: string,
  input: unknown,
  seed: string,
  context: WordSearchThemeContext,
): Promise<
  | { ok: true; title: string; words: ReturnType<typeof coerceWordSearchThemeWords>["words"] }
  | ContentGenerationError
> {
  const schema = buildWordSearchThemeOutputSchema({
    targetWords: context.targetWords,
    allowedTopics: context.allowedTopics,
  })
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "wordsearch_theme_v1",
    schema,
    seed,
  })

  if (!raw.ok) return raw

  if (!isWordSearchThemeLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON inattendue (title/words manquants).",
    }
  }

  const coerced = coerceWordSearchThemeWords(raw.data)
  return { ok: true, title: coerced.title, words: coerced.words }
}

async function callTargetedRepair(
  provider: ContentGenerationProvider,
  system: string,
  input: unknown,
  seed: string,
  context: WordSearchThemeContext,
  invalidIndexes1Based: number[],
): Promise<
  | { ok: true; replacements: ReturnType<typeof coerceWordSearchThemeReplacements> }
  | ContentGenerationError
> {
  const schema = buildWordSearchThemeRepairOutputSchema({
    invalidIndexes1Based,
    allowedTopics: context.allowedTopics,
  })
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "wordsearch_theme_repair_v1",
    schema,
    seed,
  })

  if (!raw.ok) return raw

  if (!isWordSearchThemeRepairLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON de réparation inattendue (replacements manquants).",
    }
  }

  return { ok: true, replacements: coerceWordSearchThemeReplacements(raw.data) }
}

/**
 * Full WORDSEARCH_THEME pipeline: theme context → LLM → validate → targeted repair → WORDSEARCH engine.
 * At most one automatic repair attempt.
 */
export async function generateWordSearchThemeContent(
  input: GenerateWordSearchThemeInput,
): Promise<GenerateWordSearchThemeResult> {
  const started = Date.now()
  const provider = input.provider ?? createDefaultContentGenerationProvider()
  const maxRepair = input.maxRepairAttempts ?? 1

  if (input.slot.gameId !== "WORDSEARCH_THEME") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Slot non supporté pour WORDSEARCH_THEME : ${input.slot.gameId}.`,
    }
  }

  if (!provider.configured) {
    const result: ContentGenerationError = {
      ok: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur.",
    }
    logGeneration({
      bookProjectId: input.bookProjectId,
      slotId: input.slot.slotId,
      gameId: input.slot.gameId,
      universeId: input.slot.universeId ?? "",
      ok: false,
      durationMs: Date.now() - started,
      code: result.code,
    })
    return result
  }

  const context = buildWordSearchThemeContext({
    slot: input.slot,
    universe: input.universe,
    universeName: input.universeName,
  })

  if (!context.universeId && !context.universeName) {
    return {
      ok: false,
      code: "NO_SOURCES",
      message: "Aucun univers/thème disponible pour ce slot WORDSEARCH_THEME.",
    }
  }

  const userPayload = buildWordSearchThemeUserPayload(context)
  const baseSystem = buildWordSearchThemeSystemPrompt(context)

  let repaired = false
  let repairedCount = 0
  let title = ""
  let words: ReturnType<typeof coerceWordSearchThemeWords>["words"] = []

  const first = await callFullGeneration(
    provider,
    baseSystem,
    userPayload,
    input.slot.seed,
    context,
  )

  if (!first.ok) {
    logGeneration({
      bookProjectId: input.bookProjectId,
      slotId: input.slot.slotId,
      gameId: input.slot.gameId,
      universeId: context.universeId,
      ok: false,
      durationMs: Date.now() - started,
      code: first.code,
    })
    return first
  }

  title = first.title
  words = first.words

  let validation = validateWordSearchThemeGeneration({ title, words, context })

  if (!validation.ok && maxRepair >= 1) {
    repaired = true
    const failed = validation
    const issues = failed.wordIssues
    const invalidIndexes = [...new Set(issues.map((i) => i.index))].sort((a, b) => a - b)

    if (invalidIndexes.length > 0 && invalidIndexes.length < words.length) {
      const invalidIndexes1Based = invalidIndexes.map((i) => i + 1)
      const keptWords = words
        .map((w, i) => ({ index1: i + 1, word: w }))
        .filter((_, i) => !invalidIndexes.includes(i))
      const invalid = invalidIndexes.map((idx) => ({
        index1: idx + 1,
        errors: issues.find((wi) => wi.index === idx)?.errors ?? failed.errors,
      }))

      const repairSystem = buildWordSearchThemeTargetedRepairPrompt({
        baseSystem,
        keptWords,
        invalid,
        usedTopicKeys: keptWords.map((k) => k.word.topicKey),
      })

      const repairResult = await callTargetedRepair(
        provider,
        repairSystem,
        {
          ...userPayload,
          keepUnchanged: keptWords.map((k) => ({
            index: k.index1,
            display: k.word.display,
            topicKey: k.word.topicKey,
          })),
          replaceIndexes: invalidIndexes1Based,
        },
        `${input.slot.seed}:repair`,
        context,
        invalidIndexes1Based,
      )

      if (!repairResult.ok) {
        logGeneration({
          bookProjectId: input.bookProjectId,
          slotId: input.slot.slotId,
          gameId: input.slot.gameId,
          universeId: context.universeId,
          ok: false,
          durationMs: Date.now() - started,
          repaired: true,
          code: repairResult.code,
        })
        return repairResult
      }

      words = applyWordSearchThemeReplacements(words, repairResult.replacements)
      repairedCount = repairResult.replacements.filter(
        (r) => r.index0 >= 0 && r.index0 < words.length,
      ).length
    } else {
      const repairSystem = buildWordSearchThemeRepairSystemPrompt(baseSystem, failed.errors)
      const full = await callFullGeneration(
        provider,
        repairSystem,
        userPayload,
        `${input.slot.seed}:repair`,
        context,
      )
      if (!full.ok) {
        logGeneration({
          bookProjectId: input.bookProjectId,
          slotId: input.slot.slotId,
          gameId: input.slot.gameId,
          universeId: context.universeId,
          ok: false,
          durationMs: Date.now() - started,
          repaired: true,
          code: full.code,
        })
        return full
      }
      title = full.title
      words = full.words
      repairedCount = words.length
    }

    validation = validateWordSearchThemeGeneration({ title, words, context })
  }

  if (!validation.ok) {
    const result: ContentGenerationError = {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Le contenu thématique généré n'a pas passé la validation.",
      details: validation.errors,
    }
    logGeneration({
      bookProjectId: input.bookProjectId,
      slotId: input.slot.slotId,
      gameId: input.slot.gameId,
      universeId: context.universeId,
      ok: false,
      durationMs: Date.now() - started,
      repaired,
      repairedCount,
      code: result.code,
    })
    return result
  }

  const generated: GeneratedWordSearchTheme = {
    slotId: input.slot.slotId,
    gameId: "WORDSEARCH_THEME",
    seed: input.slot.seed,
    title: validation.title,
    universeId: context.universeId,
    words: validation.words,
  }

  const engineResult = generateGame("WORDSEARCH", toWordSearchThemeEngineInput(generated))
  if (!engineResult.success) {
    const result: ContentGenerationError = {
      ok: false,
      code: "ENGINE_REJECTED",
      message: engineResult.message,
      details: [engineResult.message],
    }
    logGeneration({
      bookProjectId: input.bookProjectId,
      slotId: input.slot.slotId,
      gameId: input.slot.gameId,
      universeId: context.universeId,
      ok: false,
      durationMs: Date.now() - started,
      repaired,
      repairedCount,
      code: result.code,
    })
    return result
  }

  const durationMs = Date.now() - started
  logGeneration({
    bookProjectId: input.bookProjectId,
    slotId: input.slot.slotId,
    gameId: input.slot.gameId,
    universeId: context.universeId,
    ok: true,
    durationMs,
    repaired,
    repairedCount,
  })

  return {
    ok: true,
    generated,
    validation,
    engineResult,
    context,
    durationMs,
    repaired,
    repairedCount,
  }
}
