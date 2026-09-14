import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import type { DifficultyLevel } from "@/lib/questionnaire/types"

export const QUIZ_THEME_DEFAULT_QUESTIONS = 6

/** Minimal theme context — never includes personal profile data. */
export interface QuizThemeContext {
  universeId: string
  universeName: string
  difficulty: DifficultyLevel
  targetQuestions: number
  /** Interest / universe ids from the slot only (theme precision). */
  interestIds: string[]
}

export function resolveThemeQuestionCount(slot: EditorialGameSlot): number {
  const req = slot.contentRequirements
  if (req.type === "QUIZ_CONTENT" && typeof req.targetQuestions === "number") {
    return Math.min(10, Math.max(6, req.targetQuestions))
  }
  return QUIZ_THEME_DEFAULT_QUESTIONS
}

/**
 * Build theme context from the editorial slot + universe catalogue name.
 * Does not accept or embed BookProfile.
 */
export function buildQuizThemeContext(input: {
  slot: EditorialGameSlot
  universeName?: string | null
}): QuizThemeContext {
  const { slot } = input
  const universeId = slot.universeId ?? slot.sourceInterestIds[0] ?? ""
  const name =
    input.universeName?.trim() ||
    universeId ||
    "Thème général"

  return {
    universeId,
    universeName: name,
    difficulty: slot.difficulty,
    targetQuestions: resolveThemeQuestionCount(slot),
    interestIds: [...slot.sourceInterestIds],
  }
}

/** Payload sent to the LLM — intentionally free of personal data. */
export function buildQuizThemeUserPayload(ctx: QuizThemeContext): Record<string, unknown> {
  return {
    universeId: ctx.universeId,
    universeName: ctx.universeName,
    difficulty: ctx.difficulty,
    targetQuestions: ctx.targetQuestions,
    ...(ctx.interestIds.length ? { interestIds: ctx.interestIds } : {}),
  }
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
