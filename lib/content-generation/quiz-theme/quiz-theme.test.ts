import assert from "node:assert/strict"
import { test } from "node:test"
import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import { UNIVERSE_EDITORIAL_DEFAULTS } from "@/lib/universes/editorial"
import { FakeContentGenerationProvider, UnconfiguredProvider } from "../provider"
import { questionLeaksCorrectAnswer } from "../quiz-personal/quality"
import { toQuizThemeEngineInput } from "./adapter"
import { buildQuizThemePreview, QUIZ_THEME_PREVIEW_BUILD_ERROR } from "./preview"
import {
  buildQuizThemeContext,
  buildQuizThemeUserPayload,
  themePayloadLooksPersonalFree,
} from "./context"
import { generateQuizThemeContent } from "./generate"
import { buildQuizThemeSystemPrompt } from "./prompt"
import {
  applyQuizThemeReplacements,
  buildQuizThemeOutputSchema,
  collectOpenAiStrictSchemaViolations,
  QUIZ_THEME_OUTPUT_SCHEMA,
} from "./schema"
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
  over: Partial<GeneratedQuizThemeQuestion> &
    Pick<GeneratedQuizThemeQuestion, "id" | "topicKey">,
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
    topicKey: over.topicKey,
    topicLabel: over.topicLabel ?? over.topicKey,
  }
}

const NATURE_KEYS = ["faune", "flore", "géographie", "phénomène", "culture", "science"] as const
const STYLES: QuizThemeQuestionStyle[] = [
  "VOCABULARY",
  "DIFFERENCE",
  "ORIGIN_HISTORY",
  "IDENTIFICATION",
  "FUNCTION",
  "FACT_CURIOSITY",
]

function validSix(keys: readonly string[] = NATURE_KEYS): GeneratedQuizThemeQuestion[] {
  return keys.map((topicKey, i) =>
    makeQ({
      id: `q${i + 1}`,
      topicKey,
      topicLabel: `détail ${topicKey}`,
      questionStyle: STYLES[i]!,
      question: `Parmi ces affirmations liées à ${topicKey}, laquelle est exacte (variante ${i + 1}) ?`,
      choices: [
        `Réponse alpha ${i}`,
        `Réponse beta ${i}`,
        `Réponse gamma ${i}`,
        `Réponse delta ${i}`,
      ],
      correctIndex: 1,
      explanation: `La réponse beta ${i} correspond à une connaissance établie sur ${topicKey}.`,
    }),
  )
}

const BEAUTY_KEYS = UNIVERSE_EDITORIAL_DEFAULTS.BEAUTY!.allowedTopics

