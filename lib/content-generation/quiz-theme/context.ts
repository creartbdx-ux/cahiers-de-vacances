import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import type { DifficultyLevel } from "@/lib/questionnaire/types"
import {
  formatTopicsForPrompt,
  resolveUniverseEditorial,
  type ResolvedUniverseEditorial,
  type UniverseEditorialFields,
} from "@/lib/universes/editorial"

export const QUIZ_THEME_DEFAULT_QUESTIONS = 6

/** Minimal theme context — never includes personal profile data. */
export interface QuizThemeContext {
  universeId: string
  universeName: string
  editorialDescription: string
  allowedTopics: string[]
  excludedTopics: string[]
  quizGuidance: string | null
  difficulty: DifficultyLevel
  targetQuestions: number
  /** Interest / universe ids from the slot only (theme precision). */
  interestIds: string[]
  hasTopicFrame: boolean
}

export function resolveThemeQuestionCount(slot: EditorialGameSlot): number {
  const req = slot.contentRequirements
  if (req.type === "QUIZ_CONTENT" && typeof req.targetQuestions === "number") {
    return Math.min(10, Math.max(6, req.targetQuestions))
  }
  return QUIZ_THEME_DEFAULT_QUESTIONS
}

/**
 * Build theme context from the editorial slot + universe catalogue row.
 * Does not accept or embed BookProfile.
 */
export function buildQuizThemeContext(input: {
  slot: EditorialGameSlot
  universe?: UniverseEditorialFields | null
  /** @deprecated prefer `universe` — kept for thin call sites */
  universeName?: string | null
}): QuizThemeContext {
  const { slot } = input
  const universeId = input.universe?.id ?? slot.universeId ?? slot.sourceInterestIds[0] ?? ""
  const editorial = resolveUniverseEditorial(input.universe, {
    universeId,
    universeName: input.universe?.name ?? input.universeName,
  })

  return {
    universeId: editorial.universeId || universeId,
    universeName: editorial.universeName,
    editorialDescription: editorial.editorialDescription,
    allowedTopics: editorial.allowedTopics,
    excludedTopics: editorial.excludedTopics,
    quizGuidance: editorial.quizGuidance,
    difficulty: slot.difficulty,
    targetQuestions: resolveThemeQuestionCount(slot),
    interestIds: [...slot.sourceInterestIds],
    hasTopicFrame: editorial.hasTopicFrame,
  }
}

/** Payload sent to the LLM — intentionally free of personal data. */
export function buildQuizThemeUserPayload(ctx: QuizThemeContext): Record<string, unknown> {
  return {
    universeId: ctx.universeId,
    universeName: ctx.universeName,
    editorialDescription: ctx.editorialDescription,
    allowedTopics: ctx.allowedTopics,
    excludedTopics: ctx.excludedTopics,
    ...(ctx.quizGuidance ? { quizGuidance: ctx.quizGuidance } : {}),
    difficulty: ctx.difficulty,
    targetQuestions: ctx.targetQuestions,
    ...(ctx.interestIds.length ? { interestIds: ctx.interestIds } : {}),
  }
}

export function editorialPromptBlock(ctx: QuizThemeContext): string {
  return [
    "L'univers doit être interprété selon sa définition éditoriale ci-dessous,",
    "et non selon toutes les significations possibles de son nom.",
    "",
    `Définition éditoriale : ${ctx.editorialDescription}`,
    "",
    "Sujets autorisés :",
    formatTopicsForPrompt(ctx.allowedTopics),
    "",
    "Sujets exclus :",
    formatTopicsForPrompt(ctx.excludedTopics),
    ...(ctx.quizGuidance
      ? ["", `Guidance quiz : ${ctx.quizGuidance}`]
      : []),
  ].join("\n")
}

/** Assert helpers for tests: payload must not look like a personal profile dump. */
export function themePayloadLooksPersonalFree(payload: unknown): boolean {
  const raw = JSON.stringify(payload).toLowerCase()
  const forbidden = [
    "personalFacts",
    "memories",
    "insideJokes",
    "firstName",
    "email",
    "user_id",
    "storage_path",
    "participantNames",
    "forbiddenTopics",
    "creatorIsParticipant",
  ]
  return !forbidden.some((k) => raw.includes(k.toLowerCase()))
}

export type { ResolvedUniverseEditorial }
