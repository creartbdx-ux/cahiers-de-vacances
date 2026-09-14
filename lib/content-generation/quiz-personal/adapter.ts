import type { GenerateQuizOptions, QuizQuestionInput } from "@/lib/game-engines/quiz/types"
import type { GeneratedQuizPersonal, GeneratedQuizPersonalQuestion } from "./types"

/**
 * Adapt generated QUIZ_PERSONAL content to the existing QUIZ engine input.
 * Does not duplicate engine validation — call generateGame("QUIZ", …) after.
 */
export function toQuizEngineInput(
  generated: Pick<GeneratedQuizPersonal, "questions" | "seed">,
): GenerateQuizOptions {
  const questions: QuizQuestionInput[] = generated.questions.map((q) => toQuizQuestionInput(q))
  return {
    questions,
    seed: generated.seed,
  }
}

export function toQuizQuestionInput(q: GeneratedQuizPersonalQuestion): QuizQuestionInput {
  return {
    question: q.question,
    choices: [...q.choices],
    correctIndex: q.correctIndex,
    ...(q.explanation ? { explanation: q.explanation } : {}),
  }
}
