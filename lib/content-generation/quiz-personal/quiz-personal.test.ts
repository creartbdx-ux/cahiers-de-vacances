import assert from "node:assert/strict"
import { test } from "node:test"
import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import { generateGame } from "@/lib/game-engines/registry"
import { FakeContentGenerationProvider } from "../provider"
import {
  buildAllowedSourceIds,
  buildQuizPersonalSourceContext,
  countSourceUnits,
} from "../source-context"
import { toQuizEngineInput } from "./adapter"
import { generateQuizPersonalContent } from "./generate"
import { validateQuizPersonalGeneration } from "./validate"
import { buildQuizPersonalUserPayload } from "./prompt"
import type { GeneratedQuizPersonalQuestion } from "./types"

function baseProfile(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return {
    schemaVersion: 1,
    audience: "ME",
    creatorIsParticipant: true,
    participants: [
      { id: "p1", firstName: "Sami" },
      { id: "p2", firstName: "Emma" },
    ],
    sharedProfile: { interestUniverseIds: ["univ_sport"] },
    individualProfiles: [
      { participantId: "p1", traits: ["curieux"] },
      { participantId: "p2", traits: ["drôle"] },
    ],
    personalFacts: [
      { id: "f1", category: "HABIT", value: "Ne commence jamais sa journée sans café", participantIds: ["p1"] },
      { id: "f2", category: "FOOD", value: "Adore les crêpes", participantIds: ["p1"] },
      { id: "f3", category: "MUSIC", value: "Écoute du jazz le dimanche", participantIds: ["p1"] },
      { id: "f_secret", category: "HABIT", value: "FAIT NON AUTORISÉ SECRET", participantIds: ["p1"] },
    ],
    memories: [
      { id: "m1", title: "Bretagne", text: "Orage mémorable à Saint-Malo", participantIds: ["p1", "p2"] },
      { id: "m2", text: "Premier concert ensemble", participantIds: ["p1", "p2"] },
      { id: "m_other", text: "Souvenir d'un autre slot", participantIds: ["p1"] },
    ],
    insideJokes: [
      { id: "j1", text: "La blague du poulpe", participantIds: ["p1", "p2"] },
    ],
    gamePreferences: { likedTypes: ["QUIZ"], difficulty: 2 },
    visualPreferences: { paletteId: "AUTO", styleId: "AUTO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [],
    ...over,
  }
}

function quizSlot(over: Partial<EditorialGameSlot> = {}): EditorialGameSlot {
  return {
    slotId: "slot_quiz_1",
    gameId: "QUIZ_PERSONAL",
    gameName: "Quiz personnalisé",
    technicalEngine: "QUIZ",
    personalizationType: "PERSONAL",
    templateId: "QUIZ_01",
    universeId: null,
    difficulty: 2,
    sourceParticipantIds: ["p1", "p2"],
    sourceMemoryIds: ["m1", "m2"],
    sourceFactIds: ["f1", "f2", "f3"],
    sourceInterestIds: [],
    sourceJokeIds: ["j1"],
    contentRequirements: {
      type: "QUIZ_CONTENT",
      targetQuestions: 8,
      choicesPerQuestion: 4,
      requirePersonalSource: true,
    },
    reason: "test",
    priority: 1,
    seed: "test-seed",
    ...over,
  }
}

function makeQuestion(
  over: Partial<GeneratedQuizPersonalQuestion> & Pick<GeneratedQuizPersonalQuestion, "id" | "sourceRefs">,
): GeneratedQuizPersonalQuestion {
  return {
    question: over.question ?? `Question ${over.id} ?`,
    choices: over.choices ?? ["A", "B", "C", "D"],
    correctIndex: over.correctIndex ?? 1,
    explanation: over.explanation,
    id: over.id,
    sourceRefs: over.sourceRefs,
  }
}

function validSixQuestions(): GeneratedQuizPersonalQuestion[] {
  const sources = [
    { type: "FACT" as const, id: "f1" },
    { type: "FACT" as const, id: "f2" },
    { type: "FACT" as const, id: "f3" },
    { type: "MEMORY" as const, id: "m1" },
    { type: "MEMORY" as const, id: "m2" },
    { type: "JOKE" as const, id: "j1" },
  ]
  return sources.map((ref, i) =>
    makeQuestion({
      id: `q${i + 1}`,
      question: `Énoncé amusant ${i + 1} ?`,
      choices: [`Opt${i}A`, `Opt${i}B`, `Opt${i}C`, `Opt${i}D`],
      correctIndex: 1,
      sourceRefs: [ref, { type: "PARTICIPANT", id: "p1" }],
    }),
  )
}

test("contexte construit uniquement depuis les source IDs autorisés", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  assert.equal(ctx.facts.length, 3)
  assert.ok(ctx.facts.every((f) => ["f1", "f2", "f3"].includes(f.id)))
  assert.equal(ctx.memories.length, 2)
  assert.equal(ctx.jokes.length, 1)
  assert.deepEqual(ctx.participantNames.sort(), ["Emma", "Sami"])
  assert.equal(countSourceUnits(ctx), 6)
})

