import assert from "node:assert/strict"
import { test } from "node:test"
import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import { FakeContentGenerationProvider, UnconfiguredProvider } from "../provider"
import { questionLeaksCorrectAnswer } from "../quiz-personal/quality"
import { toQuizThemeEngineInput } from "./adapter"
import {
  buildQuizThemeContext,
  buildQuizThemeUserPayload,
  themePayloadLooksPersonalFree,
} from "./context"
import { generateQuizThemeContent } from "./generate"
import { buildQuizThemeSystemPrompt } from "./prompt"
import { collectOpenAiStrictSchemaViolations, QUIZ_THEME_OUTPUT_SCHEMA } from "./schema"
import { validateQuizThemeGeneration } from "./validate"
import type { GeneratedQuizThemeQuestion } from "./types"
import type { QuizThemeQuestionStyle } from "./styles"

function themeSlot(over: Partial<EditorialGameSlot> = {}): EditorialGameSlot {
  return {
    slotId: "slot_theme_1",
    gameId: "QUIZ_THEME",
    gameName: "Quiz thématique",
    technicalEngine: "QUIZ",
    personalizationType: "THEME",
    templateId: "QUIZ_01",
    universeId: "NATURE",
    difficulty: 3,
    sourceParticipantIds: [],
    sourceMemoryIds: [],
    sourceFactIds: [],
    sourceInterestIds: ["NATURE", "MOUNTAIN"],
    sourceJokeIds: [],
    contentRequirements: {
      type: "QUIZ_CONTENT",
      targetQuestions: 6,
      choicesPerQuestion: 4,
      requirePersonalSource: false,
      universeId: "NATURE",
    },
    reason: "test theme",
    priority: 1,
    seed: "theme-seed",
    ...over,
  }
}

function makeQ(
  over: Partial<GeneratedQuizThemeQuestion> & Pick<GeneratedQuizThemeQuestion, "id" | "topic">,
): GeneratedQuizThemeQuestion {
  return {
    id: over.id,
    question: over.question ?? `Quelle notion thématique ${over.id} est correcte ?`,
    questionStyle: over.questionStyle ?? "FACT_CURIOSITY",
    choices: over.choices ?? [
      `Choix A ${over.id}`,
      `Choix B ${over.id}`,
      `Choix C ${over.id}`,
      `Choix D ${over.id}`,
    ],
    correctIndex: over.correctIndex ?? 1,
    explanation: over.explanation ?? `Parce que ${over.id} repose sur un fait stable.`,
    topic: over.topic,
  }
}

const TOPICS = ["faune", "flore", "géographie", "phénomène", "culture", "science"] as const
const STYLES: QuizThemeQuestionStyle[] = [
  "VOCABULARY",
  "DIFFERENCE",
  "ORIGIN_HISTORY",
  "IDENTIFICATION",
  "FUNCTION",
  "FACT_CURIOSITY",
]

function validSix(): GeneratedQuizThemeQuestion[] {
  return TOPICS.map((topic, i) =>
    makeQ({
      id: `q${i + 1}`,
      topic,
      questionStyle: STYLES[i]!,
      question: `Parmi ces affirmations liées à ${topic}, laquelle est exacte (variante ${i + 1}) ?`,
      choices: [
        `Réponse alpha ${i}`,
        `Réponse beta ${i}`,
        `Réponse gamma ${i}`,
        `Réponse delta ${i}`,
      ],
      correctIndex: 1,
      explanation: `La réponse beta ${i} correspond à une connaissance établie sur ${topic}.`,
    }),
  )
}

test("contexte limité à univers / difficulté / intérêts — sans profil", () => {
  const ctx = buildQuizThemeContext({
    slot: themeSlot(),
    universeName: "Nature",
  })
  assert.equal(ctx.universeId, "NATURE")
  assert.equal(ctx.universeName, "Nature")
  assert.equal(ctx.difficulty, 3)
  assert.equal(ctx.targetQuestions, 6)
  assert.deepEqual(ctx.interestIds, ["NATURE", "MOUNTAIN"])
  assert.ok(ctx.editorialDescription)
  const payload = buildQuizThemeUserPayload(ctx)
  assert.ok(themePayloadLooksPersonalFree(payload))
  assert.ok("editorialDescription" in payload)
  assert.ok("allowedTopics" in payload)
  assert.ok("excludedTopics" in payload)
  const blob = JSON.stringify(payload)
  assert.ok(!blob.includes("Emma"))
  assert.ok(!blob.includes("email"))
  assert.ok(!blob.includes("personalFacts"))
  assert.ok(!blob.includes("memories"))
  assert.ok(!blob.includes("user_id"))
})

