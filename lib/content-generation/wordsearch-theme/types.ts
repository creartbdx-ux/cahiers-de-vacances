/** Thematic word-search word — normalized by the app, not the LLM. */
export interface GeneratedWordSearchThemeWord {
  display: string
  normalized: string
  topicKey: string
}

export interface GeneratedWordSearchTheme {
  slotId: string
  gameId: "WORDSEARCH_THEME"
  seed: string
  title: string
  universeId: string
  words: GeneratedWordSearchThemeWord[]
}

export interface WordSearchThemeWordIssue {
  index: number
  errors: string[]
}

export interface WordSearchThemeValidationSuccess {
  ok: true
  title: string
  words: GeneratedWordSearchThemeWord[]
  topicKeys: string[]
  topicDistinctCount: number
  topicDiversityOk: boolean
  warnings: string[]
}

export interface WordSearchThemeValidationFailure {
  ok: false
  errors: string[]
  warnings: string[]
  wordIssues: WordSearchThemeWordIssue[]
}

export type WordSearchThemeValidationResult =
  | WordSearchThemeValidationSuccess
  | WordSearchThemeValidationFailure