test("donnée non sélectionnée jamais présente dans le contexte provider", () => {
  const ctx = buildQuizPersonalSourceContext({
    profile: baseProfile(),
    slot: quizSlot(),
  })
  const blob = JSON.stringify(ctx)
  assert.ok(!blob.includes("FAIT NON AUTORISÉ"))
  assert.ok(!blob.includes("m_other"))
  assert.ok(!blob.includes("Souvenir d'un autre slot"))
  assert.ok(!blob.includes("@"))
  assert.ok(!blob.includes("user_id"))
})

test("sourceRef inconnue rejetée", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions()
  questions[0]!.sourceRefs = [{ type: "FACT", id: "f_unknown" }]
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /inconnue|non autorisée/i.test(e)))
})

test("sourceRef d'un autre slot (fait hors liste) rejetée", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions()
  questions[0]!.sourceRefs = [{ type: "FACT", id: "f_secret" }]
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /non autorisée/i.test(e)))
})

test("question avec 3 choix rejetée", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions()
  questions[0]!.choices = ["A", "B", "C"] as unknown as [string, string, string, string]
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
})

test("question avec 5 choix rejetée", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions()
  questions[0]!.choices = ["A", "B", "C", "D", "E"] as unknown as [
    string,
    string,
    string,
    string,
  ]
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
})

test("choix dupliqués rejetés", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions()
  questions[0]!.choices = ["Café", "café", "Thé", "Eau"]
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
})

test("correctIndex invalide rejeté", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions()
  questions[0]!.correctIndex = 4 as 0
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
})

test("forbidden topic détecté et rejeté", () => {
  const profile = baseProfile({
    forbiddenTopics: {
      answered: true,
      hasRestrictions: true,
      text: "politique",
    },
  })
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions()
  questions[0]!.question = "Quel parti politique préfère Sami ?"
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /interdit/i.test(e)))
})

test("adaptation vers QuizEngineInput valide + moteur QUIZ", () => {
  const questions = validSixQuestions()
  const input = toQuizEngineInput({ questions, seed: "adapt-1" })
  assert.equal(input.questions.length, 6)
  assert.ok(!("sourceRefs" in (input.questions[0] as object)))
  const engine = generateGame("QUIZ", input)
  assert.equal(engine.success, true)
})

test("même source non surutilisée si alternatives disponibles", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions().map((q) => ({
    ...q,
    sourceRefs: [{ type: "FACT" as const, id: "f1" }],
  }))
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /utilisée/i.test(e)))
})

test("erreur provider proprement remontée", async () => {
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: false,
    code: "PROVIDER_ERROR",
    message: "Impossible de joindre le fournisseur IA.",
  }))
  const result = await generateQuizPersonalContent({
    profile: baseProfile(),
    slot: quizSlot(),
    provider,
    maxRepairAttempts: 0,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "PROVIDER_ERROR")
    assert.ok(!/api[_-]?key/i.test(result.message))
  }
})

test("parsing invalide géré", async () => {
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: { nope: true },
  }))
  const result = await generateQuizPersonalContent({
    profile: baseProfile(),
    slot: quizSlot(),
    provider,
    maxRepairAttempts: 0,
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, "INVALID_JSON")
})

test("une seule tentative de réparation maximum", async () => {
  let calls = 0
  const provider = new FakeContentGenerationProvider(async () => {
    calls += 1
    return {
      ok: true,
      data: {
        questions: [
          {
            id: "q1",
            question: "Bad",
            choices: ["a", "b", "c"],
            correctIndex: 0,
            sourceRefs: [{ type: "FACT", id: "f1" }],
          },
        ],
      },
    }
  })
  const result = await generateQuizPersonalContent({
    profile: baseProfile(),
    slot: quizSlot(),
    provider,
    maxRepairAttempts: 1,
  })
  assert.equal(result.ok, false)
  assert.equal(calls, 2)
})

test("génération succès avec fake provider", async () => {
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: { questions: validSixQuestions() },
  }))
  const result = await generateQuizPersonalContent({
    profile: baseProfile(),
    slot: quizSlot(),
    bookProjectId: "proj-test",
    provider,
    maxRepairAttempts: 0,
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.generated.questions.length, 6)
    assert.equal(result.engineResult.success, true)
    assert.equal(result.sourceSummary.factCount, 3)
  }
})

test("NOT_CONFIGURED sans clé — pas d'appel opaque", async () => {
  const { UnconfiguredProvider } = await import("../provider")
  const result = await generateQuizPersonalContent({
    profile: baseProfile(),
    slot: quizSlot(),
    provider: new UnconfiguredProvider(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, "NOT_CONFIGURED")
})

test("aucune donnée privée typique dans le payload user du prompt", () => {
  const ctx = buildQuizPersonalSourceContext({
    profile: baseProfile(),
    slot: quizSlot(),
  })
  const payload = JSON.stringify(buildQuizPersonalUserPayload(ctx))
  assert.ok(!payload.includes("email"))
  assert.ok(!payload.includes("storage"))
  assert.ok(!payload.includes("FAIT NON AUTORISÉ"))
})
