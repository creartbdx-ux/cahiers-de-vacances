import assert from "node:assert/strict"
import { test } from "node:test"
import type { BookProfileV1 } from "../questionnaire/types"
import type { Game } from "../supabase/types"
import { isGameEngineId } from "../game-engines/registry"
import {
  buildContentRequirements,
  buildEditorialPlan,
  buildSourceInventory,
  EDITORIAL_V1_GAME_IDS,
  evaluateEligibility,
  targetPersonalRatio,
} from "./index"

function mockGame(
  id: string,
  patch: Partial<Game> = {},
): Game {
  const engine =
    patch.technical_engine ??
    (id.includes("WORDSEARCH")
      ? "WORDSEARCH"
      : id.includes("TRUE_FALSE")
        ? "TRUE_FALSE"
        : id.includes("QUIZ")
          ? "QUIZ"
          : "CROSSWORD")
  return {
    id,
    name: id,
    family: "TEST",
    personalization_type: id.includes("THEME") ? "THEME" : "PERSONAL",
    technical_engine: engine,
    min_difficulty: 1,
    max_difficulty: 4,
    max_per_book: 1,
    correction_required: true,
    active: true,
    created_at: "",
    updated_at: "",
    ...patch,
  }
}

const CATALOG: Game[] = EDITORIAL_V1_GAME_IDS.map((id) => mockGame(id))

