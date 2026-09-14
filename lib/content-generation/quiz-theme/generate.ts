import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import type { QuizResult } from "@/lib/game-engines/quiz/types"
import type { ContentGenerationError, ContentGenerationProvider } from "../types"
import { createDefaultContentGenerationProvider } from "../provider"
import { toQuizThemeEngineInput } from "./adapter"
import {
  buildQuizThemeContext,
  buildQuizThemeUserPayload,
  type QuizThemeContext,
} from "./context"
import {
  buildQuizThemeRepairSystemPrompt,
  buildQuizThemeSystemPrompt,
} from "./prompt"
import {
  coerceQuizThemeQuestions,
  isQuizThemeLlmPayload,
  QUIZ_THEME_OUTPUT_SCHEMA,
} from "./schema"
import { validateQuizThemeGeneration } from "./validate"
import type { GeneratedQuizTheme, QuizThemeValidationResult } from "./types"

export interface GenerateQuizThemeInput {
  slot: EditorialGameSlot
  universeName?: string | null
  bookProjectId?: string
  provider?: ContentGenerationProvider
  maxRepairAttempts?: 0 | 1
}

export interface GenerateQuizThemeSuccess {
  ok: true
  generated: GeneratedQuizTheme
  validation: Extract<QuizThemeValidationResult, { ok: true }>
  engineResult: QuizResult
  context: QuizThemeContext
  durationMs: number
  repaired: boolean
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
    code: meta.code ?? null,
  })
}

async function callProviderOnce(
  provider: ContentGenerationProvider,
  system: string,
  input: unknown,
  seed: string,
): Promise<
  | { ok: true; title: string; questions: ReturnType<typeof coerceQuizThemeQuestions>["questions"] }
  | ContentGenerationError
> {
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "quiz_theme_v1",
    schema: QUIZ_THEME_OUTPUT_SCHEMA,
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

/**
 * Full QUIZ_THEME pipeline: theme context → LLM → validate → QUIZ engine.
 * No BookProfile. At most one automatic repair attempt.
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
  let questionsResult = await callProviderOnce(
    provider,
    baseSystem,
    userPayload,
    input.slot.seed,
  )

  if (!questionsResult.ok) {
    logGeneration({
      bookProjectId: input.bookProjectId,
      slotId: input.slot.slotId,
      gameId: input.slot.gameId,
      universeId: context.universeId,
      ok: false,
      durationMs: Date.now() - started,
      code: questionsResult.code,
    })
    return questionsResult
  }

  let validation = validateQuizThemeGeneration({
    title: questionsResult.title,
    questions: questionsResult.questions,
    context,
  })

  if (!validation.ok && maxRepair >= 1) {
    repaired = true
    const repairSystem = buildQuizThemeRepairSystemPrompt(baseSystem, validation.errors)
    questionsResult = await callProviderOnce(
      provider,
      repairSystem,
      userPayload,
      `${input.slot.seed}:repair`,
    )
    if (!questionsResult.ok) {
      logGeneration({
        bookProjectId: input.bookProjectId,
        slotId: input.slot.slotId,
        gameId: input.slot.gameId,
        universeId: context.universeId,
        ok: false,
        durationMs: Date.now() - started,
        repaired: true,
        code: questionsResult.code,
      })
      return questionsResult
    }
    validation = validateQuizThemeGeneration({
      title: questionsResult.title,
      questions: questionsResult.questions,
      context,
    })
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
  })

  return {
    ok: true,
    generated,
    validation,
    engineResult,
    context,
    durationMs,
    repaired,
  }
}