test("QUIZ_THEME reçoit la définition éditoriale de l'univers", () => {
  const ctx = buildQuizThemeContext({
    slot: themeSlot({ universeId: "BEAUTY", sourceInterestIds: ["BEAUTY"] }),
    universe: { id: "BEAUTY", name: "Beauté" },
  })
  assert.ok(/cosmétiques|soins personnels/i.test(ctx.editorialDescription))
  assert.ok(ctx.allowedTopics.some((t) => /maquillage|skincare/i.test(t)))
  assert.ok(ctx.excludedTopics.some((t) => /peinture|architecture/i.test(t)))
  const payload = buildQuizThemeUserPayload(ctx)
  assert.deepEqual(payload.allowedTopics, ctx.allowedTopics)
  assert.deepEqual(payload.excludedTopics, ctx.excludedTopics)
  const system = buildQuizThemeSystemPrompt(ctx)
  assert.ok(/définition éditoriale/i.test(system))
  assert.ok(/non selon toutes les significations possibles/i.test(system))
  assert.ok(/cosmétiques/i.test(system))
})

test("BEAUTY : topics art / architecture rejetés ; cosmétiques acceptés", () => {
  const ctx = buildQuizThemeContext({
    slot: themeSlot({
      universeId: "BEAUTY",
      sourceInterestIds: ["BEAUTY"],
      contentRequirements: {
        type: "QUIZ_CONTENT",
        targetQuestions: 6,
        choicesPerQuestion: 4,
        requirePersonalSource: false,
        universeId: "BEAUTY",
      },
    }),
    universe: { id: "BEAUTY", name: "Beauté" },
  })

  const bad = [
    makeQ({ id: "q1", topic: "peinture Renaissance", questionStyle: "IDENTIFICATION", question: "Qui a peint La Naissance de Vénus ?" }),
    makeQ({ id: "q2", topic: "architecture", questionStyle: "ASSOCIATION", question: "Où se trouve l'Alhambra ?" }),
    makeQ({ id: "q3", topic: "sculpture antique", questionStyle: "IDENTIFICATION", question: "Quelle sculpture célèbre représente Vénus ?" }),
    makeQ({ id: "q4", topic: "esthétique japonaise", questionStyle: "VOCABULARY", question: "Que désigne le wabi-sabi ?" }),
    makeQ({ id: "q5", topic: "histoire du design", questionStyle: "ORIGIN_HISTORY", question: "Quel mouvement a popularisé l'Art nouveau ?" }),
    makeQ({ id: "q6", topic: "musées", questionStyle: "FACT_CURIOSITY", question: "Dans quel musée voit-on la Vénus de Milo ?" }),
  ]
  const badResult = validateQuizThemeGeneration({
    title: "Beauté",
    questions: bad,
    context: ctx,
  })
  assert.equal(badResult.ok, false)
  if (!badResult.ok) {
    assert.ok(badResult.errors.some((e) => /hors cadre|exclu|autorisés/i.test(e)))
  }

  const goodTopics = [
    "maquillage",
    "skincare",
    "cheveux",
    "parfums",
    "cosmétique",
    "routines beauté",
  ] as const
  const goodStyles: QuizThemeQuestionStyle[] = [
    "VOCABULARY",
    "DIFFERENCE",
    "ORIGIN_HISTORY",
    "IDENTIFICATION",
    "FUNCTION",
    "SEQUENCE_USAGE",
  ]
  const good = goodTopics.map((topic, i) =>
    makeQ({
      id: `g${i + 1}`,
      topic,
      questionStyle: goodStyles[i]!,
      question: `Parmi ces notions de ${topic}, laquelle est exacte (cas ${i + 1}) ?`,
      choices: [`OptA${i}`, `OptB${i}`, `OptC${i}`, `OptD${i}`],
      correctIndex: 1,
      explanation: `Fait stable établi sur ${topic}.`,
    }),
  )
  const goodResult = validateQuizThemeGeneration({
    title: "Éclat cosmétique",
    questions: good,
    context: ctx,
  })
  assert.equal(goodResult.ok, true)
})

