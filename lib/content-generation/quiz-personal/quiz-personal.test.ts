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
import { buildQuizPersonalSystemPrompt, buildQuizPersonalUserPayload } from "./prompt"
import { questionLeaksCorrectAnswer } from "./quality"
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

test("OTHER_PERSON : destinataire traité comme lecteur dans le contexte", () => {
  const profile = baseProfile({
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    participants: [{ id: "p_emma", firstName: "Emma" }],
    personalFacts: [
      { id: "f1", category: "MUSIC", value: "Justin Bieber", participantIds: ["p_emma"] },
      { id: "f2", category: "OTHER", value: "Rose", participantIds: ["p_emma"] },
      { id: "f3", category: "MOVIE_SERIES", value: "Gossip Girl", participantIds: ["p_emma"] },
      { id: "f4", category: "HABIT", value: "Café le matin avant toute conversation", participantIds: ["p_emma"] },
    ],
    memories: [
      {
        id: "m_rich",
        title: "Australie",
        place: "Tokyo",
        text: "Road trip en Australie avec escale à Tokyo et expérience d'un onsen japonais avant de repartir.",
        participantIds: ["p_emma"],
      },
      {
        id: "m_anecdote",
        text: "Elle m'a poursuivie dans le jardin chez ma mère et elle s'est cassé la figure comme une crêpe en glissant dans de la boue.",
        participantIds: ["p_emma"],
      },
    ],
    insideJokes: [],
  })
  const slot = quizSlot({
    sourceParticipantIds: ["p_emma"],
    sourceFactIds: ["f1", "f2", "f3", "f4"],
    sourceMemoryIds: ["m_rich", "m_anecdote"],
    sourceJokeIds: [],
  })
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  assert.equal(ctx.audience, "OTHER_PERSON")
  assert.equal(ctx.creatorIsParticipant, false)
  assert.deepEqual(ctx.targetParticipantNames, ["Emma"])
  const payload = buildQuizPersonalUserPayload(ctx) as {
    targetParticipantNames: string[]
    audience: string
  }
  assert.deepEqual(payload.targetParticipantNames, ["Emma"])
  assert.equal(payload.audience, "OTHER_PERSON")
  const system = buildQuizPersonalSystemPrompt(ctx)
  assert.ok(/lecteur/i.test(system))
  assert.ok(/vouvoiement/i.test(system))
  assert.ok(/Évitez la 3e personne/i.test(system))
})

test("OTHER_PERSON : formulation 3e personne sur le destinataire rejetée", () => {
  const profile = baseProfile({
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    participants: [{ id: "p_emma", firstName: "Emma" }],
  })
  const slot = quizSlot({
    sourceParticipantIds: ["p_emma"],
    sourceFactIds: ["f1", "f2", "f3"],
    sourceMemoryIds: ["m1", "m2"],
    sourceJokeIds: ["j1"],
  })
  // Rebind facts to emma for context resolution — keep ids from base
  profile.personalFacts = profile.personalFacts.map((f) => ({
    ...f,
    participantIds: ["p_emma"],
  }))
  profile.memories = profile.memories.map((m) => ({ ...m, participantIds: ["p_emma"] }))
  profile.insideJokes = profile.insideJokes.map((j) => ({ ...j, participantIds: ["p_emma"] }))

  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions().map((q, i) => ({
    ...q,
    question:
      i === 0
        ? "Quelle série Emma pourrait-elle reconnaître entre mille ?"
        : `Énoncé amusant direct ${i + 1} pour vous ?`,
    sourceRefs: q.sourceRefs.map((r) =>
      r.type === "PARTICIPANT" ? { type: "PARTICIPANT" as const, id: "p_emma" } : r,
    ),
  }))
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => /3e personne|perspective/i.test(e)))
})

