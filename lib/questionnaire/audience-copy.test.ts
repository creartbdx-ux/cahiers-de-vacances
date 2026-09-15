import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildAudienceCopyContext,
  personalFactCategoryLabel,
  personalFactCategoryOptions,
  recapCopy,
  resolveFactTarget,
} from "./audience-copy"
import { getStepCopy } from "./journey"
import { createEmptyQuestionnaire, newId, type QuestionnaireV1 } from "./types"

function emmaSami(): QuestionnaireV1 {
  const q = createEmptyQuestionnaire()
  q.audience = "OTHER_PERSON"
  q.creatorIsParticipant = false
  q.creatorFirstName = "Emma"
  q.participants = [
    {
      id: newId("p"),
      firstName: "Sami",
      ageBracket: "26-35",
      relationship: "conjoint",
    },
  ]
  return q
}

test("OTHER_PERSON Emma→Sami : détails sans « vous dites »", () => {
  const q = emmaSami()
  const ctx = buildAudienceCopyContext(q)
  assert.equal(ctx.creatorName, "Emma")
  assert.equal(ctx.recipientName, "Sami")

  const options = personalFactCategoryOptions(ctx)
  const blob = options.map((o) => o.label).join(" | ")
  assert.ok(!/que vous dites/i.test(blob), blob)
  assert.ok(options.some((o) => o.value === "EXPRESSION" && /Sami dit souvent/i.test(o.label)))
  assert.ok(options.some((o) => o.value === "FOOD" && /plat préféré de Sami/i.test(o.label)))
  assert.ok(options.some((o) => o.value === "HABIT" && /habitude de Sami/i.test(o.label)))
  assert.ok(options.some((o) => o.value === "OTHER" && /sur Sami/i.test(o.label)))

  assert.match(getStepCopy("personalFacts", q).title, /détails sur Sami/i)
  assert.match(getStepCopy("memories", q).title, /souvenirs avec Sami/i)
  assert.ok(!/à son sujet/i.test(getStepCopy("memories", q).title))
})

test("OTHER_PERSON recap Pour Sami / Créé par Emma", () => {
  const q = emmaSami()
  const r = recapCopy(buildAudienceCopyContext(q))
  assert.equal(r.forTitle, "Pour Sami")
  assert.equal(r.createdBy, "Créé par Emma")
  assert.match(r.title, /prêt à être créé/i)
  assert.ok(!/OTHER_PERSON|creatorFirstName/i.test(JSON.stringify(r)))
})

test("ME : expression « vous dites souvent » reste valide", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "ME"
  q.creatorIsParticipant = true
  q.participants = [{ id: newId("p"), firstName: "Alex", ageBracket: "26-35" }]
  const ctx = buildAudienceCopyContext(q)
  const label = personalFactCategoryLabel("EXPRESSION", ctx, { kind: "SELF" })
  assert.equal(label, "Une expression que vous dites souvent")
  assert.match(getStepCopy("personalFacts", q).title, /détails sur vous/i)
})

test("DUO : cible participant nommée correctement", () => {
  const a = newId("p")
  const b = newId("p")
  const q = createEmptyQuestionnaire()
  q.audience = "DUO"
  q.creatorIsParticipant = true
  q.creatorParticipantId = a
  q.participants = [
    { id: a, firstName: "Emma", ageBracket: "26-35" },
    { id: b, firstName: "Sami", ageBracket: "26-35" },
  ]
  const ctx = buildAudienceCopyContext(q)
  const targetEmma = resolveFactTarget(ctx, [a], q.participants)
  const targetSami = resolveFactTarget(ctx, [b], q.participants)
  const targetDuo = resolveFactTarget(ctx, undefined, q.participants)

  assert.equal(
    personalFactCategoryLabel("EXPRESSION", ctx, targetEmma),
    "Une expression qu'Emma dit souvent",
  )
  assert.equal(
    personalFactCategoryLabel("EXPRESSION", ctx, targetSami),
    "Une expression que Sami dit souvent",
  )
  assert.match(
    personalFactCategoryLabel("HABIT", ctx, targetDuo),
    /habitude que vous avez à deux/i,
  )
})

test("GROUP non participant : pas de « votre groupe » incorrect", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "GROUP"
  q.creatorIsParticipant = false
  q.creatorFirstName = "Emma"
  q.participants = [
    { id: newId("p"), firstName: "A" },
    { id: newId("p"), firstName: "B" },
    { id: newId("p"), firstName: "C" },
  ]
  const ctx = buildAudienceCopyContext(q)
  const collective = resolveFactTarget(ctx, undefined, q.participants)
  const habit = personalFactCategoryLabel("HABIT", ctx, collective)
  const expr = personalFactCategoryLabel("EXPRESSION", ctx, collective)
  assert.ok(!/votre groupe/i.test(habit), habit)
  assert.match(habit, /habitude du groupe/i)
  assert.ok(!/entre vous/i.test(expr), expr)
  assert.match(getStepCopy("memories", q).title, /souvenirs du groupe/i)
  assert.ok(!/votre bande/i.test(getStepCopy("memories", q).title))
})

test("GROUP participant : votre groupe / bande OK", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "GROUP"
  q.creatorIsParticipant = true
  const id = newId("p")
  q.creatorParticipantId = id
  q.participants = [
    { id, firstName: "Emma" },
    { id: newId("p"), firstName: "B" },
    { id: newId("p"), firstName: "C" },
  ]
  assert.match(getStepCopy("memories", q).title, /votre bande/i)
  const ctx = buildAudienceCopyContext(q)
  const habit = personalFactCategoryLabel("HABIT", ctx, { kind: "GROUP" })
  assert.match(habit, /votre groupe/i)
})
