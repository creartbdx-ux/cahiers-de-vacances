import { generateGame } from "@/lib/game-engines/registry"
import type { QuizSuccess } from "@/lib/game-engines/quiz/types"
import { toQuizThemeEngineInput } from "./adapter"
import type { GeneratedQuizThemeQuestion } from "./types"
import type { QuizThemeQuestionStyle } from "./styles"

export const QUIZ_THEME_PREVIEW_BUILD_ERROR =
  "Impossible de construire l'aperçu quiz avec ce contenu."

/** Lab / action view — questionStyle is a plain string after Server Action round-trip. */
export type QuizThemePreviewQuestion = {
  id: string
  question: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  questionStyle: string
  topicKey: string
  topicLabel: string
}

export type QuizThemePreviewResult =
  | { ok: true; quiz: QuizSuccess }
  | { ok: false; message: string }

/**
 * Deterministic QUIZ preview for Editorial Lab — same questions + seed as generation.
 * Uses the existing QUIZ engine via the theme adapter (no IA).
 */
export function buildQuizThemePreview(
  questions: QuizThemePreviewQuestion[],
  seed: string,
): QuizThemePreviewResult {
  if (!questions.length || !seed.trim()) {
    return { ok: false, message: QUIZ_THEME_PREVIEW_BUILD_ERROR }
  }

  const result = generateGame(
    "QUIZ",
    toQuizThemeEngineInput({
      seed,
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        questionStyle: q.questionStyle as QuizThemeQuestionStyle,
        topicKey: q.topicKey,
        topicLabel: q.topicLabel,
      })),
    }),
  )

  if (!result.success || !result.questions.length) {
    return { ok: false, message: QUIZ_THEME_PREVIEW_BUILD_ERROR }
  }

  return { ok: true, quiz: result }
}