test("source autorisée peut rester inutilisée", () => {
  const slot = quizSlot()
  const allowed = buildAllowedSourceIds(slot)
  const profileRich = baseProfile({
    memories: [
      {
        id: "m1",
        title: "Bretagne",
        place: "Saint-Malo",
        text: "Orage mémorable à Saint-Malo pendant les vacances d'été avec toute la famille réunie sur le rempart.",
        participantIds: ["p1", "p2"],
      },
      { id: "m2", text: "Premier concert ensemble sous la pluie", participantIds: ["p1", "p2"] },
    ],
  })
  const ctx2 = buildQuizPersonalSourceContext({ profile: profileRich, slot })
  const refs = [
    { type: "FACT" as const, id: "f1" },
    { type: "FACT" as const, id: "f2" },
    { type: "MEMORY" as const, id: "m1" },
    { type: "MEMORY" as const, id: "m2" },
    { type: "JOKE" as const, id: "j1" },
  ]
  const questions = validSixQuestions().map((q, i) =>
    makeQuestion({
      id: q.id,
      question: `Situation ludique numéro ${i + 1} sans spoiler ?`,
      choices: [`Opt${i}A`, `Opt${i}B`, `Opt${i}C`, `Opt${i}D`],
      correctIndex: 1,
      sourceRefs: [
        i < 5 ? refs[i]! : { type: "MEMORY" as const, id: "m1" },
        { type: "PARTICIPANT", id: "p1" },
      ],
    }),
  )
  const result = validateQuizPersonalGeneration({
    questions,
    context: ctx2,
    allowed,
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.ok(result.unusedSourceIds.factIds.includes("f3"))
    assert.ok(result.usedSourceIds.memoryIds.includes("m1"))
  }
})
test("mémoire riche peut justifier deux questions distinctes", () => {
  const profile = baseProfile({
    memories: [
      {
        id: "m1",
        title: "Australie",
        place: "Tokyo",
        text: "Road trip en Australie avec escale à Tokyo et expérience d'un onsen avant de poursuivre le voyage.",
        participantIds: ["p1"],
      },
      { id: "m2", text: "Premier concert", participantIds: ["p1"] },
    ],
  })
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  assert.equal(ctx.memories.find((m) => m.id === "m1")?.quizValue, "HIGH")
  const allowed = buildAllowedSourceIds(slot)
  const questions = [
    makeQuestion({
      id: "q1",
      question: "Pendant votre escale asiatique, quelle expérience avez-vous tentée ?",
      choices: ["Un onsen", "Un safari", "Un cours de sushi", "Un marathon"],
      correctIndex: 0,
      sourceRefs: [{ type: "MEMORY", id: "m1" }],
    }),
    makeQuestion({
      id: "q2",
      question: "Quel était le grand voyage principal avant cette escale ?",
      choices: ["Australie", "Canada", "Islande", "Maroc"],
      correctIndex: 0,
      sourceRefs: [{ type: "MEMORY", id: "m1" }],
    }),
    makeQuestion({
      id: "q3",
      question: "Quel rituel matinal revient souvent avant toute conversation ?",
      choices: ["Café", "Thé", "Sport", "Méditation"],
      correctIndex: 0,
      sourceRefs: [{ type: "FACT", id: "f1" }],
    }),
    makeQuestion({
      id: "q4",
      question: "Pour un goûter improvisé, quelle gourmandise a le plus de chances d'arriver ?",
      choices: ["Crêpes", "Sushi", "Salade", "Soup"],
      correctIndex: 0,
      sourceRefs: [{ type: "FACT", id: "f2" }],
    }),
    makeQuestion({
      id: "q5",
      question: "Quel genre musical illumine souvent les dimanches ?",
      choices: ["Jazz", "Métal", "Opéra", "Techno"],
      correctIndex: 0,
      sourceRefs: [{ type: "FACT", id: "f3" }],
    }),
    makeQuestion({
      id: "q6",
      question: "Quelle private joke pourrait refaire surface au détour d'un repas ?",
      choices: ["La blague du poulpe", "Le code secret", "Le surnom du chat", "Le mime"],
      correctIndex: 0,
      sourceRefs: [{ type: "JOKE", id: "j1" }],
    }),
  ]
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, true)
})

