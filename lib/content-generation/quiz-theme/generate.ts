import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import type { QuizResult } from "@/lib/game-engines/quiz/types"
import type { UniverseEditorialFields } from "@/lib/universes/editorial"
import type { ContentGenerationError, ContentGenerationProvider } from "../types"
import { createDefaultContentGenerationProvider } from "../provider"
import { toQuizThemeEngineInput } from "./adapter"
import {
  buildQuizThemeContext,
  buildQuizThemeUserPayload,
  type QuizThemeContext,
} from "./context"
import {
  buildQuizThemeSystemPrompt,
  buildQuizThemeTargetedRepairPrompt,
  buildQuizThemeRepairSystemPrompt,
} from "./prompt"
import {
  applyQuizThemeReplacements,
  buildQuizThemeOutputSchema,
  buildQuizThemeRepairOutputSchema,
  coerceQuizThemeQuestions,
  coerceQuizThemeReplacements,
  isQuizThemeLlmPayload,
  isQuizThemeRepairLlmPayload,
} from "./schema"
import { validateQuizThemeGeneration } from "./validate"
import type { GeneratedQuizTheme, QuizThemeValidationResult } from "./types"

export interface GenerateQuizThemeInput {
  slot: EditorialGameSlot
  /** Catalogue universe row (or editorial fields) — preferred source of truth. */
  universe?: UniverseEditorialFields | null
  universeName?: string | null
  bookProjectId?: string
  maxRepairAttempts?: 0 | 1
  provider?: ContentGenerationProvider
}

export interface GenerateQuizThemeSuccess {
  ok: true
  generated: GeneratedQuizTheme
  validation: Extract<QuizThemeValidationResult, { ok: true }>
  engineResult: QuizResult
  context: QuizThemeContext
  durationMs: number
  repaired: boolean
  /** Number of questions replaced during targeted repair (0 if none). */
  repairedCount: number
}

export type GenerateQuizThemeResult = GenerateQuizThemeSuccess | ContentGenerationError

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
  context: QuizThemeContext,
): Promise<
  | { ok: true; title: string; questions: ReturnType<typeof coerceQuizThemeQuestions>["questions"] }
  | ContentGenerationError
> {
  const schema = buildQuizThemeOutputSchema({
    targetQuestions: context.targetQuestions,
    allowedTopics: context.allowedTopics,
  })
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "quiz_theme_v1",
    schema,
    seed,
  })

  if (!raw.ok) return raw

  if (!isQuizThemeLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON inattendue (title/questions manquants).",
    }
  }

  const coerced = coerceQuizThemeQuestions(raw.data)
  return { ok: true, title: coerced.title, questions: coerced.questions }
}

async function callTargetedRepair(
  provider: ContentGenerationProvider,
  system: string,
  input: unknown,
  seed: string,
  context: QuizThemeContext,
  invalidIndexes1Based: number[],
): Promise<
  | { ok: true; replacements: ReturnType<typeof coerceQuizThemeReplacements> }
  | ContentGenerationError
> {
  const schema = buildQuizThemeRepairOutputSchema({
    invalidIndexes1Based,
    allowedTopics: context.allowedTopics,
  })
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "quiz_theme_repair_v1",
    schema,
    seed,
  })

  if (!raw.ok) return raw

  if (!isQuizThemeRepairLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON de réparation inattendue (replacements manquants).",
    }
  }

  return { ok: true, replacements: coerceQuizThemeReplacements(raw.data) }
}

/**
 * Full QUIZ_THEME pipeline: theme context → LLM → validate → targeted repair → QUIZ engine.
 * At most one automatic repair attempt.
 */
export async function generateQuizThemeContent(
  input: GenerateQuizThemeInput,
): Promise<GenerateQuizThemeResult> {
  const started = Date.now()
  const provider = input.provider ?? createDefaultContentGenerationProvider()
  const maxRepair = input.maxRepairAttempts ?? 1

  if (input.slot.gameId !== "QUIZ_THEME") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Slot non supporté pour QUIZ_THEME : ${input.slot.gameId}.`,
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

  const context = buildQuizThemeContext({
    slot: input.slot,
    universe: input.universe,
    universeName: input.universeName,
  })

  if (!context.universeId && !context.universeName) {
    return {
      ok: false,
      code: "NO_SOURCES",
      message: "Aucun univers/thème disponible pour ce slot QUIZ_THEME.",
    }
  }

  const userPayload = buildQuizThemeUserPayload(context)
  const baseSystem = buildQuizThemeSystemPrompt(context)

  let repaired = false
  let repairedCount = 0
  let title = ""
  let questions: ReturnType<typeof coerceQuizThemeQuestions>["questions"] = []

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
  questions = first.questions

  let validation = validateQuizThemeGeneration({ title, questions, context })

  if (!validation.ok && maxRepair >= 1) {
    repaired = true
    const failed = validation
    const issues = failed.questionIssues
    const invalidIndexes = [...new Set(issues.map((i) => i.index))].sort((a, b) => a - b)

    if (invalidIndexes.length > 0 && invalidIndexes.length < questions.length) {
      const invalidIndexes1Based = invalidIndexes.map((i) => i + 1)
      const keptQuestions = questions
        .map((q, i) => ({ index1: i + 1, question: q }))
        .filter((_, i) => !invalidIndexes.includes(i))
      const invalid = invalidIndexes.map((idx) => ({
        index1: idx + 1,
        errors: issues.find((qi) => qi.index === idx)?.errors ?? failed.errors,
      }))

      const repairSystem = buildQuizThemeTargetedRepairPrompt({
        baseSystem,
        keptQuestions,
        invalid,
        usedStyles: keptQuestions.map((k) => k.question.questionStyle),
        usedTopicKeys: keptQuestions.map((k) => k.question.topicKey),
      })

      const repairResult = await callTargetedRepair(
        provider,
        repairSystem,
        {
          ...userPayload,
          keepUnchanged: keptQuestions.map((k) => ({
            index: k.index1,
            id: k.question.id,
            questionStyle: k.question.questionStyle,
            topicKey: k.question.topicKey,
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

      const before = questions.map((q) => q.id)
      questions = applyQuizThemeReplacements(questions, repairResult.replacements)
      repairedCount = repairResult.replacements.filter(
        (r) => r.index0 >= 0 && r.index0 < before.length,
      ).length
    } else {
      // Fallback: full regeneration when every question is bad or issues are not attributable
      const repairSystem = buildQuizThemeRepairSystemPrompt(baseSystem, failed.errors)
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
      questions = full.questions
      repairedCount = questions.length
    }

    validation = validateQuizThemeGeneration({ title, questions, context })
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

  const generated: GeneratedQuizTheme = {
    slotId: input.slot.slotId,
    gameId: "QUIZ_THEME",
    seed: input.slot.seed,
    title: validation.title,
    universeId: context.universeId,
    questions: validation.questions,
  }

  const engineResult = generateGame("QUIZ", toQuizThemeEngineInput(generated))
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
