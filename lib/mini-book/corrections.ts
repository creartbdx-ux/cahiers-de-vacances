import { QUIZ_CHOICE_LABELS, type QuizSuccess } from "@/lib/game-engines/quiz/types"
import type { CrosswordSuccess } from "@/lib/game-engines/crossword/types"
import type { WordSearchSuccess } from "@/lib/game-engines/wordsearch/types"

/** Pure view-model for compact quiz correction — no IA. */
export type QuizCorrectionItem = {
  index: number
  question: string
  answerLabel: string
  answerText: string
  explanation: string | null
}

export function buildQuizCorrectionItems(quiz: QuizSuccess): QuizCorrectionItem[] {
  return quiz.questions.map((q) => {
    const explanation = q.explanation?.trim() || null
    return {
      index: q.index,
      question: q.question,
      answerLabel: QUIZ_CHOICE_LABELS[q.correctIndex],
      answerText: q.choices[q.correctIndex],
      explanation,
    }
  })
}

export function buildWordsearchCorrectionWords(wordsearch: WordSearchSuccess): string[] {
  return wordsearch.placements.map((p) => p.originalWord)
}

export function buildCrosswordCorrectionAnswers(crossword: CrosswordSuccess): {
  across: Array<{ number: number; answer: string }>
  down: Array<{ number: number; answer: string }>
} {
  return {
    across: crossword.across.map((c) => ({ number: c.number, answer: c.answer })),
    down: crossword.down.map((c) => ({ number: c.number, answer: c.answer })),
  }
}
