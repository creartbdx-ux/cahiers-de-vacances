import type { QuizQuestion } from "./types"

/** Game vs correction share the exact same structured questions. */
export function sameQuizContent(a: QuizQuestion[], b: QuizQuestion[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function isCorrectChoiceHighlighted(
  mode: "game" | "solution",
  choiceIndex: number,
  correctIndex: number,
): boolean {
  return mode === "solution" && choiceIndex === correctIndex
}