test("plusieurs sourceRefs sur une question restent valides", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = [
    makeQuestion({
      id: "q1",
      question: "Quelle combinaison pourrait résumer un dimanche matin tranquille ?",
      choices: ["Café puis crêpes", "Thé seul", "Rien du tout", "Smoothie vert"],
      correctIndex: 0,
      sourceRefs: [
        { type: "FACT", id: "f1" },
        { type: "FACT", id: "f2" },
        { type: "PARTICIPANT", id: "p1" },
      ],
    }),
    makeQuestion({
      id: "q2",
      question: "Quel genre musical illumine souvent les dimanches ?",
      choices: ["Jazz", "Métal", "Opéra", "Techno"],
      correctIndex: 0,
      sourceRefs: [{ type: "FACT", id: "f3" }],
    }),
    makeQuestion({
      id: "q3",
      question: "Quel souvenir d'orage reste associé à Saint-Malo ?",
      choices: ["Orage mémorable", "Neige", "Éclipse", "Carnival"],
      correctIndex: 0,
      sourceRefs: [{ type: "MEMORY", id: "m1" }],
    }),
    makeQuestion({
      id: "q4",
      question: "Quel premier événement musical partagé reste dans les annales ?",
      choices: ["Premier concert ensemble", "Karaoké", "Opéra", "Festival"],
      correctIndex: 0,
      sourceRefs: [{ type: "MEMORY", id: "m2" }],
    }),
    makeQuestion({
      id: "q5",
      question: "Quelle private joke pourrait refaire surface au détour d'un repas ?",
      choices: ["La blague du poulpe", "Le code secret", "Le surnom du chat", "Le mime"],
      correctIndex: 0,
      sourceRefs: [{ type: "JOKE", id: "j1" }],
    }),
    makeQuestion({
      id: "q6",
      question: "Pour une soirée canapé, quel rythme a le plus de chances de passer ?",
      choices: ["Jazz du dimanche", "Silence radio", "Sirènes", "Fanfare"],
      correctIndex: 0,
      sourceRefs: [{ type: "FACT", id: "f3" }, { type: "PARTICIPANT", id: "p1" }],
    }),
  ]
  // f3 used twice — MUSIC is LOW → would fail. Fix q6 to only use participant+memory already used? 
  // Use only once each — drop second f3
  questions[5] = makeQuestion({
    id: "q6",
    question: "Quel clin d'œil pourrait rappeler une blague déjà partagée ?",
    choices: ["Poulpe", "Pingouin", "Panda", "Perroquet"],
    correctIndex: 0,
    sourceRefs: [{ type: "JOKE", id: "j1" }, { type: "PARTICIPANT", id: "p1" }],
  })
  // j1 twice - jokes are HIGH, max 2 — OK
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, true)
})
test("réponse révélée dans la question détectée", () => {
  assert.equal(
    questionLeaksCorrectAnswer(
      "Lors d'un voyage, dans quel pays avez-vous découvert l'expérience du onsen japonais ?",
      "Japon",
    ),
    true,
  )
  assert.equal(
    questionLeaksCorrectAnswer(
      "Pendant votre escale à Tokyo, quelle expérience avez-vous tentée ?",
      "Un onsen",
    ),
    false,
  )
})

test("fait hors slot toujours rejeté (provenance stricte)", () => {
  const profile = baseProfile()
  const slot = quizSlot()
  const ctx = buildQuizPersonalSourceContext({ profile, slot })
  const allowed = buildAllowedSourceIds(slot)
  const questions = validSixQuestions()
  questions[0]!.sourceRefs = [{ type: "FACT", id: "f_secret" }]
  const result = validateQuizPersonalGeneration({ questions, context: ctx, allowed })
  assert.equal(result.ok, false)
})
