/**
 * Questionnaire V1 — raw answers vs structured BookProfileV1.
 * Raw questionnaire and profile stay distinct; buildBookProfile never invents data.
 */

export const QUESTIONNAIRE_SCHEMA_VERSION = 1 as const

export type AudienceType = "ME" | "OTHER_PERSON" | "DUO" | "GROUP"

export type DuoType = "COUPLE" | "FRIENDS" | "SIBLINGS" | "PARENT_CHILD" | "OTHER"

export type AgeBracket =
  | "0-12"
  | "13-17"
  | "18-25"
  | "26-35"
  | "36-50"
  | "51-65"
  | "65+"

export type PersonalFactCategory =
  | "FOOD"
  | "DRINK"
  | "MUSIC"
  | "MOVIE_SERIES"
  | "BOOK"
  | "ACTIVITY"
  | "PLACE"
  | "HABIT"
  | "EXPRESSION"
  | "FUNNY_FLAW"
  | "DISLIKE"
  | "OBJECT"
  | "OTHER"

export type GameTypePreference =
  | "CROSSWORD"
  | "WORDSEARCH"
  | "QUIZ"
  | "TRUE_FALSE"
  | "LOGIC"
  | "OBSERVATION"
  | "SUDOKU"
  | "MAZE"
  | "PHOTO"
  | "SURPRISE"

export type DifficultyLevel = 1 | 2 | 3 | 4

export interface QuestionnaireParticipant {
  id: string
  firstName: string
  ageBracket?: AgeBracket
  nickname?: string
  /** OTHER_PERSON only — link to the creator. */
  relationship?: string
  /** GROUP optional short trait. */
  personalTrait?: string
}

export interface PersonalFact {
  id: string
  category: PersonalFactCategory
  value: string
  participantIds?: string[]
}

export interface MemoryEntry {
  id: string
  title?: string
  text: string
  participantIds?: string[]
  place?: string
}

export interface InsideJoke {
  id: string
  text: string
  participantIds?: string[]
}

export interface QuestionnairePhoto {
  id: string
  /** Local preview (data URL) or remote path after upload. */
  previewDataUrl?: string
  storagePath?: string
  fileName?: string
  caption?: string
  anecdote?: string
  participantIds?: string[]
  useAuthorized: boolean
}

export interface ForbiddenTopicsAnswer {
  /** Explicit acknowledgement that the step was answered. */
  answered: true
  hasRestrictions: boolean
  text?: string
  peopleToAvoid?: string
}

export interface VisualPreferences {
  paletteId: string | "AUTO"
  styleId: string | "AUTO"
}

export interface GamePreferences {
  likedTypes: GameTypePreference[]
  difficulty: DifficultyLevel
  dislikedTypes?: GameTypePreference[]
}

export interface PersonalityAnswers {
  /** Traits keyed by participant id (ME / OTHER / DUO). */
  traitsByParticipantId: Record<string, string[]>
  freeText?: string
  duoDescription?: string
  duoDynamics?: string[]
  groupTraits?: string[]
}

/** Raw multi-step questionnaire answers (schema versioned). */
export interface QuestionnaireV1 {
  schemaVersion: typeof QUESTIONNAIRE_SCHEMA_VERSION
  audience: AudienceType | null
  creatorIsParticipant: boolean | null
  duoType?: DuoType
  groupName?: string
  participants: QuestionnaireParticipant[]
  personality: PersonalityAnswers
  interestUniverseIds: string[]
  interestFreeText?: string
  personalFacts: PersonalFact[]
  memories: MemoryEntry[]
  insideJokes: InsideJoke[]
  gamePreferences: Partial<GamePreferences> & { likedTypes?: GameTypePreference[] }
  photos: QuestionnairePhoto[]
  forbiddenTopics: ForbiddenTopicsAnswer | null
  visualPreferences: Partial<VisualPreferences>
  finalMessage?: string
  lastNote?: string
  /** Local draft book project id once created. */
  draftProjectId?: string
}

export interface BookProfileParticipant {
  id: string
  firstName: string
  ageBracket?: AgeBracket
  nickname?: string
  relationship?: string
  personalTrait?: string
}

export interface BookProfileV1 {
  schemaVersion: 1
  audience: AudienceType
  creatorIsParticipant: boolean
  duoType?: DuoType
  groupName?: string
  participants: BookProfileParticipant[]
  sharedProfile: {
    interestUniverseIds: string[]
    interestFreeText?: string
    duoDescription?: string
    duoDynamics?: string[]
    groupTraits?: string[]
    personalityFreeText?: string
  }
  individualProfiles: Array<{
    participantId: string
    traits: string[]
    personalTrait?: string
  }>
  personalFacts: PersonalFact[]
  memories: MemoryEntry[]
  insideJokes: InsideJoke[]
  gamePreferences: GamePreferences
  visualPreferences: VisualPreferences
  forbiddenTopics: ForbiddenTopicsAnswer
  photos: Array<{
    id: string
    storagePath?: string
    caption?: string
    anecdote?: string
    participantIds?: string[]
    useAuthorized: boolean
  }>
  finalMessage?: string
  lastNote?: string
}

