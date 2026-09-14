import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import type { TrueFalseResult } from "@/lib/game-engines/true-false/types"
import type { UniverseEditorialFields } from "@/lib/universes/editorial"
import type { ContentGenerationError, ContentGenerationProvider } from "../types"
import { createDefaultContentGenerationProvider } from "../provider"
import { toTrueFalseThemeEngineInput } from "./adapter"
import {
  buildTrueFalseThemeContext,
  buildTrueFalseThemeUserPayload,
  type TrueFalseThemeContext,
} from "./context"
import {
  buildTrueFalseThemeSystemPrompt,
  buildTrueFalseThemeTargetedRepairPrompt,
  buildTrueFalseThemeRepairSystemPrompt,
} from "./prompt"
import {
  applyTrueFalseThemeReplacements,
  buildTrueFalseThemeOutputSchema,
  buildTrueFalseThemeRepairOutputSchema,
  coerceTrueFalseThemeReplacements,
  coerceTrueFalseThemeStatements,
  isTrueFalseThemeLlmPayload,
  isTrueFalseThemeRepairLlmPayload,
} from "./schema"
import { validateTrueFalseThemeGeneration } from "./validate"
import type { GeneratedTrueFalseTheme, TrueFalseThemeValidationResult } from "./types"

export interface GenerateTrueFalseThemeInput {
  slot: EditorialGameSlot
  universe?: UniverseEditorialFields | null
  universeName?: string | null
  bookProjectId?: string
  maxRepairAttempts?: 0 | 1
  provider?: ContentGenerationProvider
}

export interface GenerateTrueFalseThemeSuccess {
  ok: true
  generated: GeneratedTrueFalseTheme
  validation: Extract<TrueFalseThemeValidationResult, { ok: true }>
  engineResult: TrueFalseResult
  context: TrueFalseThemeContext
  durationMs: number
  repaired: boolean
  repairedCount: number
}

export type GenerateTrueFalseThemeResult =
  | GenerateTrueFalseThemeSuccess
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
  context: TrueFalseThemeContext,
): Promise<
  | {
      ok: true
      title: string
      statements: ReturnType<typeof coerceTrueFalseThemeStatements>["statements"]
    }
  | ContentGenerationError
> {
  const schema = buildTrueFalseThemeOutputSchema({
    targetStatements: context.targetStatements,
    allowedTopics: context.allowedTopics,
  })
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "true_false_theme_v1",
    schema,
    seed,
  })

  if (!raw.ok) return raw

  if (!isTrueFalseThemeLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON inattendue (title/statements manquants).",
    }
  }

  const coerced = coerceTrueFalseThemeStatements(raw.data)
  return { ok: true, title: coerced.title, statements: coerced.statements }
}

async function callTargetedRepair(
  provider: ContentGenerationProvider,
  system: string,
  input: unknown,
  seed: string,
  context: TrueFalseThemeContext,
  invalidIndexes1Based: number[],
): Promise<
  | { ok: true; replacements: ReturnType<typeof coerceTrueFalseThemeReplacements> }
  | ContentGenerationError
> {
  const schema = buildTrueFalseThemeRepairOutputSchema({
    invalidIndexes1Based,
    allowedTopics: context.allowedTopics,
  })
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "true_false_theme_repair_v1",
    schema,
    seed,
  })

  if (!raw.ok) return raw

  if (!isTrueFalseThemeRepairLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON de réparation inattendue (replacements manquants).",
    }
  }

  return { ok: true, replacements: coerceTrueFalseThemeReplacements(raw.data) }
}

/**
 * Full TRUE_FALSE_THEME pipeline: theme context → LLM → validate → targeted repair → TRUE_FALSE engine.
 */
export async function generateTrueFalseThemeContent(
  input: GenerateTrueFalseThemeInput,
): Promise<GenerateTrueFalseThemeResult> {
  const started = Date.now()
  const provider = input.provider ?? createDefaultContentGenerationProvider()
  const maxRepair = input.maxRepairAttempts ?? 1

  if (input.slot.gameId !== "TRUE_FALSE_THEME") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Slot non supporté pour TRUE_FALSE_THEME : ${input.slot.gameId}.`,
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

  const context = buildTrueFalseThemeContext({
    slot: input.slot,
    universe: input.universe,
    universeName: input.universeName,
  })

  if (!context.universeId && !context.universeName) {
    return {
      ok: false,
      code: "NO_SOURCES",
      message: "Aucun univers/thème disponible pour ce slot TRUE_FALSE_THEME.",
    }
  }

  const userPayload = buildTrueFalseThemeUserPayload(context)
  const baseSystem = buildTrueFalseThemeSystemPrompt(context)

  let repaired = false
  let repairedCount = 0
  let title = ""
  let statements: ReturnType<typeof coerceTrueFalseThemeStatements>["statements"] = []

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
  statements = first.statements

  let validation = validateTrueFalseThemeGeneration({ title, statements, context })

  if (!validation.ok && maxRepair >= 1) {
    repaired = true
    const failed = validation
    const issues = failed.statementIssues
    const invalidIndexes = [...new Set(issues.map((i) => i.index))].sort((a, b) => a - b)

    if (invalidIndexes.length > 0 && invalidIndexes.length < statements.length) {
      const invalidIndexes1Based = invalidIndexes.map((i) => i + 1)
      const kept = statements
        .map((s, i) => ({ index1: i + 1, statement: s }))
        .filter((_, i) => !invalidIndexes.includes(i))
      const invalid = invalidIndexes.map((idx) => ({
        index1: idx + 1,
        errors: issues.find((qi) => qi.index === idx)?.errors ?? failed.errors,
      }))

      const repairSystem = buildTrueFalseThemeTargetedRepairPrompt({
        baseSystem,
        kept,
        invalid,
        usedStyles: kept.map((k) => k.statement.statementStyle),
        usedTopicKeys: kept.map((k) => k.statement.topicKey),
        keptTrue: kept.filter((k) => k.statement.answer).length,
        keptFalse: kept.filter((k) => !k.statement.answer).length,
      })

      const repairResult = await callTargetedRepair(
        provider,
        repairSystem,
        {
          ...userPayload,
          keepUnchanged: kept.map((k) => ({
            index: k.index1,
            id: k.statement.id,
            statementStyle: k.statement.statementStyle,
            topicKey: k.statement.topicKey,
            answer: k.statement.answer,
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

      statements = applyTrueFalseThemeReplacements(statements, repairResult.replacements)
      repairedCount = repairResult.replacements.filter(
        (r) => r.index0 >= 0 && r.index0 < statements.length,
      ).length
    } else {
      const repairSystem = buildTrueFalseThemeRepairSystemPrompt(baseSystem, failed.errors)
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
      statements = full.statements
      repairedCount = statements.length
    }

    validation = validateTrueFalseThemeGeneration({ title, statements, context })
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

  const generated: GeneratedTrueFalseTheme = {
    slotId: input.slot.slotId,
    gameId: "TRUE_FALSE_THEME",
    seed: input.slot.seed,
    title: validation.title,
    universeId: context.universeId,
    statements: validation.statements,
  }

  const engineResult = generateGame("TRUE_FALSE", toTrueFalseThemeEngineInput(generated))
  if (!engineResult.success) {
    const result: ContentGenerationError = {
      ok: false,
      code: "ENGINE_REJECTED",
      message: engineResult.message,
      details: engineResult.validation.errors,
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
