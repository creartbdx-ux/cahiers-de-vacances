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
  /** ISO date YYYY-MM-DD when known — strong editorial value, never required. */
  birthDate?: string
  /** Approximate current age when birth date unknown. */
  approximateAge?: number
  nickname?: string
  /** OTHER_PERSON only — link to the creator. */
  relationship?: string
  /** GROUP optional short trait. */
  personalTrait?: string
}

/** Light personalization — first names that enrich games without deep anecdotes. */
export interface ClosePerson {
  id: string
  firstName: string
  relationship?: string
}

/** Optional life-context toggles — never an administrative form. */
export interface LifeContext {
  hasChildren?: boolean
  childrenCount?: number
  childrenNames?: string[]
  inCouple?: boolean
  hasFamilyNearby?: boolean
  hasPet?: boolean
  petNames?: string[]
  livingSituation?: "ALONE" | "WITH_SOMEONE" | "OTHER" | "UNKNOWN"
  notes?: string
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

export type PhotoUploadStatus = "local" | "uploading" | "persisted" | "error"

export interface QuestionnairePhoto {
  id: string
  /** Local object URL / signed URL for preview — never treated as server persistence. */
  previewDataUrl?: string
  /** Set only when the file exists in Storage and a book_photos row is linked. */
  storagePath?: string
  fileName?: string
  caption?: string
  anecdote?: string
  participantIds?: string[]
  useAuthorized: boolean
  /** Optional place when known (album / timeline) — never invented. */
  place?: string
  /** Optional taken-at date/year when known — never invented. */
  takenAt?: string
  /** Client upload lifecycle; omit or "local" until Storage + book_photos succeed. */
  uploadStatus?: PhotoUploadStatus
  /** User-facing upload error only (never raw gateway/Supabase messages). */
  uploadError?: string
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
  /**
   * Explicit creator first name when the creator is NOT a participant
   * (OTHER_PERSON, or DUO/GROUP with creatorIsParticipant=false).
   * Optional on legacy drafts — required for new completions.
   */
  creatorFirstName?: string | null
  /**
   * Which participant is the creator when creatorIsParticipant=true (DUO/GROUP).
   * ME derives from participants[0]; OTHER_PERSON leaves null.
   */
  creatorParticipantId?: string | null
  duoType?: DuoType
  groupName?: string
  participants: QuestionnaireParticipant[]
  personality: PersonalityAnswers
  interestUniverseIds: string[]
  interestFreeText?: string
  personalFacts: PersonalFact[]
  memories: MemoryEntry[]
  insideJokes: InsideJoke[]
  /** Optional close people (LIGHT personalization). */
  closePeople?: ClosePerson[]
  /** Optional life context toggles (LIGHT personalization). */
  lifeContext?: LifeContext
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
  birthDate?: string
  approximateAge?: number
  nickname?: string
  relationship?: string
  personalTrait?: string
}

/** Explicit creator identity — firstName null on legacy profiles only. */
export interface BookProfileCreator {
  firstName: string | null
  isParticipant: boolean
  participantId: string | null
}

export interface BookProfileV1 {
  schemaVersion: 1
  audience: AudienceType
  creatorIsParticipant: boolean
  /**
   * Explicit creator identity. Optional only for legacy stored profiles;
   * buildBookProfile always emits it. Readers should use normalizeBookProfileCreator().
   */
  creator?: BookProfileCreator
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
  /** Optional close people (LIGHT personalization). */
  closePeople?: ClosePerson[]
  /** Optional life context (LIGHT personalization). */
  lifeContext?: LifeContext
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

/**
 * Personalization depth available from questionnaire matter.
 * Describes possible personalization — never book quality.
 */
export type PersonalizationDepth = "LIGHT" | "PERSONALIZED" | "RICH"

/**
 * Stored / API richness level.
 * Prefer PersonalizationDepth. Legacy INSUFFICIENT/ENOUGH accepted via normalize.
 */
export type RichnessLevel = PersonalizationDepth | "INSUFFICIENT" | "ENOUGH"

export interface RichnessResult {
  /** Canonical depth — never INSUFFICIENT/ENOUGH after calculateProfileRichness. */
  level: PersonalizationDepth
  /** Alias of level for callers migrating to depth wording. */
  depth: PersonalizationDepth
  /** True when CORE fields are present — book can be created. */
  canCreate: boolean
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
  "drôle",
  "calme",
  "solaire",
  "créatif",
  "compétitif",
  "aventurier",
  "gourmand",
  "organisé",
  "bordélique",
  "sociable",
  "réservé",
  "curieux",
  "sportif",
  "rêveur",
  "tête en l'air",
  "spontané",
  "sensible",
  "taquin",
] as const

/** Relation / duo dynamics — never shown as solo individual traits. */
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

/** Traits usable for group description (can overlap dynamics, not "opposés…"). */
export const GROUP_TRAIT_OPTIONS = [
  "complice",
  "taquin",
  "aventurier",
  "tranquille",
  "compétitif",
  "gourmand",
  "fêtard",
  "sociable",
  "sportif",
  "créatif",
] as const

export const PERSONAL_FACT_CATEGORIES: {
  value: PersonalFactCategory
  label: string
  placeholder: string
}[] = [
  { value: "FOOD", label: "Nourriture préférée", placeholder: "Ex. pâtes carbonara" },
  { value: "DRINK", label: "Boisson préférée", placeholder: "Ex. café latte" },
  { value: "MUSIC", label: "Musique ou artiste", placeholder: "Ex. Queen" },
  { value: "MOVIE_SERIES", label: "Film ou série", placeholder: "Ex. Friends" },
  { value: "BOOK", label: "Livre", placeholder: "Ex. un polar le soir" },
  { value: "ACTIVITY", label: "Une activité", placeholder: "Ex. randonnée" },
  { value: "PLACE", label: "Un lieu que vous adorez", placeholder: "Ex. le bassin d'Arcachon" },
  {
    value: "HABIT",
    label: "Une petite habitude",
    placeholder: "Ex. impossible de commencer la journée sans café",
  },
  {
    value: "EXPRESSION",
    label: "Une expression que vous dites souvent",
    placeholder: "Ex. On verra demain",
  },
  { value: "DISLIKE", label: "Une chose que vous détestez", placeholder: "Ex. être en retard" },
  {
    value: "FUNNY_FLAW",
    label: "Un petit défaut amusant",
    placeholder: "Ex. oublie toujours ses clés",
  },
  { value: "OBJECT", label: "Un objet fétiche", placeholder: "Ex. un carnet de voyage" },
  { value: "OTHER", label: "Autre", placeholder: "Ex. un détail qui vous définit" },
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
  { value: 1, label: "Détente" },
  { value: 2, label: "Facile" },
  { value: 3, label: "Un peu challenge" },
  { value: 4, label: "Difficile" },
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
/** CORE minimum — a few interests are enough; ideal is ~3. */
export const MIN_INTERESTS = 1
export const IDEAL_INTERESTS = 3
/** Deep personalization — never required for book creation. */
export const MIN_PERSONAL_FACTS = 0
export const MAX_PERSONAL_FACTS = 15
export const MAX_PHOTOS = 10
/** CORE minimum — 1–2 traits OK; ideal is 3–6. */
export const MIN_TRAITS_SOLO = 1
export const IDEAL_TRAITS_SOLO = 3
export const MAX_TRAITS_SOLO = 6

export function createEmptyQuestionnaire(): QuestionnaireV1 {
  return {
    schemaVersion: QUESTIONNAIRE_SCHEMA_VERSION,
    audience: null,
    creatorIsParticipant: null,
    creatorFirstName: null,
    creatorParticipantId: null,
    participants: [],
    personality: { traitsByParticipantId: {} },
    interestUniverseIds: [],
    personalFacts: [],
    memories: [],
    insideJokes: [],
    closePeople: [],
    lifeContext: undefined,
    gamePreferences: {},
    photos: [],
    forbiddenTopics: null,
    visualPreferences: {},
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
