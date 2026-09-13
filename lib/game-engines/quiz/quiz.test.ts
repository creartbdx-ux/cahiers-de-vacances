import assert from "node:assert/strict"
import { test } from "node:test"
import { generateQuiz, isCorrectChoiceHighlighted, sameQuizContent } from "./index"
import type { QuizQuestionInput, QuizSuccess } from "./types"

const VALID: QuizQuestionInput[] = [
  {
    question: "Quel animal siffle dans les alpages ?",
    choices: ["Marmotte", "Aigle", "Chamois", "Bouquetin"],
    correctIndex: 0,
    explanation: "La marmotte siffle pour alerter le groupe.",
  },
  {
    question: "Que désigne un névé ?",
    choices: ["Un glacier entier", "De la neige tassée persistante", "Un torrent", "Un refuge"],
    correctIndex: 1,
  },
]

function expectSuccess(result: ReturnType<typeof generateQuiz>): QuizSuccess {
  assert.equal(result.success, true, JSON.stringify(result))
  return result as QuizSuccess
}

test("validation QUIZ: génération normale", () => {
  const result = expectSuccess(generateQuiz({ questions: VALID, seed: "q1" }))
  assert.equal(result.questions.length, 2)
  assert.equal(result.questions[0].choices.length, 4)
  assert.equal(result.validation.ok, true)
})

test("correctIndex invalide", () => {
  const result = generateQuiz({
    questions: [{ question: "Q ?", choices: ["A", "B", "C", "D"], correctIndex: 4 }],
    seed: "bad-idx",
  })
  assert.equal(result.success, false)
  if (!result.success) assert.equal(result.reason, "VALIDATION_FAILED")
})

test("moins ou plus de 4 réponses", () => {
  const tooFew = generateQuiz({
    questions: [{ question: "Q ?", choices: ["A", "B", "C"], correctIndex: 0 }],
  })
  assert.equal(tooFew.success, false)

  const tooMany = generateQuiz({
    questions: [{ question: "Q ?", choices: ["A", "B", "C", "D", "E"], correctIndex: 0 }],
  })
  assert.equal(tooMany.success, false)
})

test("réponses dupliquées", () => {
  const result = generateQuiz({
    questions: [{ question: "Q ?", choices: ["Neige", "neige", "Glace", "Eau"], correctIndex: 2 }],
  })
  assert.equal(result.success, false)
})

test("question vide", () => {
  const result = generateQuiz({
    questions: [{ question: "   ", choices: ["A", "B", "C", "D"], correctIndex: 0 }],
  })
  assert.equal(result.success, false)
})

test("mode correction conserve exactement le même contenu", () => {
  const result = expectSuccess(generateQuiz({ questions: VALID, seed: "same" }))
  assert.ok(sameQuizContent(result.questions, result.questions))
  for (const q of result.questions) {
    for (let i = 0; i < 4; i++) {
      assert.equal(isCorrectChoiceHighlighted("game", i, q.correctIndex), false)
      assert.equal(isCorrectChoiceHighlighted("solution", i, q.correctIndex), i === q.correctIndex)
    }
  }
  assert.deepEqual(
    result.questions.map((q) => q.choices),
    VALID.map((q) => q.choices.map((c) => c.trim())),
  )
})
