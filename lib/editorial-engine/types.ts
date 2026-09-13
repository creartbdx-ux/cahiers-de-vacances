/**
 * Editorial Engine V1 — plan a deterministic game selection from BookProfileV1.
 * Does NOT generate crossword/quiz content or call any AI.
 */

import type { BookProfileV1, DifficultyLevel, RichnessLevel } from "@/lib/questionnaire/types"
import type { Game } from "@/lib/supabase/types"

export const EDITORIAL_PLAN_VERSION = 1 as const

export const EDITORIAL_V1_GAME_IDS = [
  "CROSSWORD_PERSONAL",
  "CROSSWORD_THEME",
  "WORDSEARCH_PERSONAL",
  "WORDSEARCH_THEME",
  "QUIZ_PERSONAL",
  "QUIZ_THEME",
  "TRUE_FALSE_PERSONAL",
] as const

export type EditorialV1GameId = (typeof EDITORIAL_V1_GAME_IDS)[number]

export type PersonalizationType = "PERSONAL" | "THEME"

export type ContentRequirementType =
  | "CROSSWORD_CONTENT"
  | "WORDSEARCH_CONTENT"
  | "QUIZ_CONTENT"
  | "TRUE_FALSE_CONTENT"

export type ContentRequirements =
  | {
      type: "CROSSWORD_CONTENT"
      targetEntries: number
      answerMinLength: number
      answerMaxLength: number
      requirePersonalSource: boolean
      universeId?: string | null
    }
  | {
      type: "WORDSEARCH_CONTENT"
      targetWords: number
      requirePersonalSource: boolean
      universeId?: string | null
    }
  | {
      type: "QUIZ_CONTENT"
      targetQuestions: number
      choicesPerQuestion: number
      requirePersonalSource: boolean
      universeId?: string | null
    }
  | {
      type: "TRUE_FALSE_CONTENT"
      targetStatements: number
      requirePersonalSource: boolean
      universeId?: string | null
    }

export interface EditorialGameSlot {
  slotId: string
  gameId: EditorialV1GameId
  gameName: string
  technicalEngine: string
  personalizationType: PersonalizationType
  templateId: string
  universeId: string | null
  difficulty: DifficultyLevel
  sourceParticipantIds: string[]
  sourceMemoryIds: string[]
  sourceFactIds: string[]
  sourceInterestIds: string[]
  sourceJokeIds: string[]
  contentRequirements: ContentRequirements
  reason: string
  priority: number
  seed: string
}

export interface RejectedGame {
  gameId: string
  reason: string
}

export interface EditorialPlanStats {
  slotCount: number
  personalCount: number
  themeCount: number
  personalRatio: number
  targetPersonalRatio: number
  universesUsed: string[]
  personalSourcesUsed: {
    factIds: string[]
    memoryIds: string[]
    participantIds: string[]
    jokeIds: string[]
  }
  consecutiveSameGameAvoided: number
  universeRepetitions: number
}

export interface EditorialProfileSummary {
  audience: BookProfileV1["audience"]
  participantCount: number
  richnessLevel: RichnessLevel
  interestUniverseIds: string[]
  factCount: number
  memoryCount: number
  difficulty: DifficultyLevel
  hasForbiddenTopics: boolean
}

export interface EditorialPlanV1 {
  version: typeof EDITORIAL_PLAN_VERSION
  seed: string
  profileSummary: EditorialProfileSummary
  selectedGames: EditorialGameSlot[]
  rejectedGames: RejectedGame[]
  stats: EditorialPlanStats
  /** Forbidden topics carried for future content generation. */
  forbiddenTopics: BookProfileV1["forbiddenTopics"]
}

export interface BuildEditorialPlanInput {
  profile: BookProfileV1
  seed: string | number
  games: Game[]
  richnessLevel: RichnessLevel
  /** Soft cap for V1 lab validation (default 8). */
  maxSlots?: number
}

/** Extracted / filtered inventory used by eligibility + planner. */
export interface SourceInventory {
  crosswordAnswers: SourceCandidate[]
  wordsearchWords: SourceCandidate[]
  quizFacts: SourceCandidate[]
  trueFalseFacts: SourceCandidate[]
  interests: string[]
  participants: { id: string; firstName: string }[]
}

export interface SourceCandidate {
  kind: "fact" | "memory" | "joke" | "participant" | "interest" | "trait"
  id: string
  label: string
  participantIds: string[]
  /** True when suitable as a short crossword/wordsearch answer. */
  shortAnswer: boolean
}