export type RichnessLevel = "INSUFFICIENT" | "ENOUGH" | "RICH"

export interface RichnessResult {
  level: RichnessLevel
  missing: string[]
  bonuses: string[]
  message: string
}

export const AGE_BRACKETS: { value: AgeBracket; label: string }[] = [
  { value: "0-12", label: "0–12 ans" },
  { value: "13-17", label: "13–17 ans" },
  { value: "18-25", label: "18–25 ans" },
  { value: "26-35", label: "26–35 ans" },
  { value: "36-50", label: "36–50 ans" },
  { value: "51-65", label: "51–65 ans" },
  { value: "65+", label: "65 ans et +" },
]

export const PERSONALITY_TRAIT_OPTIONS = [
  "complice",
  "taquin",
  "aventurier",
  "tranquille",
  "compétitif",
  "gourmand",
  "fêtard",
  "curieux",
  "rêveur",
  "sportif",
  "créatif",
  "organisé",
  "spontané",
  "sensible",
  "opposés mais complémentaires",
] as const

export const DUO_DYNAMICS_OPTIONS = [
  "complice",
  "taquin",
  "aventurier",
  "tranquille",
  "compétitif",
  "gourmand",
  "fêtard",
  "opposés mais complémentaires",
] as const

export const PERSONAL_FACT_CATEGORIES: { value: PersonalFactCategory; label: string }[] = [
  { value: "FOOD", label: "Nourriture" },
  { value: "DRINK", label: "Boisson" },
  { value: "MUSIC", label: "Musique" },
  { value: "MOVIE_SERIES", label: "Films / séries" },
  { value: "BOOK", label: "Livre" },
  { value: "ACTIVITY", label: "Activité" },
  { value: "PLACE", label: "Lieu" },
  { value: "HABIT", label: "Habitude" },
  { value: "EXPRESSION", label: "Expression" },
  { value: "FUNNY_FLAW", label: "Petit défaut amusant" },
  { value: "DISLIKE", label: "Aversion" },
  { value: "OBJECT", label: "Objet" },
  { value: "OTHER", label: "Autre" },
]

export const GAME_TYPE_OPTIONS: { value: GameTypePreference; label: string }[] = [
  { value: "CROSSWORD", label: "Mots croisés" },
  { value: "WORDSEARCH", label: "Mots mêlés" },
  { value: "QUIZ", label: "Quiz" },
  { value: "TRUE_FALSE", label: "Vrai / faux" },
  { value: "LOGIC", label: "Logique" },
  { value: "OBSERVATION", label: "Observation" },
  { value: "SUDOKU", label: "Sudoku" },
  { value: "MAZE", label: "Labyrinthes" },
  { value: "PHOTO", label: "Jeux photo" },
  { value: "SURPRISE", label: "Surprise / varier" },
]

export const DIFFICULTY_OPTIONS: { value: DifficultyLevel; label: string }[] = [
  { value: 1, label: "1 — Détente" },
  { value: 2, label: "2 — Facile" },
  { value: 3, label: "3 — Un peu challenge" },
  { value: 4, label: "4 — Difficile" },
]

export const DUO_TYPE_OPTIONS: { value: DuoType; label: string }[] = [
  { value: "COUPLE", label: "Couple" },
  { value: "FRIENDS", label: "Ami·es" },
  { value: "SIBLINGS", label: "Frère / sœur" },
  { value: "PARENT_CHILD", label: "Parent / enfant" },
  { value: "OTHER", label: "Autre" },
]

export const MAX_GROUP_SIZE = 10
export const MIN_GROUP_SIZE = 3
export const MIN_INTERESTS = 3
export const MIN_PERSONAL_FACTS = 3
export const MAX_PERSONAL_FACTS = 15
export const MAX_PHOTOS = 10
export const MIN_TRAITS_SOLO = 3
export const MAX_TRAITS_SOLO = 6

export function createEmptyQuestionnaire(): QuestionnaireV1 {
  return {
    schemaVersion: QUESTIONNAIRE_SCHEMA_VERSION,
    audience: null,
    creatorIsParticipant: null,
    participants: [],
    personality: { traitsByParticipantId: {} },
    interestUniverseIds: [],
    personalFacts: [],
    memories: [],
    insideJokes: [],
    gamePreferences: {},
    photos: [],
    forbiddenTopics: null,
    visualPreferences: {},
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
