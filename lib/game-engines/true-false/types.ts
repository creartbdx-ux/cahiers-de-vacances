/**
 * True/false engine — public types.
 *
 * Pure data: validates and structures editorial statements. Never invents them.
 */

export interface TrueFalseStatementInput {
  statement: string
  correctAnswer: boolean
  explanation?: string
}

export interface TrueFalseStatement {
  index: number
  statement: string
  correctAnswer: boolean
  explanation?: string
}

export interface TrueFalseValidation {
  ok: boolean
  errors: string[]
}

export interface TrueFalseStats {
  seed: string
  received: number
  validated: number
}

export interface TrueFalseSuccess {
  success: true
  seed: string
  statements: TrueFalseStatement[]
  stats: TrueFalseStats
  validation: TrueFalseValidation
}

export type TrueFalseFailureReason = "NO_STATEMENTS" | "VALIDATION_FAILED"

export interface TrueFalseFailure {
  success: false
  reason: TrueFalseFailureReason
  message: string
  seed: string
  stats: Partial<TrueFalseStats>
  validation: TrueFalseValidation
}

export type TrueFalseResult = TrueFalseSuccess | TrueFalseFailure

export interface GenerateTrueFalseOptions {
  statements: TrueFalseStatementInput[]
  seed?: string | number
}
