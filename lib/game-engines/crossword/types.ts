/**
 * Crossword engine — public types.
 *
 * This engine is pure data: it contains NO React and NO rendering logic. It
 * takes a list of answer+clue entries and deterministically builds a connected
 * crossword grid, or reports a structured failure. The origin of the entries
 * (questionnaire, thematic bank, AI, or a mix) is irrelevant to the engine.
 */

/** Raw input entry. `answer` may contain accents, spaces, hyphens, apostrophes. */
export interface CrosswordEntry {
  answer: string
  clue: string
}

/** An entry after normalization, keeping the original for display/debug. */
export interface NormalizedEntry {
  /** Normalized answer: A-Z only, uppercase, no accents/spaces/punctuation. */
  answer: string
  /** Original, untouched answer string. */
  original: string
  clue: string
  length: number
}

export type Orientation = "across" | "down"

/** A word placed on the grid, with its assigned clue number. */
export interface PlacedWord {
  answer: string
  original: string
  clue: string
  row: number
  column: number
  orientation: Orientation
  number: number
  length: number
}

/**
 * A single grid cell. `block` cells are not part of any word. Letter cells
 * always carry their `solution` letter; the player view simply does not render
 * it. `number` is only set on cells that START a word.
 */
export interface CrosswordCell {
  row: number
  column: number
  block: boolean
  solution: string | null
  number: number | null
}

/** A clue entry exposed in the across/down lists. */
export interface CrosswordClue {
  number: number
  clue: string
  answer: string
  row: number
  column: number
  length: number
}

export interface CrosswordStats {
  seed: string
  received: number
  eligible: number
  placed: number
  unused: number
  width: number
  height: number
  crossings: number
  score: number
  /** How many candidate grids were evaluated before choosing the best. */
  candidatesTried: number
}

/** Reason codes for a failed generation. */
export type CrosswordFailureReason =
  | "NOT_ENOUGH_ELIGIBLE_ENTRIES"
  | "NOT_ENOUGH_CONNECTED_ENTRIES"
  | "VALIDATION_FAILED"

export interface CrosswordSuccess {
  success: true
  seed: string
  width: number
  height: number
  cells: CrosswordCell[][]
  across: CrosswordClue[]
  down: CrosswordClue[]
  placedWords: PlacedWord[]
  unusedEntries: NormalizedEntry[]
  stats: CrosswordStats
}

export interface CrosswordFailure {
  success: false
  reason: CrosswordFailureReason
  message: string
  unusedEntries: NormalizedEntry[]
  stats: Partial<CrosswordStats>
}

export type CrosswordResult = CrosswordSuccess | CrosswordFailure

export interface GenerateCrosswordOptions {
  entries: CrosswordEntry[]
  /** Same entries + same seed => exactly the same grid. */
  seed?: string | number
  /** Below this many placed words the result is a failure. Default 4. */
  minEntries?: number
  /** The generator aims for this many placed words. Default 12. */
  targetEntries?: number
  /** Never place more than this many words. Default 15. */
  maxEntries?: number
  /** How many seeded candidate grids to evaluate. Default 60. */
  attempts?: number
}