test("univers sans configuration complète : fallback propre dans le contexte", () => {
  const ctx = buildQuizThemeContext({
    slot: themeSlot({ universeId: "UNKNOWN_X", sourceInterestIds: [] }),
    universe: {
      id: "UNKNOWN_X",
      name: "Inconnu",
      editorial_description: null,
      allowed_topics: [],
      excluded_topics: [],
      quiz_guidance: null,
    },
  })
  assert.equal(ctx.hasTopicFrame, false)
  assert.ok(ctx.editorialDescription.includes("Inconnu"))
  assert.deepEqual(ctx.allowedTopics, [])
  assert.deepEqual(ctx.excludedTopics, [])
})

test("aucun fait personnel envoyé au provider (payload + prompt)", async () => {
  let capturedInput: unknown
  const provider = new FakeContentGenerationProvider(async (req) => {
    capturedInput = req.input
    assert.ok(!/Emma|souvenir|personalFacts|email|user_id/i.test(req.system))
    return {
      ok: true,
      data: { title: "Escapade nature", questions: validSix() },
    }
  })
  const result = await generateQuizThemeContent({
    slot: themeSlot(),
    universeName: "Nature",
    provider,
    maxRepairAttempts: 0,
  })
  assert.equal(result.ok, true)
  assert.ok(themePayloadLooksPersonalFree(capturedInput))
})

test("difficulté transmise dans le contexte et le prompt", () => {
  const ctx = buildQuizThemeContext({
    slot: themeSlot({ difficulty: 3 }),
    universeName: "Nature",
  })
  assert.equal(ctx.difficulty, 3)
  const system = buildQuizThemeSystemPrompt(ctx)
  assert.ok(/Difficulté : 3/.test(system))
  assert.ok(/intermédiaire/.test(system))
  assert.ok(/définition éditoriale/i.test(system))
  assert.ok(/questionStyle/i.test(system))
  assert.ok(/même mécanique/i.test(system))
})

test("schema Structured Outputs strict", () => {
  const violations = collectOpenAiStrictSchemaViolations(
    QUIZ_THEME_OUTPUT_SCHEMA as Parameters<typeof collectOpenAiStrictSchemaViolations>[0],
  )
  assert.deepEqual(violations, [])
})

test("4 choix exactement — 3 rejetés", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.choices = ["A", "B", "C"] as unknown as [string, string, string, string]
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
})

test("choix dupliqués rejetés", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.choices = ["Alpes", "alpes", "Pyrénées", "Vosges"]
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
})

test("correctIndex invalide rejeté", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.correctIndex = 4 as 0
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
})

test("explanation obligatoire", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.explanation = "   "
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
})

test("question révélant la réponse rejetée", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.question = "Dans quel pays se trouve le mont Fuji japonais ?"
  questions[0]!.choices = ["Japon", "Corée", "Chine", "Vietnam"]
  questions[0]!.correctIndex = 0
  assert.equal(questionLeaksCorrectAnswer(questions[0]!.question, "Japon"), true)
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /révélée/i.test(e)))
})

test("questions dupliquées rejetées", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[1]!.question = questions[0]!.question
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
})

test("diversité minimum des topics", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix().map((q) => ({ ...q, topic: "arbres" }))
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /diversité|sur-représenté/i.test(e)))
})

test("actualité / formulation temporelle rejetée", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.question = "Quel record a été battu récemment dans les Alpes ?"
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
})

test("question triviale rejetée", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.question = "Quelle couleur est associée à la nature ?"
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
})

test("validation OK sur six questions diversifiées", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const result = validateQuizThemeGeneration({
    title: "Cap sur les sommets",
    questions: validSix(),
    context: ctx,
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.topics.length, 6)
    assert.ok(result.styleDistinctCount >= 3)
    assert.equal(result.styleDiversityOk, true)
  }
})

test("6 questions avec 3+ styles distincts -> OK", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const result = validateQuizThemeGeneration({
    title: "Mix",
    questions: validSix(),
    context: ctx,
  })
  assert.equal(result.ok, true)
})

test("6 questions avec 2 styles seulement -> rejet", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix().map((q, i) => ({
    ...q,
    questionStyle: (i % 2 === 0 ? "FUNCTION" : "VOCABULARY") as QuizThemeQuestionStyle,
  }))
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /formes insuffisante|style/i.test(e)))
  }
})

