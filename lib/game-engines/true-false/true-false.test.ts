import assert from "node:assert/strict"
import { test } from "node:test"
import { generateTrueFalse, isTrueFalseAnswerHighlighted, sameTrueFalseContent } from "./index"
import type { TrueFalseStatementInput, TrueFalseSuccess } from "./types"

const VALID: TrueFalseStatementInput[] = [
  {
    statement: "L'aigle royal niche en montagne.",
    correctAnswer: true,
    explanation: "Il affectionne les falaises d'altitude.",
  },
  {
    statement: "Un glacier avance toujours vers le sommet.",
    correctAnswer: false,
  },
]

function expectSuccess(result: ReturnType<typeof generateTrueFalse>): TrueFalseSuccess {
  assert.equal(result.success, true, JSON.stringify(result))
  return result as TrueFalseSuccess
}

test("validation TRUE_FALSE: génération normale", () => {
  const result = expectSuccess(generateTrueFalse({ statements: VALID, seed: "tf1" }))
  assert.equal(result.statements.length, 2)
  assert.equal(result.validation.ok, true)
})

test("affirmation vide", () => {
  const result = generateTrueFalse({
    statements: [{ statement: "  ", correctAnswer: true }],
  })
  assert.equal(result.success, false)
})

test("doublons TRUE_FALSE", () => {
  const result = generateTrueFalse({
    statements: [
      { statement: "La neige est blanche.", correctAnswer: true },
      { statement: "la neige est blanche.", correctAnswer: false },
    ],
  })
  assert.equal(result.success, false)
})

test("correctAnswer manquant", () => {
  const result = generateTrueFalse({
    // @ts-expect-error intentional missing boolean
    statements: [{ statement: "Test." }],
  })
  assert.equal(result.success, false)
})

test("mode correction conserve exactement le même contenu (TRUE_FALSE)", () => {
  const result = expectSuccess(generateTrueFalse({ statements: VALID, seed: "geo" }))
  assert.ok(sameTrueFalseContent(result.statements, result.statements))
  for (const s of result.statements) {
    assert.equal(isTrueFalseAnswerHighlighted("game", true, s.correctAnswer), false)
    assert.equal(isTrueFalseAnswerHighlighted("game", false, s.correctAnswer), false)
    assert.equal(isTrueFalseAnswerHighlighted("solution", true, s.correctAnswer), s.correctAnswer === true)
    assert.equal(isTrueFalseAnswerHighlighted("solution", false, s.correctAnswer), s.correctAnswer === false)
  }
  assert.deepEqual(
    result.statements.map((s) => s.statement),
    VALID.map((s) => s.statement.trim()),
  )
})
