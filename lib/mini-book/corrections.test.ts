import assert from "node:assert/strict"
import { test } from "node:test"
import { generateCrossword } from "@/lib/game-engines/crossword"
import { generateQuiz } from "@/lib/game-engines/quiz"
import { generateWordSearch } from "@/lib/game-engines/wordsearch"
import {
  buildCrosswordCorrectionAnswers,
  buildQuizCorrectionItems,
  buildWordsearchCorrectionWords,
} from "./corrections"

test("correction quiz compacte : réponses exactes du jeu, sans régénération", () => {
  const quiz = generateQuiz({
    seed: "corr-quiz",
    questions: [
      {
        question: "Quelle crème ?",
        choices: ["Jour", "Nuit", "Soleil", "Yeux"],
        correctIndex: 1,
        explanation: "La crème de nuit nourrit pendant le sommeil.",
      },
      {
        question: "Quel actif ?",
        choices: ["Eau", "Rétinol", "Farine", "Sel"],
        correctIndex: 1,
      },
    ],
  })
  assert.equal(quiz.success, true)
  if (!quiz.success) return

  const items = buildQuizCorrectionItems(quiz)
  assert.equal(items.length, 2)
  assert.equal(items[0]?.answerLabel, "B")
  assert.equal(items[0]?.answerText, "Nuit")
  assert.equal(items[0]?.explanation, "La crème de nuit nourrit pendant le sommeil.")
  assert.equal(items[1]?.answerLabel, "B")
  assert.equal(items[1]?.explanation, null)

  // Same quiz instance → same answers (no IA path).
  assert.deepEqual(buildQuizCorrectionItems(quiz), items)
})

test("correction wordsearch compacte : mots = placements du jeu", () => {
  const words = [
    "PARIS",
    "ROME",
    "LISBONNE",
    "MADRID",
    "BERLIN",
    "OSLO",
    "VIENNE",
    "PRAGUE",
    "ATHENES",
    "DUBLIN",
  ]
  const ws = generateWordSearch({
    seed: "corr-ws",
    entries: words.map((word) => ({ word })),
    width: 12,
    height: 12,
    minWords: 8,
    targetWords: 10,
    maxWords: 10,
  })
  assert.equal(ws.success, true)
  if (!ws.success) return

  const listed = buildWordsearchCorrectionWords(ws)
  assert.equal(listed.length, ws.placements.length)
  assert.deepEqual(
    listed,
    ws.placements.map((p) => p.originalWord),
  )
})

test("correction crossword compacte : réponses = across/down du jeu", () => {
  const cw = generateCrossword({
    seed: "corr-cw",
    entries: [
      { answer: "CREME", clue: "Soin hydratant" },
      { answer: "ROUGE", clue: "Couleur passion" },
      { answer: "MODE", clue: "Tendance vestimentaire" },
      { answer: "STYLE", clue: "Allure personnelle" },
      { answer: "SOIE", clue: "Tissu luxueux" },
      { answer: "LIN", clue: "Fibre d'été" },
    ],
    minEntries: 4,
    targetEntries: 6,
    maxEntries: 6,
  })
  assert.equal(cw.success, true)
  if (!cw.success) return

  const answers = buildCrosswordCorrectionAnswers(cw)
  assert.deepEqual(
    answers.across.map((a) => a.answer),
    cw.across.map((a) => a.answer),
  )
  assert.deepEqual(
    answers.down.map((a) => a.answer),
    cw.down.map((a) => a.answer),
  )
})
