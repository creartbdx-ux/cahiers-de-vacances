import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import type { CrosswordResult } from "@/lib/game-engines/crossword/types"
import type { UniverseEditorialFields } from "@/lib/universes/editorial"
import type { ContentGenerationError, ContentGenerationProvider } from "../types"
import { createDefaultContentGenerationProvider } from "../provider"
import { toCrosswordThemeEngineInput } from "./adapter"
import {
  buildCrosswordThemeContext,
  buildCrosswordThemeUserPayload,
  type CrosswordThemeContext,
} from "./context"
import {
  buildCrosswordThemeRepairSystemPrompt,
  buildCrosswordThemeSystemPrompt,
  buildCrosswordThemeTargetedRepairPrompt,
} from "./prompt"
import {
  applyCrosswordThemeReplacements,
  buildCrosswordThemeOutputSchema,
  buildCrosswordThemeRepairOutputSchema,
  coerceCrosswordThemeEntries,
  coerceCrosswordThemeReplacements,
  isCrosswordThemeLlmPayload,
  isCrosswordThemeRepairLlmPayload,
} from "./schema"
import {
  pickEngineRepairIndexes,
  validateCrosswordThemeGeneration,
} from "./validate"
import type { GeneratedCrosswordTheme, CrosswordThemeValidationResult } from "./types"

export interface GenerateCrosswordThemeInput {
  slot: EditorialGameSlot
  universe?: UniverseEditorialFields | null
  universeName?: string | null
  bookProjectId?: string
  maxRepairAttempts?: 0 | 1
  provider?: ContentGenerationProvider
}

export interface GenerateCrosswordThemeSuccess {
  ok: true
  generated: GeneratedCrosswordTheme
  validation: Extract<CrosswordThemeValidationResult, { ok: true }>
  engineResult: Extract<CrosswordResult, { success: true }>
  context: CrosswordThemeContext
  durationMs: number
  repaired: boolean
  repairedCount: number
  gridBuildable: true
}

export type GenerateCrosswordThemeResult =
  | GenerateCrosswordThemeSuccess
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
  context: CrosswordThemeContext,
): Promise<
  | { ok: true; title: string; entries: ReturnType<typeof coerceCrosswordThemeEntries>["entries"] }
  | ContentGenerationError
> {
  const schema = buildCrosswordThemeOutputSchema({
    targetEntries: context.targetEntries,
    allowedTopics: context.allowedTopics,
  })
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "crossword_theme_v1",
    schema,
    seed,
  })

  if (!raw.ok) return raw

  if (!isCrosswordThemeLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON inattendue (title/entries manquants).",
    }
  }

  const coerced = coerceCrosswordThemeEntries(raw.data)
  return { ok: true, title: coerced.title, entries: coerced.entries }
}

async function callTargetedRepair(
  provider: ContentGenerationProvider,
  system: string,
  input: unknown,
  seed: string,
  context: CrosswordThemeContext,
  invalidIndexes1Based: number[],
): Promise<
  | { ok: true; replacements: ReturnType<typeof coerceCrosswordThemeReplacements> }
  | ContentGenerationError
> {
  const schema = buildCrosswordThemeRepairOutputSchema({
    invalidIndexes1Based,
    allowedTopics: context.allowedTopics,
  })
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "crossword_theme_repair_v1",
    schema,
    seed,
  })

  if (!raw.ok) return raw

  if (!isCrosswordThemeRepairLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON de réparation inattendue (replacements manquants).",
    }
  }

  return { ok: true, replacements: coerceCrosswordThemeReplacements(raw.data) }
}

async function attemptRepair(input: {
  provider: ContentGenerationProvider
  baseSystem: string
  userPayload: Record<string, unknown>
  seed: string
  context: CrosswordThemeContext
  title: string
  entries: ReturnType<typeof coerceCrosswordThemeEntries>["entries"]
  validation: Extract<CrosswordThemeValidationResult, { ok: false }> | null
  engineMessage: string | null
}): Promise<
  | {
      ok: true
      title: string
      entries: ReturnType<typeof coerceCrosswordThemeEntries>["entries"]
      repairedCount: number
    }
  | ContentGenerationError
