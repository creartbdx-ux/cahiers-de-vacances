/** Thematic crossword entry — answer normalized by the app, not the LLM. */
export interface GeneratedCrosswordThemeEntry {
  answer: string
  normalized: string
  clue: string
  topicKey: string
  topicLabel: string
}

export interface GeneratedCrosswordTheme {
  slotId: string
  gameId: "CROSSWORD_THEME"
  seed: string
  title: string
  universeId: string
  entries: GeneratedCrosswordThemeEntry[]
}

export interface CrosswordThemeEntryIssue {
  index: number
  errors: string[]
}

export interface CrosswordThemeValidationSuccess {
  ok: true
  title: string
  entries: GeneratedCrosswordThemeEntry[]
  topicKeys: string[]
  topicDistinctCount: number
  topicDiversityOk: boolean
  warnings: string[]
}

export interface CrosswordThemeValidationFailure {
  ok: false
  errors: string[]
  warnings: string[]
  entryIssues: CrosswordThemeEntryIssue[]
}

export type CrosswordThemeValidationResult =
  | CrosswordThemeValidationSuccess
  | CrosswordThemeValidationFailure
