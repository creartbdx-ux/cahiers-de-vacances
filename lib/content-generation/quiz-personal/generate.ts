import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import { generateGame } from "@/lib/game-engines/registry"
import type { QuizResult } from "@/lib/game-engines/quiz/types"
import type { ContentGenerationError, ContentGenerationProvider } from "../types"
import { createDefaultContentGenerationProvider } from "../provider"
import {
  buildAllowedSourceIds,
  buildQuizPersonalSourceContext,
  countSourceUnits,
  quizPersonalQuestionRange,
} from "../source-context"
import { toQuizEngineInput } from "./adapter"
import {
  buildQuizPersonalRepairSystemPrompt,
  buildQuizPersonalSystemPrompt,
  buildQuizPersonalUserPayload,
} from "./prompt"
import {
  coerceQuizPersonalQuestions,
  isQuizPersonalLlmPayload,
  QUIZ_PERSONAL_OUTPUT_SCHEMA,
} from "./schema"
import { validateQuizPersonalGeneration } from "./validate"
import type { GeneratedQuizPersonal, QuizPersonalValidationResult } from "./types"

export interface GenerateQuizPersonalInput {
  profile: BookProfileV1
  slot: EditorialGameSlot
  bookProjectId?: string
  provider?: ContentGenerationProvider
  /** Max automatic repair attempts after the first generation (0 or 1). */
  maxRepairAttempts?: 0 | 1
}

export interface GenerateQuizPersonalSuccess {
  ok: true
  generated: GeneratedQuizPersonal
  validation: Extract<QuizPersonalValidationResult, { ok: true }>
  engineResult: QuizResult
  sourceSummary: {
    factCount: number
    memoryCount: number
    jokeCount: number
    participantNames: string[]
    questionRange: { min: number; max: number }
    audience: string
    targetParticipantNames: string[]
    creatorIsParticipant: boolean
  }
  durationMs: number
  repaired: boolean
}

export type GenerateQuizPersonalResult = GenerateQuizPersonalSuccess | ContentGenerationError

function logGeneration(meta: {
  bookProjectId?: string
  slotId: string
  gameId: string
  sourceCount: number
  ok: boolean
  durationMs: number
  repaired?: boolean
  code?: string
}): void {
  console.info("[content-generation]", {
    bookProjectId: meta.bookProjectId ?? null,
    slotId: meta.slotId,
    gameId: meta.gameId,
    sourceCount: meta.sourceCount,
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
  | { ok: true; questions: ReturnType<typeof coerceQuizPersonalQuestions> }
  | ContentGenerationError
> {
  const raw = await provider.generateStructured<unknown>({
    system,
    input,
    schemaName: "quiz_personal_v1",
    schema: QUIZ_PERSONAL_OUTPUT_SCHEMA,
    seed,
  })

  if (!raw.ok) return raw

  if (!isQuizPersonalLlmPayload(raw.data)) {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Structure JSON inattendue (questions manquantes).",
    }
  }

  return { ok: true, questions: coerceQuizPersonalQuestions(raw.data) }
}

/**
 * Full QUIZ_PERSONAL pipeline: context → LLM → validate → QUIZ engine.
 * At most one automatic repair attempt.
 */
export async function generateQuizPersonalContent(
  input: GenerateQuizPersonalInput,
): Promise<GenerateQuizPersonalResult> {
  const started = Date.now()
  const provider = input.provider ?? createDefaultContentGenerationProvider()
  const maxRepair = input.maxRepairAttempts ?? 1

  if (input.slot.gameId !== "QUIZ_PERSONAL") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Slot non supporté pour cette étape : ${input.slot.gameId}.`,
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
      sourceCount: 0,
      ok: false,
      durationMs: Date.now() - started,
      code: result.code,
    })
    return result
  }

  const context = buildQuizPersonalSourceContext({
    profile: input.profile,
    slot: input.slot,
  })
  const allowed = buildAllowedSourceIds(input.slot)
  const sourceCount = countSourceUnits(context)
  const questionRange = quizPersonalQuestionRange(sourceCount)

  if (sourceCount === 0) {
    const result: ContentGenerationError = {
      ok: false,
      code: "NO_SOURCES",
      message: "Aucune source autorisée résolue pour ce slot QUIZ_PERSONAL.",
    }
    logGeneration({
      bookProjectId: input.bookProjectId,
      slotId: input.slot.slotId,
      gameId: input.slot.gameId,
      sourceCount: 0,
      ok: false,
      durationMs: Date.now() - started,
      code: result.code,
    })
    return result
  }

  const userPayload = buildQuizPersonalUserPayload(context)
  const baseSystem = buildQuizPersonalSystemPrompt(context)

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
      sourceCount,
      ok: false,
      durationMs: Date.now() - started,
      code: questionsResult.code,
    })
    return questionsResult
  }

  let validation = validateQuizPersonalGeneration({
    questions: questionsResult.questions,
    context,
    allowed,
  })

  if (!validation.ok && maxRepair >= 1) {
    repaired = true
    const repairSystem = buildQuizPersonalRepairSystemPrompt(baseSystem, validation.errors)
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
        sourceCount,
        ok: false,
        durationMs: Date.now() - started,
        repaired: true,
        code: questionsResult.code,
      })
      return questionsResult
    }
    validation = validateQuizPersonalGeneration({
      questions: questionsResult.questions,
      context,
      allowed,
    })
  }

  if (!validation.ok) {
    const result: ContentGenerationError = {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Le contenu généré n'a pas passé la validation métier.",
      details: validation.errors,
    }
    logGeneration({
      bookProjectId: input.bookProjectId,
      slotId: input.slot.slotId,
      gameId: input.slot.gameId,
      sourceCount,
      ok: false,
      durationMs: Date.now() - started,
      repaired,
      code: result.code,
    })
    return result
  }

  const generated: GeneratedQuizPersonal = {
    slotId: input.slot.slotId,
    gameId: "QUIZ_PERSONAL",
    seed: input.slot.seed,
    questions: validation.questions,
  }

  const engineResult = generateGame("QUIZ", toQuizEngineInput(generated))
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
      sourceCount,
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
    sourceCount,
    ok: true,
    durationMs,
    repaired,
  })

  return {
    ok: true,
    generated,
    validation,
    engineResult,
    sourceSummary: {
      factCount: context.facts.length,
      memoryCount: context.memories.length,
      jokeCount: context.jokes.length,
      participantNames: context.participantNames,
      questionRange,
      audience: context.audience,
      targetParticipantNames: context.targetParticipantNames,
      creatorIsParticipant: context.creatorIsParticipant,
    },
    durationMs,
    repaired,
  }
}
