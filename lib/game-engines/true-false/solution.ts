import type { TrueFalseStatement } from "./types"

/** Game vs correction share the exact same structured statements. */
export function sameTrueFalseContent(a: TrueFalseStatement[], b: TrueFalseStatement[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function isTrueFalseAnswerHighlighted(
  mode: "game" | "solution",
  choice: boolean,
  correctAnswer: boolean,
): boolean {
  return mode === "solution" && choice === correctAnswer
}
