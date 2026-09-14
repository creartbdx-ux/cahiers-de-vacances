import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import type { DifficultyLevel } from "@/lib/questionnaire/types"
import {
  formatTopicsForPrompt,
  resolveUniverseEditorial,
  type UniverseEditorialFields,
} from "@/lib/universes/editorial"
import { themePayloadLooksPersonalFree } from "../quiz-theme/context"

export const CROSSWORD_THEME_DEFAULT_ENTRIES = 10

/** Minimal theme context — never includes personal profile data. */
export interface CrosswordThemeContext {
  universeId: string
  universeName: string
  editorialDescription: string
  allowedTopics: string[]
  excludedTopics: string[]
  editorialGuidance: string | null
  difficulty: DifficultyLevel
  targetEntries: number
  interestIds: string[]
  hasTopicFrame: boolean
}

export function resolveCrosswordThemeEntryCount(slot: EditorialGameSlot): number {
  const req = slot.contentRequirements
  if (req.type === "CROSSWORD_CONTENT" && typeof req.targetEntries === "number") {
    return Math.min(10, Math.max(8, req.targetEntries))
  }
  return CROSSWORD_THEME_DEFAULT_ENTRIES
}

export function buildCrosswordThemeContext(input: {
  slot: EditorialGameSlot
  universe?: UniverseEditorialFields | null
  universeName?: string | null
}): CrosswordThemeContext {
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
    targetEntries: resolveCrosswordThemeEntryCount(slot),
    interestIds: [...slot.sourceInterestIds],
    hasTopicFrame: editorial.hasTopicFrame,
  }
}

export function buildCrosswordThemeUserPayload(
  ctx: CrosswordThemeContext,
): Record<string, unknown> {
  return {
    universeId: ctx.universeId,
    universeName: ctx.universeName,
    editorialDescription: ctx.editorialDescription,
    allowedTopics: ctx.allowedTopics,
    excludedTopics: ctx.excludedTopics,
    ...(ctx.editorialGuidance ? { editorialGuidance: ctx.editorialGuidance } : {}),
    difficulty: ctx.difficulty,
    targetEntries: ctx.targetEntries,
    ...(ctx.interestIds.length ? { interestIds: ctx.interestIds } : {}),
  }
}

export function editorialPromptBlock(ctx: CrosswordThemeContext): string {
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
