import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import type { DifficultyLevel } from "@/lib/questionnaire/types"
import {
  formatTopicsForPrompt,
  resolveUniverseEditorial,
  type UniverseEditorialFields,
} from "@/lib/universes/editorial"
import { themePayloadLooksPersonalFree } from "../quiz-theme/context"

export const WORDSEARCH_THEME_DEFAULT_WORDS = 12

/** Minimal theme context — never includes personal profile data. */
export interface WordSearchThemeContext {
  universeId: string
  universeName: string
  editorialDescription: string
  allowedTopics: string[]
  excludedTopics: string[]
  editorialGuidance: string | null
  difficulty: DifficultyLevel
  targetWords: number
  interestIds: string[]
  hasTopicFrame: boolean
}

export function resolveWordSearchThemeWordCount(slot: EditorialGameSlot): number {
  const req = slot.contentRequirements
  if (req.type === "WORDSEARCH_CONTENT" && typeof req.targetWords === "number") {
    return Math.min(15, Math.max(8, req.targetWords))
  }
  return WORDSEARCH_THEME_DEFAULT_WORDS
}

export function buildWordSearchThemeContext(input: {
  slot: EditorialGameSlot
  universe?: UniverseEditorialFields | null
  universeName?: string | null
}): WordSearchThemeContext {
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
    editorialGuidance: editorial.quizGuidance,
    difficulty: slot.difficulty,
    targetWords: resolveWordSearchThemeWordCount(slot),
    interestIds: [...slot.sourceInterestIds],
    hasTopicFrame: editorial.hasTopicFrame,
  }
}

export function buildWordSearchThemeUserPayload(
  ctx: WordSearchThemeContext,
): Record<string, unknown> {
  return {
    universeId: ctx.universeId,
    universeName: ctx.universeName,
    editorialDescription: ctx.editorialDescription,
    allowedTopics: ctx.allowedTopics,
    excludedTopics: ctx.excludedTopics,
    ...(ctx.editorialGuidance ? { editorialGuidance: ctx.editorialGuidance } : {}),
    difficulty: ctx.difficulty,
    targetWords: ctx.targetWords,
    ...(ctx.interestIds.length ? { interestIds: ctx.interestIds } : {}),
  }
}

export function editorialPromptBlock(ctx: WordSearchThemeContext): string {
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
    ...(ctx.editorialGuidance
      ? ["", `Guidance éditoriale : ${ctx.editorialGuidance}`]
      : []),
  ].join("\n")
}

export { themePayloadLooksPersonalFree }