function beautyCtx() {
  return buildQuizThemeContext({
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
}

function beautyValidSix(): GeneratedQuizThemeQuestion[] {
  const keys = [
    "maquillage",
    "skincare",
    "cheveux",
    "parfums",
    "cosmétique",
    "routines beauté",
  ] as const
  const styles: QuizThemeQuestionStyle[] = [
    "VOCABULARY",
    "DIFFERENCE",
    "ORIGIN_HISTORY",
    "IDENTIFICATION",
    "FUNCTION",
    "SEQUENCE_USAGE",
  ]
  return keys.map((topicKey, i) =>
    makeQ({
      id: `b${i + 1}`,
      topicKey,
      topicLabel: i === 3 ? "concentration olfactive" : `sous ${topicKey}`,
      questionStyle: styles[i]!,
      question: `Parmi ces notions de ${topicKey}, laquelle est exacte (cas ${i + 1}) ?`,
      choices: [`OptA${i}`, `OptB${i}`, `OptC${i}`, `OptD${i}`],
      correctIndex: 1,
      explanation: `Fait stable établi sur ${topicKey}.`,
    }),
  )
}

test("contexte limité à univers / difficulté / intérêts — sans profil", () => {
  const ctx = buildQuizThemeContext({
    slot: themeSlot(),
    universeName: "Nature",
  })
  assert.equal(ctx.universeId, "NATURE")
  assert.equal(ctx.difficulty, 3)
  const payload = buildQuizThemeUserPayload(ctx)
  assert.ok(themePayloadLooksPersonalFree(payload))
})

test("QUIZ_THEME reçoit la définition éditoriale de l'univers", () => {
  const ctx = beautyCtx()
  assert.ok(/cosmétiques/i.test(ctx.editorialDescription))
  const system = buildQuizThemeSystemPrompt(ctx)
  assert.ok(/topicKey/i.test(system))
  assert.ok(/enum/i.test(system) || /exactement/i.test(system))
})

test("topicKey=parfums + topicLabel=concentration olfactive => valide", () => {
  const ctx = beautyCtx()
  const questions = beautyValidSix()
  const result = validateQuizThemeGeneration({
    title: "Éclat",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(questions[3]!.topicKey, "parfums")
    assert.equal(questions[3]!.topicLabel, "concentration olfactive")
  }
})

test("topicKey hors allowedTopics => rejet", () => {
  const ctx = beautyCtx()
  const questions = beautyValidSix()
  questions[0]!.topicKey = "peinture"
  questions[0]!.topicLabel = "renaissance"
  const result = validateQuizThemeGeneration({
    title: "Éclat",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /topicKey.*hors allowedTopics/i.test(e)))
  }
})

test("topicKey valide mais contenu excluded => rejet", () => {
  const ctx = beautyCtx()
  const questions = beautyValidSix()
  questions[0]!.topicKey = "culture beauté"
  questions[0]!.topicLabel = "référence artistique"
  questions[0]!.question = "Quelle peinture de Botticelli illustre souvent la beauté ?"
  const result = validateQuizThemeGeneration({
    title: "Éclat",
    questions,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /exclu/i.test(e)))
  }
})

test("BEAUTY : topics art rejetés ; cosmétiques acceptés", () => {
  const ctx = beautyCtx()
  const bad = [
    makeQ({
      id: "q1",
      topicKey: "culture beauté",
      topicLabel: "peinture",
      questionStyle: "IDENTIFICATION",
      question: "Qui a peint La Naissance de Vénus ?",
    }),
    makeQ({
      id: "q2",
      topicKey: "culture beauté",
      topicLabel: "architecture",
      questionStyle: "ASSOCIATION",
      question: "Où se trouve l'Alhambra ?",
    }),
    makeQ({
      id: "q3",
      topicKey: "culture beauté",
      topicLabel: "sculpture",
      questionStyle: "VOCABULARY",
      question: "Quelle sculpture célèbre représente Vénus ?",
    }),
    makeQ({
      id: "q4",
      topicKey: "culture beauté",
      topicLabel: "esthétique japonaise",
      questionStyle: "ORIGIN_HISTORY",
      question: "Que désigne le wabi-sabi ?",
    }),
    makeQ({
      id: "q5",
      topicKey: "culture beauté",
      topicLabel: "design",
      questionStyle: "FACT_CURIOSITY",
      question: "Quel mouvement a popularisé l'Art nouveau ?",
    }),
    makeQ({
      id: "q6",
      topicKey: "culture beauté",
      topicLabel: "musées",
      questionStyle: "DIFFERENCE",
      question: "Dans quel musée voit-on la Vénus de Milo ?",
    }),
  ]
  const badResult = validateQuizThemeGeneration({ title: "Beauté", questions: bad, context: ctx })
  assert.equal(badResult.ok, false)

  const goodResult = validateQuizThemeGeneration({
    title: "Éclat cosmétique",
    questions: beautyValidSix(),
    context: ctx,
  })
  assert.equal(goodResult.ok, true)
})

test("univers allowedTopics vide => fallback propre", () => {
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
  const schema = buildQuizThemeOutputSchema({
    targetQuestions: 6,
    allowedTopics: ctx.allowedTopics,
  })
  const topicKey = (
    schema.properties as {
      questions: { items: { properties: { topicKey: { enum?: string[] } } } }
    }
  ).questions.items.properties.topicKey
  assert.equal(topicKey.enum, undefined)
  const result = validateQuizThemeGeneration({
    title: "Libre",
    questions: validSix(),
    context: ctx,
  })
  assert.equal(result.ok, true)
})

test("schema dynamique : topicKey enum = allowedTopics BEAUTY", () => {
  const schema = buildQuizThemeOutputSchema({
    targetQuestions: 6,
    allowedTopics: BEAUTY_KEYS,
  })
  const violations = collectOpenAiStrictSchemaViolations(
    schema as Parameters<typeof collectOpenAiStrictSchemaViolations>[0],
  )
  assert.deepEqual(violations, [])
  const item = (
    schema.properties as {
      questions: { items: { required: string[]; properties: { topicKey: { enum: string[] } } } }
    }
  ).questions.items
  assert.ok(item.required.includes("topicKey"))
  assert.ok(item.required.includes("topicLabel"))
  assert.ok(item.properties.topicKey.enum.includes("parfums"))
  assert.ok(!item.required.includes("topic"))
})

test("schema Structured Outputs baseline strict", () => {
  const violations = collectOpenAiStrictSchemaViolations(
    QUIZ_THEME_OUTPUT_SCHEMA as Parameters<typeof collectOpenAiStrictSchemaViolations>[0],
  )
  assert.deepEqual(violations, [])
})

test("4 choix exactement — 3 rejetés", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.choices = ["A", "B", "C"] as unknown as [string, string, string, string]
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
})

