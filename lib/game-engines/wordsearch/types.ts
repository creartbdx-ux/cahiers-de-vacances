/**
 * Word-search engine — public types.
 *
 * Like the crossword engine, this is PURE DATA: no React, no rendering. It
 * takes a list of words and deterministically fills a rectangular grid where
 * each word is hidden along one of the allowed straight directions, then packs
 * the remaining cells with random letters. The origin of the words
 * (questionnaire, thematic bank, AI, …) is irrelevant to the engine — the AI
 * will later supply words but must NEVER build the grid itself.
 */

/** Raw input entry. `word` may contain accents, spaces, hyphens, apostrophes. */
export interface WordSearchEntry {
  word: string
}

/** A word after normalization, keeping the original for display/debug. */
export interface NormalizedWord {
  /** Normalized: A-Z only, uppercase, no accents/spaces/punctuation. */
  word: string
  /** Original, untouched word string. */
  original: string
  length: number
}

/**
 * Allowed placement directions in V1. Every direction advances the COLUMN
 * (dc = +1) except "S" which advances the ROW — i.e. no reversed words yet.
 * The set is intentionally open so reversed directions (W, N, NW, SW, …) can
 * be added later without touching the algorithm.
 *
 *   E  — horizontal, left → right
 *   S  — vertical, top → bottom
 *   SE — diagonal descending, left → right
 *   NE — diagonal ascending, left → right
 */
export type WordSearchDirection = "E" | "S" | "SE" | "NE"

/** Absolute grid coordinate. */
export interface Coord {
  row: number
  column: number
}

/** A word placed on the grid. `cells` lists the exact path, in reading order. */
export interface Placement {
  originalWord: string
  normalizedWord: string
  row: number
  column: number
  direction: WordSearchDirection
  length: number
  cells: Coord[]
}

export interface WordSearchStats {
  seed: string
  received: number
  eligible: number
  placed: number
  unused: number
  width: number
  height: number
  /** Number of cells shared between two or more placed words. */
  crossings: number
  /** How many words use each direction (diversity signal). */
  orientationCounts: Record<WordSearchDirection, number>
  score: number
  /** How many candidate grids were evaluated before choosing the best. */
  candidatesTried: number
}

/** Reason codes for a failed generation. */
export type WordSearchFailureReason =
  | "NOT_ENOUGH_ELIGIBLE_ENTRIES"
  | "PLACEMENT_FAILED"
  | "VALIDATION_FAILED"

/** Independent validator outcome. */
export interface WordSearchValidation {
  ok: boolean
  errors: string[]
}

export interface WordSearchSuccess {
  success: true
  seed: string
  width: number
  height: number
  /** Fully filled grid: every cell is a single A-Z letter. */
  grid: string[][]
  placements: Placement[]
  unusedEntries: NormalizedWord[]
  stats: WordSearchStats
  validation: WordSearchValidation
}

export interface WordSearchFailure {
  success: false
  reason: WordSearchFailureReason
  message: string
  unusedEntries: NormalizedWord[]
  stats: Partial<WordSearchStats>
}

export type WordSearchResult = WordSearchSuccess | WordSearchFailure

/** Internal candidate produced by the generator, consumed by the validator. */
export interface WordSearchCandidate {
  grid: (string | null)[][]
  filled: string[][]
  placements: Placement[]
  unused: NormalizedWord[]
  width: number
  height: number
  crossings: number
  orientationCounts: Record<WordSearchDirection, number>
  score: number
}

export interface GenerateWordSearchOptions {
  entries: WordSearchEntry[]
  /** Same entries + same seed + same options => exactly the same grid. */
  seed?: string | number
  /** Grid width in cells. Default 12. */
  width?: number
  /** Grid height in cells. Default 12. */
  height?: number
  /** Allowed directions. Default all four V1 directions. */
  directions?: WordSearchDirection[]
  /** Below this many placed words the result is a failure. Default 8. */
  minWords?: number
  /** The generator aims for this many placed words. Default 12. */
  targetWords?: number
  /** Never place more than this many words. Default 15. */
  maxWords?: number
  /** How many seeded candidate grids to evaluate. Default 40. */
  attempts?: number
}
