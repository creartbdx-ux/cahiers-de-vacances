import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import type { DifficultyLevel } from "@/lib/questionnaire/types"
import {
  formatTopicsForPrompt,
  resolveUniverseEditorial,
  type UniverseEditorialFields,
} from "@/lib/universes/editorial"

export const TRUE_FALSE_THEME_DEFAULT_STATEMENTS = 8

/** Minimal theme context — never includes personal profile data. */
export interface TrueFalseThemeContext {
  universeId: string
  universeName: string
  editorialDescription: string
  allowedTopics: string[]
  excludedTopics: string[]
  quizGuidance: string | null
  difficulty: DifficultyLevel
  targetStatements: number
  interestIds: string[]
  hasTopicFrame: boolean
}

export function resolveThemeStatementCount(slot: EditorialGameSlot): number {
  const req = slot.contentRequirements
  if (req.type === "TRUE_FALSE_CONTENT" && typeof req.targetStatements === "number") {
    return Math.min(10, Math.max(6, req.targetStatements))
  }
  return TRUE_FALSE_THEME_DEFAULT_STATEMENTS
}

export function buildTrueFalseThemeContext(input: {
  slot: EditorialGameSlot
  universe?: UniverseEditorialFields | null
  universeName?: string | null
}): TrueFalseThemeContext {
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
    targetStatements: resolveThemeStatementCount(slot),
    interestIds: [...slot.sourceInterestIds],
    hasTopicFrame: editorial.hasTopicFrame,
  }
}

export function buildTrueFalseThemeUserPayload(
  ctx: TrueFalseThemeContext,
): Record<string, unknown> {
  return {
    universeId: ctx.universeId,
    universeName: ctx.universeName,
    editorialDescription: ctx.editorialDescription,
    allowedTopics: ctx.allowedTopics,
    excludedTopics: ctx.excludedTopics,
    ...(ctx.quizGuidance ? { quizGuidance: ctx.quizGuidance } : {}),
    difficulty: ctx.difficulty,
    targetStatements: ctx.targetStatements,
    ...(ctx.interestIds.length ? { interestIds: ctx.interestIds } : {}),
  }
}

export function editorialPromptBlock(ctx: TrueFalseThemeContext): string {
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
    ...(ctx.quizGuidance ? ["", `Guidance éditoriale : ${ctx.quizGuidance}`] : []),
  ].join("\n")
}

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