test("choix dupliqués rejetés", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.choices = ["Alpes", "alpes", "Pyrénées", "Vosges"]
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
})

test("correctIndex invalide rejeté", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.correctIndex = 4 as 0
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
})

test("explanation obligatoire", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.explanation = "   "
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
})

test("question révélant la réponse rejetée", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.question = "Dans quel pays se trouve le mont Fuji japonais ?"
  questions[0]!.choices = ["Japon", "Corée", "Chine", "Vietnam"]
  questions[0]!.correctIndex = 0
  assert.equal(questionLeaksCorrectAnswer(questions[0]!.question, "Japon"), true)
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
})

test("questions dupliquées rejetées", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[1]!.question = questions[0]!.question
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
})

test("diversité minimum des topicKeys", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix().map((q) => ({ ...q, topicKey: "faune", topicLabel: "arbres" }))
  const result = validateQuizThemeGeneration({ title: "Titre", questions, context: ctx })
  assert.equal(result.ok, false)
})

test("actualité / formulation temporelle rejetée", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.question = "Quel record a été battu récemment dans les Alpes ?"
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
})

test("trivialité toujours rejetée", () => {
  const ctx = beautyCtx()
  const questions = beautyValidSix()
  questions[4]!.question = "Quelle couleur est associée à la nature ?"
  const result = validateQuizThemeGeneration({ title: "Éclat", questions, context: ctx })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /triviale/i.test(e)))
  }
})

test("6 questions avec 3+ styles distincts -> OK", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  assert.equal(
    validateQuizThemeGeneration({ title: "Mix", questions: validSix(), context: ctx }).ok,
    true,
  )
})

test("6 questions avec 2 styles seulement -> rejet", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix().map((q, i) => ({
    ...q,
    questionStyle: (i % 2 === 0 ? "FUNCTION" : "VOCABULARY") as QuizThemeQuestionStyle,
  }))
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
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
  const result = validateQuizThemeGeneration({ title: "Titre", questions, context: ctx })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /FUNCTION.*surutilisé|maximum 2/i.test(e)))
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
  const result = validateQuizThemeGeneration({ title: "Titre", questions, context: ctx })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /consécutif/i.test(e)))
})

test("enum questionStyle invalide rejeté", () => {
  const ctx = buildQuizThemeContext({ slot: themeSlot(), universeName: "Nature" })
  const questions = validSix()
  questions[0]!.questionStyle = "NOT_A_STYLE" as QuizThemeQuestionStyle
  assert.equal(
    validateQuizThemeGeneration({ title: "Titre", questions, context: ctx }).ok,
    false,
  )
})

test("adaptation QuizEngineInput valide + preview moteur", () => {
  const input = toQuizThemeEngineInput({ questions: validSix(), seed: "adapt-theme" })
  assert.equal(input.questions.length, 6)
  assert.ok(!("topicKey" in (input.questions[0] as object)))
  assert.ok(!("questionStyle" in (input.questions[0] as object)))
  const engine = generateGame("QUIZ", input)
  assert.equal(engine.success, true)
})

test("applyQuizThemeReplacements conserve les questions non ciblées", () => {
  const original = validSix()
  const kept = original.map((q) => ({ ...q, choices: [...q.choices] as [string, string, string, string] }))
  const replacement = makeQ({
    id: "new-q2",
    topicKey: "flore",
    topicLabel: "nouveau",
    questionStyle: "DIFFERENCE",
    question: "Remplacement ciblé de la question 2 ?",
    choices: ["W", "X", "Y", "Z"],
    correctIndex: 2,
    explanation: "Remplacement valide.",
  })
  const merged = applyQuizThemeReplacements(original, [{ index0: 1, question: replacement }])
  assert.equal(merged[0]!.id, kept[0]!.id)
  assert.equal(merged[0]!.question, kept[0]!.question)
  assert.equal(merged[1]!.id, "new-q2")
  assert.equal(merged[2]!.id, kept[2]!.id)
  assert.equal(merged[5]!.question, kept[5]!.question)
})

