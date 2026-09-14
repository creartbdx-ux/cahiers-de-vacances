import assert from "node:assert/strict"
import { test } from "node:test"
import {
  QUIZ_PERSONAL_OUTPUT_SCHEMA,
  coerceQuizPersonalQuestions,
  collectOpenAiStrictSchemaViolations,
} from "./schema"

test("QUIZ_PERSONAL JSON Schema is OpenAI Structured Outputs strict-compatible", () => {
  const violations = collectOpenAiStrictSchemaViolations(
    QUIZ_PERSONAL_OUTPUT_SCHEMA as Parameters<typeof collectOpenAiStrictSchemaViolations>[0],
  )
  assert.deepEqual(violations, [])

  const question = (
    QUIZ_PERSONAL_OUTPUT_SCHEMA.properties as {
      questions: { items: {
        required: string[]
        properties: Record<string, { type?: string | string[] }>
        additionalProperties: boolean
      } }
    }
  ).questions.items

  assert.equal(question.additionalProperties, false)
  assert.ok(question.required.includes("explanation"))
  assert.ok(question.required.includes("id"))
  assert.ok(question.required.includes("question"))
  assert.ok(question.required.includes("choices"))
  assert.ok(question.required.includes("correctIndex"))
  assert.ok(question.required.includes("sourceRefs"))
  assert.deepEqual(
    [...question.required].sort(),
    Object.keys(question.properties).sort(),
  )
  assert.deepEqual(question.properties.explanation?.type, ["string", "null"])

  const sourceRef = (
    question.properties.sourceRefs as {
      items: {
        required: string[]
        properties: Record<string, unknown>
        additionalProperties: boolean
      }
    }
  ).items
  assert.equal(sourceRef.additionalProperties, false)
  assert.deepEqual([...sourceRef.required].sort(), ["id", "type"])
  assert.deepEqual([...sourceRef.required].sort(), Object.keys(sourceRef.properties).sort())
})

test("coerceQuizPersonalQuestions maps explanation null to omitted optional", () => {
  const questions = coerceQuizPersonalQuestions({
    questions: [
      {
        id: "q1",
        question: "Q ?",
        choices: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: null,
        sourceRefs: [{ type: "FACT", id: "f1" }],
      },
      {
        id: "q2",
        question: "Q2 ?",
        choices: ["A", "B", "C", "D"],
        correctIndex: 1,
        explanation: "  Parce que café  ",
        sourceRefs: [{ type: "FACT", id: "f2" }],
      },
    ],
  })
  assert.equal(questions[0]!.explanation, undefined)
  assert.equal(questions[1]!.explanation, "Parce que café")
})
