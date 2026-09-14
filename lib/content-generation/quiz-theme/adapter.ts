import type { GenerateQuizOptions, QuizQuestionInput } from "@/lib/game-engines/quiz/types"
import type { GeneratedQuizTheme, GeneratedQuizThemeQuestion } from "./types"

/**
 * Adapt QUIZ_THEME content to the existing QUIZ engine input.
 */
export function toQuizThemeEngineInput(
  generated: Pick<GeneratedQuizTheme, "questions" | "seed">,
): GenerateQuizOptions {
  return {
    questions: generated.questions.map((q) => toQuizThemeQuestionInput(q)),
    seed: generated.seed,
  }
}

export function toQuizThemeQuestionInput(q: GeneratedQuizThemeQuestion): QuizQuestionInput {
  return {
    question: q.question,
    choices: [...q.choices],
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }
}
