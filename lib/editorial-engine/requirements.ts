import type { ContentRequirements, EditorialV1GameId, PersonalizationType } from "./types"

export const ENGINE_TEMPLATE_IDS: Record<string, string> = {
  CROSSWORD: "CROSSWORD_01",
  WORDSEARCH: "WORDSEARCH_01",
  QUIZ: "QUIZ_01",
  TRUE_FALSE: "TRUE_FALSE_01",
}

export function templateForEngine(technicalEngine: string): string | null {
  return ENGINE_TEMPLATE_IDS[technicalEngine] ?? null
}

export function buildContentRequirements(
  gameId: EditorialV1GameId,
  personalizationType: PersonalizationType,
  universeId: string | null,
): ContentRequirements {
  const personal = personalizationType === "PERSONAL"
  switch (gameId) {
    case "CROSSWORD_PERSONAL":
    case "CROSSWORD_THEME":
      return {
        type: "CROSSWORD_CONTENT",
        targetEntries: 10,
        answerMinLength: 3,
        answerMaxLength: 12,
        requirePersonalSource: personal,
        universeId: personal ? null : universeId,
      }
    case "WORDSEARCH_PERSONAL":
    case "WORDSEARCH_THEME":
      return {
        type: "WORDSEARCH_CONTENT",
        targetWords: 12,
        requirePersonalSource: personal,
        universeId: personal ? null : universeId,
      }
    case "QUIZ_PERSONAL":
      return {
        type: "QUIZ_CONTENT",
        targetQuestions: 8,
        choicesPerQuestion: 4,
        requirePersonalSource: true,
        universeId: null,
      }
    case "QUIZ_THEME":
      return {
        type: "QUIZ_CONTENT",
        targetQuestions: 6,
        choicesPerQuestion: 4,
        requirePersonalSource: false,
        universeId,
      }
    case "TRUE_FALSE_PERSONAL":
      return {
        type: "TRUE_FALSE_CONTENT",
        targetStatements: 8,
        requirePersonalSource: true,
        universeId: null,
      }
    case "TRUE_FALSE_THEME":
      return {
        type: "TRUE_FALSE_CONTENT",
        targetStatements: 8,
        requirePersonalSource: false,
        universeId,
      }
  }
}

/** Minimum candidates required for PERSONAL eligibility. */
export const PERSONAL_THRESHOLDS = {
  CROSSWORD_PERSONAL: { min: 6, ideal: 10 },
  WORDSEARCH_PERSONAL: { min: 8, ideal: 12 },
  QUIZ_PERSONAL: { min: 4, ideal: 8 },
  TRUE_FALSE_PERSONAL: { min: 4, ideal: 8 },
} as const

export function targetPersonalRatio(richness: "INSUFFICIENT" | "ENOUGH" | "RICH"): number {
  if (richness === "RICH") return 0.6
  if (richness === "ENOUGH") return 0.5
  return 0.25
}