function baseProfile(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  const p1 = "p_alex"
  return {
    schemaVersion: 1,
    audience: "ME",
    creatorIsParticipant: true,
    participants: [{ id: p1, firstName: "Alex", ageBracket: "26-35" }],
    sharedProfile: {
      interestUniverseIds: ["MOUNTAIN", "FOOD", "MUSIC"],
    },
    individualProfiles: [{ participantId: p1, traits: ["curieux", "taquin"] }],
    personalFacts: [],
    memories: [],
    insideJokes: [],
    gamePreferences: { likedTypes: ["CROSSWORD", "QUIZ", "WORDSEARCH", "TRUE_FALSE"], difficulty: 3 },
    visualPreferences: { paletteId: "BLUE", styleId: "RETRO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [],
    ...over,
  }
}

function richFacts(prefix: string, n: number) {
  const values = [
    "Raclette",
    "Jazz",
    "Chamonix",
    "Randonnee",
    "Espresso",
    "Salsa",
    "Bretagne",
    "Kayak",
    "Polar",
    "Vintage",
    "Pates",
    "Surf",
  ]
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}_f${i}`,
    category: (["FOOD", "MUSIC", "PLACE", "ACTIVITY", "DRINK", "EXPRESSION"] as const)[i % 6]!,
    value: values[i % values.length]!,
  }))
}

test("profil pauvre : PERSONAL non éligible", () => {
  const profile = baseProfile({
    personalFacts: [{ id: "f1", category: "FOOD", value: "Pizza" }],
    sharedProfile: { interestUniverseIds: ["MOUNTAIN"] },
  })
  const inv = buildSourceInventory(profile)
  const { eligible, rejected } = evaluateEligibility(profile, inv, CATALOG)
  assert.ok(!eligible.some((e) => e.gameId === "CROSSWORD_PERSONAL"))
  assert.ok(!eligible.some((e) => e.gameId === "QUIZ_PERSONAL"))
  assert.ok(rejected.some((r) => r.gameId === "CROSSWORD_PERSONAL"))
  assert.ok(eligible.some((e) => e.gameId === "WORDSEARCH_THEME" || e.gameId === "CROSSWORD_THEME"))
})

test("profil riche : plusieurs PERSONAL éligibles + fallback THEME", () => {
  const profile = baseProfile({
    personalFacts: richFacts("rich", 10),
    memories: [
      { id: "m1", text: "Premier sommet à Chamonix", place: "Chamonix" },
      { id: "m2", text: "Concert jazz improvisé" },
    ],
  })
  const inv = buildSourceInventory(profile)
  const { eligible } = evaluateEligibility(profile, inv, CATALOG)
  const personal = eligible.filter((e) => e.personalizationType === "PERSONAL")
  assert.ok(personal.length >= 3)
  assert.ok(eligible.some((e) => e.personalizationType === "THEME"))

  const plan = buildEditorialPlan({
    profile,
    seed: "rich-1",
    games: CATALOG,
    richnessLevel: "RICH",
  })
  assert.ok(plan.stats.personalCount >= 1)
  assert.ok(plan.stats.themeCount >= 1)
  assert.ok(plan.stats.personalRatio < 1)
  assert.ok(plan.stats.personalRatio >= 0.4)
})

test("forbiddenTopics exclus des sources", () => {
  const profile = baseProfile({
    personalFacts: [
      ...richFacts("ok", 8),
      { id: "bad", category: "OTHER", value: "ex-conjoint Marc" },
    ],
    forbiddenTopics: {
      answered: true,
      hasRestrictions: true,
      text: "ex-conjoint",
      peopleToAvoid: "Marc",
    },
  })
  const inv = buildSourceInventory(profile)
  assert.ok(!inv.quizFacts.some((c) => c.id === "bad"))
  assert.ok(!inv.crosswordAnswers.some((c) => /marc/i.test(c.label)))
})

test("max_per_book respecté", () => {
  const profile = baseProfile({ personalFacts: richFacts("m", 10) })
  const plan = buildEditorialPlan({
    profile,
    seed: "max1",
    games: CATALOG,
    richnessLevel: "RICH",
  })
  const counts = new Map<string, number>()
  for (const slot of plan.selectedGames) {
    counts.set(slot.gameId, (counts.get(slot.gameId) ?? 0) + 1)
  }
  for (const [id, n] of counts) {
    const game = CATALOG.find((g) => g.id === id)!
    assert.ok(n <= game.max_per_book, `${id} count ${n}`)
  }
})

test("moteur non implémenté ignoré", () => {
  const profile = baseProfile({ personalFacts: richFacts("x", 10) })
  const games = [
    ...CATALOG,
    mockGame("SUDOKU_THEME", {
      technical_engine: "SUDOKU",
      personalization_type: "THEME",
    }),
  ]
  const inv = buildSourceInventory(profile)
  const { rejected } = evaluateEligibility(profile, inv, games)
  // SUDOKU not in V1 list — ignored. Fake a V1-looking id by patching:
  const fake = [
    mockGame("CROSSWORD_PERSONAL", { technical_engine: "NOT_REAL" }),
    ...CATALOG.filter((g) => g.id !== "CROSSWORD_PERSONAL"),
  ]
  const { rejected: r2, eligible } = evaluateEligibility(profile, inv, fake)
  assert.ok(r2.some((r) => r.gameId === "CROSSWORD_PERSONAL" && /non implémenté/i.test(r.reason)))
  assert.ok(!eligible.some((e) => e.gameId === "CROSSWORD_PERSONAL"))
  assert.ok(!isGameEngineId("NOT_REAL"))
  void rejected
})

test("même seed = même plan ; seeds différents peuvent varier", () => {
  const profile = baseProfile({
    personalFacts: richFacts("s", 10),
    memories: [{ id: "m1", text: "Voyage mémorable", place: "Lisbonne" }],
  })
  const a = buildEditorialPlan({ profile, seed: "seed-A", games: CATALOG, richnessLevel: "RICH" })
  const b = buildEditorialPlan({ profile, seed: "seed-A", games: CATALOG, richnessLevel: "RICH" })
  assert.deepEqual(
    a.selectedGames.map((s) => ({ g: s.gameId, u: s.universeId })),
    b.selectedGames.map((s) => ({ g: s.gameId, u: s.universeId })),
  )

  const c = buildEditorialPlan({ profile, seed: "seed-B", games: CATALOG, richnessLevel: "RICH" })
  const seqA = a.selectedGames.map((s) => `${s.gameId}:${s.universeId ?? ""}`).join("|")
  const seqC = c.selectedGames.map((s) => `${s.gameId}:${s.universeId ?? ""}`).join("|")
  // Soft assertion: often differs; if identical still OK for determinism of each seed
  assert.equal(
    buildEditorialPlan({ profile, seed: "seed-B", games: CATALOG, richnessLevel: "RICH" })
      .selectedGames.map((s) => `${s.gameId}:${s.universeId ?? ""}`)
      .join("|"),
    seqC,
  )
  void seqA
})

test("pas deux jeux identiques consécutifs si alternative", () => {
  const profile = baseProfile({ personalFacts: richFacts("c", 10) })
  // Raise max_per_book to allow multiples and force consecutive risk
  const games = CATALOG.map((g) => ({ ...g, max_per_book: 3 }))
  const plan = buildEditorialPlan({
    profile,
    seed: "consec-1",
    games,
    richnessLevel: "RICH",
    maxSlots: 6,
  })
  for (let i = 1; i < plan.selectedGames.length; i++) {
    assert.notEqual(
      plan.selectedGames[i]!.gameId,
      plan.selectedGames[i - 1]!.gameId,
      `consecutive same at ${i}`,
    )
  }
})

test("diversité des univers thématiques", () => {
  const profile = baseProfile({
    personalFacts: richFacts("u", 9),
    sharedProfile: { interestUniverseIds: ["MOUNTAIN", "FOOD", "MUSIC"] },
  })
  const plan = buildEditorialPlan({
    profile,
    seed: "univ-1",
    games: CATALOG,
    richnessLevel: "ENOUGH",
  })
  const themeUniverses = plan.selectedGames
    .filter((s) => s.personalizationType === "THEME")
    .map((s) => s.universeId)
    .filter(Boolean)
  assert.ok(themeUniverses.length >= 1)
  assert.ok(plan.stats.universesUsed.length >= 1)
})

test("provenance conservée + difficulté transmise", () => {
  const profile = baseProfile({
    personalFacts: richFacts("prov", 10),
    gamePreferences: { likedTypes: ["QUIZ", "CROSSWORD"], difficulty: 4 },
  })
  const plan = buildEditorialPlan({
    profile,
    seed: "prov-1",
    games: CATALOG,
    richnessLevel: "RICH",
  })
  const personal = plan.selectedGames.find((s) => s.personalizationType === "PERSONAL")
  assert.ok(personal)
  assert.ok(
    personal!.sourceFactIds.length > 0 ||
      personal!.sourceMemoryIds.length > 0 ||
      personal!.sourceParticipantIds.length > 0,
  )
  for (const slot of plan.selectedGames) {
    assert.equal(slot.difficulty, 4)
  }
  assert.ok(plan.forbiddenTopics)
})

test("GROUP : répartition raisonnable entre participants", () => {
  const ids = ["p1", "p2", "p3", "p4"]
  const profile = baseProfile({
    audience: "GROUP",
    creatorIsParticipant: true,
    participants: ids.map((id, i) => ({
      id,
      firstName: `P${i + 1}`,
      ageBracket: "26-35",
    })),
    individualProfiles: ids.map((id) => ({ participantId: id, traits: ["complice"] })),
    personalFacts: richFacts("g", 10).map((f, i) => ({
      ...f,
      participantIds: [ids[i % ids.length]!],
    })),
  })
  const plan = buildEditorialPlan({
    profile,
    seed: "group-1",
    games: CATALOG,
    richnessLevel: "RICH",
  })
  const used = plan.stats.personalSourcesUsed.participantIds
  assert.ok(used.length >= 2)
})

test("ratio PERSONAL/THEME cohérent avec richesse", () => {
  assert.equal(targetPersonalRatio("ENOUGH"), 0.5)
  assert.equal(targetPersonalRatio("RICH"), 0.6)
  const profile = baseProfile({ personalFacts: richFacts("r", 10) })
  const enough = buildEditorialPlan({
    profile,
    seed: "ratio-e",
    games: CATALOG,
    richnessLevel: "ENOUGH",
  })
  const rich = buildEditorialPlan({
    profile,
    seed: "ratio-r",
    games: CATALOG,
    richnessLevel: "RICH",
  })
  assert.ok(enough.stats.personalRatio <= 0.75)
  assert.ok(rich.stats.themeCount >= 1)
  assert.ok(enough.stats.themeCount >= 1)
})

test("contentRequirements corrects par moteur", () => {
  const cw = buildContentRequirements("CROSSWORD_PERSONAL", "PERSONAL", null)
  assert.equal(cw.type, "CROSSWORD_CONTENT")
  if (cw.type === "CROSSWORD_CONTENT") {
    assert.equal(cw.targetEntries, 10)
    assert.equal(cw.requirePersonalSource, true)
  }
  const ws = buildContentRequirements("WORDSEARCH_THEME", "THEME", "MOUNTAIN")
  assert.equal(ws.type, "WORDSEARCH_CONTENT")
  if (ws.type === "WORDSEARCH_CONTENT") {
    assert.equal(ws.targetWords, 12)
    assert.equal(ws.universeId, "MOUNTAIN")
  }
  const quiz = buildContentRequirements("QUIZ_PERSONAL", "PERSONAL", null)
  assert.equal(quiz.type, "QUIZ_CONTENT")
  if (quiz.type === "QUIZ_CONTENT") {
    assert.equal(quiz.choicesPerQuestion, 4)
  }
  const tf = buildContentRequirements("TRUE_FALSE_PERSONAL", "PERSONAL", null)
  assert.equal(tf.type, "TRUE_FALSE_CONTENT")
})

test("plan V1 borné et versionné", () => {
  const profile = baseProfile({ personalFacts: richFacts("cap", 10) })
  const plan = buildEditorialPlan({
    profile,
    seed: "cap-1",
    games: CATALOG,
    richnessLevel: "RICH",
    maxSlots: 8,
  })
  assert.equal(plan.version, 1)
  assert.ok(plan.selectedGames.length <= 8)
  assert.ok(plan.selectedGames.every((s) => s.templateId && s.seed && s.contentRequirements))
})

test("ME -> QUIZ_PERSONAL rejeté pour raison éditoriale", () => {
  const profile = baseProfile({
    audience: "ME",
    personalFacts: richFacts("me", 10),
    memories: [{ id: "m1", text: "Souvenir détaillé d'un voyage" }],
  })
  const inv = buildSourceInventory(profile)
  const { eligible, rejected } = evaluateEligibility(profile, inv, CATALOG)
  assert.ok(!eligible.some((e) => e.gameId === "QUIZ_PERSONAL"))
  const rej = rejected.find((r) => r.gameId === "QUIZ_PERSONAL")
  assert.ok(rej)
  assert.match(rej!.reason, /soi-même|valeur ludique/i)
})

test("OTHER_PERSON -> QUIZ_PERSONAL rejeté ; QUIZ_THEME reste éligible", () => {
  const profile = baseProfile({
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    participants: [{ id: "p_emma", firstName: "Emma", ageBracket: "18-25" }],
    personalFacts: richFacts("emma", 8),
    sharedProfile: { interestUniverseIds: ["CULTURE_POP", "MUSIC", "FOOD"] },
  })
  const inv = buildSourceInventory(profile)
  const { eligible, rejected } = evaluateEligibility(profile, inv, CATALOG)
  assert.ok(!eligible.some((e) => e.gameId === "QUIZ_PERSONAL"))
  const rej = rejected.find((r) => r.gameId === "QUIZ_PERSONAL")
  assert.ok(rej)
  assert.match(rej!.reason, /destinataire|thématique/i)
  assert.ok(eligible.some((e) => e.gameId === "QUIZ_THEME"))

  const plan = buildEditorialPlan({
    profile,
    seed: "emma-theme-1",
    games: CATALOG,
    richnessLevel: "RICH",
  })
  assert.ok(!plan.selectedGames.some((s) => s.gameId === "QUIZ_PERSONAL"))
  assert.ok(plan.selectedGames.some((s) => s.gameId === "QUIZ_THEME"))
  assert.ok(plan.rejectedGames.some((r) => r.gameId === "QUIZ_PERSONAL"))
})

test("DUO riche -> QUIZ_PERSONAL peut être éligible", () => {
  const profile = baseProfile({
    audience: "DUO",
    creatorIsParticipant: true,
    duoType: "COUPLE",
    participants: [
      { id: "p1", firstName: "Alex", ageBracket: "26-35" },
      { id: "p2", firstName: "Sam", ageBracket: "26-35" },
    ],
    individualProfiles: [
      { participantId: "p1", traits: ["curieux"] },
      { participantId: "p2", traits: ["taquin"] },
    ],
    personalFacts: richFacts("duo", 8).map((f, i) => ({
      ...f,
      participantIds: [i % 2 === 0 ? "p1" : "p2"],
    })),
    memories: [
      { id: "m1", text: "Premier voyage ensemble à Lisbonne", participantIds: ["p1", "p2"] },
      { id: "m2", text: "Soirée improvisée sous la pluie", participantIds: ["p1", "p2"] },
    ],
  })
  const inv = buildSourceInventory(profile)
  const { eligible } = evaluateEligibility(profile, inv, CATALOG)
  assert.ok(eligible.some((e) => e.gameId === "QUIZ_PERSONAL"))
})

test("GROUP riche -> QUIZ_PERSONAL peut être éligible", () => {
  const ids = ["p1", "p2", "p3"]
  const profile = baseProfile({
    audience: "GROUP",
    creatorIsParticipant: true,
    participants: ids.map((id, i) => ({
      id,
      firstName: `P${i + 1}`,
      ageBracket: "26-35",
    })),
    individualProfiles: ids.map((id) => ({ participantId: id, traits: ["complice"] })),
    personalFacts: richFacts("grp", 8).map((f, i) => ({
      ...f,
      participantIds: [ids[i % ids.length]!],
    })),
    memories: [
      { id: "m1", text: "Week-end de la bande à la mer", participantIds: ids },
    ],
    insideJokes: [{ id: "j1", text: "La blague du poulpe", participantIds: ids }],
  })
  const inv = buildSourceInventory(profile)
  const { eligible } = evaluateEligibility(profile, inv, CATALOG)
  assert.ok(eligible.some((e) => e.gameId === "QUIZ_PERSONAL"))
})

test("rejet QUIZ_PERSONAL ME/OTHER ne réduit pas inutilement les slots si THEME existe", () => {
  const profile = baseProfile({
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    participants: [{ id: "p_emma", firstName: "Emma" }],
    personalFacts: richFacts("slots", 10),
    sharedProfile: { interestUniverseIds: ["MOUNTAIN", "FOOD", "MUSIC"] },
  })
  const plan = buildEditorialPlan({
    profile,
    seed: "slots-other",
    games: CATALOG,
    richnessLevel: "RICH",
    maxSlots: 8,
  })
  assert.ok(plan.selectedGames.length >= 5)
  assert.ok(plan.selectedGames.some((s) => s.gameId === "QUIZ_THEME"))
  assert.ok(!plan.selectedGames.some((s) => s.gameId === "QUIZ_PERSONAL"))
})