> {
  const { provider, baseSystem, userPayload, seed, context, entries } = input

  let invalidIndexes: number[] = []
  let invalid: Array<{ index1: number; errors: string[] }> = []

  if (input.validation && input.validation.entryIssues.length > 0) {
    invalidIndexes = [...new Set(input.validation.entryIssues.map((i) => i.index))].sort(
      (a, b) => a - b,
    )
    invalid = invalidIndexes.map((idx) => ({
      index1: idx + 1,
      errors:
        input.validation!.entryIssues.find((ei) => ei.index === idx)?.errors ??
        input.validation!.errors,
    }))
  } else if (input.engineMessage) {
    invalidIndexes = pickEngineRepairIndexes(entries.length)
    invalid = invalidIndexes.map((idx) => ({
      index1: idx + 1,
      errors: [
        "Entrée à remplacer pour permettre la construction d'une grille connectée.",
        input.engineMessage!,
      ],
    }))
  }

  if (invalidIndexes.length > 0 && invalidIndexes.length < entries.length) {
    const invalidIndexes1Based = invalidIndexes.map((i) => i + 1)
    const keptEntries = entries
      .map((e, i) => ({ index1: i + 1, entry: e }))
      .filter((_, i) => !invalidIndexes.includes(i))

    const repairSystem = buildCrosswordThemeTargetedRepairPrompt({
      baseSystem,
      keptEntries,
      invalid,
      usedTopicKeys: keptEntries.map((k) => k.entry.topicKey),
      engineFailure: input.engineMessage,
    })

    const repairResult = await callTargetedRepair(
      provider,
      repairSystem,
      {
        ...userPayload,
        keepUnchanged: keptEntries.map((k) => ({
          index: k.index1,
          answer: k.entry.answer,
          clue: k.entry.clue,
          topicKey: k.entry.topicKey,
        })),
        replaceIndexes: invalidIndexes1Based,
      },
      `${seed}:repair`,
      context,
      invalidIndexes1Based,
    )

    if (!repairResult.ok) return repairResult

    const next = applyCrosswordThemeReplacements(entries, repairResult.replacements)
    return {
      ok: true,
      title: input.title,
      entries: next,
      repairedCount: repairResult.replacements.filter(
        (r) => r.index0 >= 0 && r.index0 < entries.length,
      ).length,
    }
  }

  const errors =
    input.validation?.errors ??
    (input.engineMessage
      ? [input.engineMessage, "Impossible de construire une grille avec cette sélection."]
      : ["Validation échouée."])
  const repairSystem = buildCrosswordThemeRepairSystemPrompt(baseSystem, errors)
  const full = await callFullGeneration(
    provider,
    repairSystem,
    userPayload,
    `${seed}:repair`,
    context,
  )
  if (!full.ok) return full
  return {
    ok: true,
    title: full.title,
    entries: full.entries,
    repairedCount: full.entries.length,
  }
}

/**
 * Full CROSSWORD_THEME pipeline: theme context → LLM → validate → repair → CROSSWORD engine.
 * At most one automatic repair attempt (editorial and/or grid construction).
 */
export async function generateCrosswordThemeContent(
  input: GenerateCrosswordThemeInput,
): Promise<GenerateCrosswordThemeResult> {
  const started = Date.now()
  const provider = input.provider ?? createDefaultContentGenerationProvider()
  const maxRepair = input.maxRepairAttempts ?? 1

  if (input.slot.gameId !== "CROSSWORD_THEME") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Slot non supporté pour CROSSWORD_THEME : ${input.slot.gameId}.`,
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

  const context = buildCrosswordThemeContext({
    slot: input.slot,
    universe: input.universe,
    universeName: input.universeName,
  })

  if (!context.universeId && !context.universeName) {
    return {
      ok: false,
      code: "NO_SOURCES",
      message: "Aucun univers/thème disponible pour ce slot CROSSWORD_THEME.",
    }
  }

  const userPayload = buildCrosswordThemeUserPayload(context)
  const baseSystem = buildCrosswordThemeSystemPrompt(context)

  let repaired = false
  let repairedCount = 0
  let title = ""
  let entries: ReturnType<typeof coerceCrosswordThemeEntries>["entries"] = []

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
  entries = first.entries

  let validation = validateCrosswordThemeGeneration({ title, entries, context })
  let engineResult: CrosswordResult | null = null

  if (validation.ok) {
    engineResult = generateGame(
      "CROSSWORD",
      toCrosswordThemeEngineInput({
        seed: input.slot.seed,
        entries: validation.entries,
      }),
    )
  }

  const needsRepair =
    maxRepair >= 1 &&
    (!validation.ok || (engineResult !== null && !engineResult.success))

  if (needsRepair) {
    repaired = true
    const repairOutcome = await attemptRepair({
      provider,
      baseSystem,
      userPayload,
      seed: input.slot.seed,
      context,
      title,
      entries,
      validation: validation.ok ? null : validation,
      engineMessage:
        engineResult && !engineResult.success ? engineResult.message : null,
    })

    if (!repairOutcome.ok) {
      logGeneration({
        bookProjectId: input.bookProjectId,
        slotId: input.slot.slotId,
        gameId: input.slot.gameId,
        universeId: context.universeId,
        ok: false,
        durationMs: Date.now() - started,
        repaired: true,
        code: repairOutcome.code,
      })
      return repairOutcome
    }

    title = repairOutcome.title
    entries = repairOutcome.entries
    repairedCount = repairOutcome.repairedCount
    validation = validateCrosswordThemeGeneration({ title, entries, context })
    engineResult = null
    if (validation.ok) {
      engineResult = generateGame(
        "CROSSWORD",
        toCrosswordThemeEngineInput({
          seed: input.slot.seed,
          entries: validation.entries,
        }),
      )
    }
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

  if (!engineResult || !engineResult.success) {
    const message =
      engineResult && !engineResult.success
        ? engineResult.message
        : "Impossible de construire la grille avec cette sélection de mots."
    const result: ContentGenerationError = {
      ok: false,
      code: "ENGINE_REJECTED",
      message,
      details: [message],
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

  const generated: GeneratedCrosswordTheme = {
    slotId: input.slot.slotId,
    gameId: "CROSSWORD_THEME",
    seed: input.slot.seed,
    title: validation.title,
    universeId: context.universeId,
    entries: validation.entries,
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
    gridBuildable: true,
  }
}