test("3 questions FUNCTION + 3 autres -> rejet car FUNCTION > 2", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const styles: QuizThemeQuestionStyle[] = [
    "FUNCTION",
    "VOCABULARY",
    "FUNCTION",
    "DIFFERENCE",
    "FUNCTION",
    "ORIGIN_HISTORY",
  ]
  const questions = validSix().map((q, i) => ({ ...q, questionStyle: styles[i]! }))
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /FUNCTION.*surutilisé|maximum 2/i.test(e)))
  }
})

test("deux mêmes styles consécutifs rejetés", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const styles: QuizThemeQuestionStyle[] = [
    "VOCABULARY",
    "VOCABULARY",
    "DIFFERENCE",
    "ORIGIN_HISTORY",
    "IDENTIFICATION",
    "FUNCTION",
  ]
  const questions = validSix().map((q, i) => ({ ...q, questionStyle: styles[i]! }))
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /consécutif/i.test(e)))
  }
})

test("schema Structured Output exige questionStyle", () => {
  const item = (
    QUIZ_THEME_OUTPUT_SCHEMA.properties as {
      questions: { items: { required: string[]; properties: Record<string, unknown> } }
    }
  ).questions.items
  assert.ok(item.required.includes("questionStyle"))
  const styleSchema = item.properties.questionStyle as { enum?: string[] }
  assert.ok(Array.isArray(styleSchema.enum))
  assert.ok(styleSchema.enum!.includes("VOCABULARY"))
})

test("enum questionStyle invalide rejeté", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.questionStyle = "NOT_A_STYLE" as QuizThemeQuestionStyle
  const result = validateQuizThemeGeneration({
    title: "Titre",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /questionStyle invalide/i.test(e)))
  }
})

test("adaptation QuizEngineInput valide + preview moteur", () => {
  const input = toQuizThemeEngineInput({ questions: validSix(), seed: "adapt-theme" })
  assert.equal(input.questions.length, 6)
  assert.ok(!("sourceRefs" in (input.questions[0] as object)))
  assert.ok(!("topic" in (input.questions[0] as object)))
  assert.ok(!("questionStyle" in (input.questions[0] as object)))
  const engine = generateGame("QUIZ", input)
  assert.equal(engine.success, true)
  if (engine.success) {
    assert.equal(engine.questions.length, 6)
    assert.ok(engine.questions[0]!.explanation)
  }
})

test("erreur provider proprement gérée", async () => {
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: false,
    code: "PROVIDER_ERROR",
    message: "Impossible de joindre le fournisseur IA.",
  }))
  const result = await generateQuizThemeContent({
    slot: themeSlot(),
    universeName: "Nature",
    provider,
    maxRepairAttempts: 0,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "PROVIDER_ERROR")
    assert.ok(!/api[_-]?key/i.test(result.message))
  }
})

test("une réparation max", async () => {
  let calls = 0
  const provider = new FakeContentGenerationProvider(async () => {
    calls += 1
    return {
      ok: true,
      data: {
        title: "Bad",
        questions: [
          {
            id: "q1",
            question: "Bad",
            choices: ["a", "b", "c"],
            correctIndex: 0,
            explanation: "x",
            topic: "y",
          },
        ],
      },
    }
  })
  const result = await generateQuizThemeContent({
    slot: themeSlot(),
    universeName: "Nature",
    provider,
    maxRepairAttempts: 1,
  })
  assert.equal(result.ok, false)
  assert.equal(calls, 2)
})

test("génération succès avec fake provider", async () => {
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: { title: "Escapade nature", questions: validSix() },
  }))
  const result = await generateQuizThemeContent({
    slot: themeSlot(),
    universeName: "Nature",
    bookProjectId: "proj-emma",
    provider,
    maxRepairAttempts: 0,
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.generated.questions.length, 6)
    assert.equal(result.generated.title, "Escapade nature")
    assert.equal(result.engineResult.success, true)
    assert.equal(result.context.difficulty, 3)
  }
})

test("NOT_CONFIGURED sans clé", async () => {
  const result = await generateQuizThemeContent({
    slot: themeSlot(),
    universeName: "Nature",
    provider: new UnconfiguredProvider(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, "NOT_CONFIGURED")
})

test("slot non QUIZ_THEME rejeté", async () => {
  const result = await generateQuizThemeContent({
    slot: themeSlot({ gameId: "QUIZ_PERSONAL" as "QUIZ_THEME" }),
    universeName: "Nature",
    provider: new FakeContentGenerationProvider(async () => ({
      ok: true,
      data: { title: "x", questions: validSix() },
    })),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, "FORBIDDEN")
})