test("quiz avec 2 questions invalides => réparation uniquement de ces 2", async () => {
  const first = beautyValidSix()
  // Q2 (index 1): wrong topicKey classification
  first[1]!.topicKey = "peinture" as string
  first[1]!.topicLabel = "renaissance"
  // Q5 (index 4): trivial
  first[4]!.question = "Quelle couleur est associée à la nature ?"

  const keptSnapshot = {
    q1: first[0]!.question,
    q3: first[2]!.question,
    q4: first[3]!.question,
    q6: first[5]!.question,
  }

  let calls = 0
  const provider = new FakeContentGenerationProvider(async (req) => {
    calls += 1
    if (calls === 1) {
      return { ok: true, data: { title: "Éclat cosmétique", questions: first } }
    }
    assert.equal(req.schemaName, "quiz_theme_repair_v1")
    const payload = req.input as { replaceIndexes?: number[] }
    assert.deepEqual(payload.replaceIndexes, [2, 5])
    return {
      ok: true,
      data: {
        replacements: [
          {
            index: 2,
            id: "b2-fixed",
            question: "Quelle différence distingue un sérum d'une crème hydratante classique ?",
            questionStyle: "DIFFERENCE",
            choices: ["Texture et concentration d'actifs", "Couleur du flacon", "Prix seul", "Odeur"],
            correctIndex: 0,
            explanation: "Le sérum est généralement plus concentré en actifs ciblés.",
            topicKey: "skincare",
            topicLabel: "sérum vs crème",
          },
          {
            index: 5,
            id: "b5-fixed",
            question: "Dans une routine classique, à quel moment applique-t-on souvent un soin ciblé ?",
            questionStyle: "ASSOCIATION",
            choices: ["Après nettoyage, avant crème", "Après maquillage", "Avant le shampoing", "Uniquement le soir après le dîner"],
            correctIndex: 0,
            explanation: "Les soins ciblés se placent généralement après le nettoyage.",
            topicKey: "routines beauté",
            topicLabel: "ordre d'application",
          },
        ],
      },
    }
  })

  const result = await generateQuizThemeContent({
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
    provider,
    maxRepairAttempts: 1,
  })

  assert.equal(result.ok, true)
  assert.equal(calls, 2)
  if (result.ok) {
    assert.equal(result.repaired, true)
    assert.equal(result.repairedCount, 2)
    assert.equal(result.generated.questions[0]!.question, keptSnapshot.q1)
    assert.equal(result.generated.questions[2]!.question, keptSnapshot.q3)
    assert.equal(result.generated.questions[3]!.question, keptSnapshot.q4)
    assert.equal(result.generated.questions[5]!.question, keptSnapshot.q6)
    assert.equal(result.generated.questions[1]!.id, "b2-fixed")
    assert.equal(result.generated.questions[4]!.id, "b5-fixed")
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
  if (!result.ok) assert.equal(result.code, "PROVIDER_ERROR")
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
            questionStyle: "FUNCTION",
            choices: ["a", "b", "c"],
            correctIndex: 0,
            explanation: "x",
            topicKey: "y",
            topicLabel: "y",
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
    assert.equal(result.repairedCount, 0)
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

test("difficulté transmise dans le contexte et le prompt", () => {
  const ctx = buildQuizThemeContext({
    slot: themeSlot({ difficulty: 3 }),
    universeName: "Nature",
  })
  const system = buildQuizThemeSystemPrompt(ctx)
  assert.ok(/Difficulté : 3/.test(system))
  assert.ok(/questionStyle/i.test(system))
})

test("preview Lab : QUIZ_THEME valide fournit questions pour QuizTemplate", () => {
  const questions = validSix()
  const preview = buildQuizThemePreview(questions, "lab-quiz-theme-preview")
  assert.equal(preview.ok, true)
  if (preview.ok) {
    assert.equal(preview.quiz.success, true)
    assert.equal(preview.quiz.questions.length, 6)
    assert.equal(preview.quiz.questions[0]!.choices.length, 4)
    assert.ok(preview.quiz.questions.every((q) => q.question.length > 0))
  }
})

test("preview Lab : même questions + seed => même résultat moteur (pas de regénération IA)", () => {
  const questions = validSix()
  const a = buildQuizThemePreview(questions, "stable-quiz-preview")
  const b = buildQuizThemePreview(questions, "stable-quiz-preview")
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    assert.deepEqual(a.quiz.questions, b.quiz.questions)
  }
})

test("preview Lab : bascule Jeu/Correction réutilise les mêmes questions", () => {
  const preview = buildQuizThemePreview(validSix(), "mode-toggle-quiz")
  assert.equal(preview.ok, true)
  if (preview.ok) {
    const { questions } = preview.quiz
    assert.equal(questions.length, 6)
    assert.deepEqual(questions, preview.quiz.questions)
  }
})

test("preview Lab : liste vide => message admin clair", () => {
  const preview = buildQuizThemePreview([], "seed")
  assert.equal(preview.ok, false)
  if (!preview.ok) {
    assert.equal(preview.message, QUIZ_THEME_PREVIEW_BUILD_ERROR)
  }
})
