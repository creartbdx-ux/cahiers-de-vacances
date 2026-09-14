/** Theme true/false — general knowledge, no personal sourceRefs. */
import type { TrueFalseThemeStatementStyle } from "./styles"

export interface GeneratedTrueFalseThemeStatement {
  id: string
  statement: string
  /** Canonical answer — true = VRAI, false = FAUX. */
  answer: boolean
  explanation: string
  topicKey: string
  topicLabel: string
  statementStyle: TrueFalseThemeStatementStyle
}

export interface GeneratedTrueFalseTheme {
  slotId: string
  gameId: "TRUE_FALSE_THEME"
  seed: string
  title: string
  universeId: string
  statements: GeneratedTrueFalseThemeStatement[]
}

export interface TrueFalseThemeStatementIssue {
  index: number
  errors: string[]
}

export interface TrueFalseThemeValidationSuccess {
  ok: true
  statements: GeneratedTrueFalseThemeStatement[]
  title: string
  topics: string[]
  styles: TrueFalseThemeStatementStyle[]
  styleDistinctCount: number
  trueCount: number
  falseCount: number
  styleDiversityOk: true
  warnings: string[]
}

export interface TrueFalseThemeValidationFailure {
  ok: false
  errors: string[]
  warnings: string[]
  statementIssues: TrueFalseThemeStatementIssue[]
}

export type TrueFalseThemeValidationResult =
  | TrueFalseThemeValidationSuccess
  | TrueFalseThemeValidationFailure
