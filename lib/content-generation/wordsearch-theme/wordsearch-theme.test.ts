import assert from "node:assert/strict"
import { test } from "node:test"
import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import { normalizeWord } from "@/lib/game-engines/wordsearch/normalize"
import { UNIVERSE_EDITORIAL_DEFAULTS } from "@/lib/universes/editorial"
import { FakeContentGenerationProvider } from "../provider"
import { generateQuizThemeContent } from "../quiz-theme/generate"
import { toWordSearchThemeEngineInput } from "./adapter"
import {
  buildWordSearchThemeContext,
  buildWordSearchThemeUserPayload,
  themePayloadLooksPersonalFree,
} from "./context"
import { generateWordSearchThemeContent } from "./generate"
import { buildWordSearchThemeSystemPrompt } from "./prompt"
import {
  applyWordSearchThemeReplacements,
  buildWordSearchThemeOutputSchema,
  coerceWordSearchThemeWords,
} from "./schema"
import {
  evaluateTopicKeyDiversity,
  isTrivialInclusion,
  validateWordSearchThemeGeneration,
  validateWordSearchThemeWord,
} from "./validate"
import type { GeneratedWordSearchThemeWord } from "./types"

const BEAUTY_KEYS = UNIVERSE_EDITORIAL_DEFAULTS.BEAUTY!.allowedTopics

function wordsearchSlot(over: Partial<EditorialGameSlot> = {}): EditorialGameSlot {
  return {
    slotId: "slot_ws_theme_1",
    gameId: "WORDSEARCH_THEME",
    gameName: "Mots mêlés thématiques",
    technicalEngine: "WORDSEARCH",
    personalizationType: "THEME",
    templateId: "WORDSEARCH_01",
    universeId: "BEAUTY",
    difficulty: 3,
    sourceParticipantIds: [],
    sourceMemoryIds: [],
    sourceFactIds: [],
    sourceInterestIds: ["BEAUTY"],
    sourceJokeIds: [],
    contentRequirements: {
      type: "WORDSEARCH_CONTENT",
      targetWords: 12,
      requirePersonalSource: false,
      universeId: "BEAUTY",
    },
    reason: "test wordsearch theme",
    priority: 1,
    seed: "ws-theme-seed",
    ...over,
  }
}

function makeWord(
  display: string,
  topicKey: string,
): GeneratedWordSearchThemeWord {
  return {
    display,
    normalized: normalizeWord(display),
    topicKey,
  }
}

const VALID_BEAUTY_WORDS: GeneratedWordSearchThemeWord[] = [
  makeWord("MASCARA", "maquillage"),
  makeWord("PARFUM", "parfums"),
  makeWord("EAU DE PARFUM", "parfums"),
  makeWord("SERUM", "skincare"),
  makeWord("CUTICULE", "ongles"),
  makeWord("ROUGE", "maquillage"),
  makeWord("GLOSS", "maquillage"),
  makeWord("SHAMPOOING", "cheveux"),
  makeWord("VERNIS", "ongles"),
  makeWord("BLUSH", "maquillage"),
  makeWord("GOMMAGE", "skincare"),
  makeWord("MOUSSE", "cheveux"),
]

function beautyUniverse() {
  const d = UNIVERSE_EDITORIAL_DEFAULTS.BEAUTY!
  return {
    id: "BEAUTY",
    name: "Beauté",
    editorial_description: d.editorialDescription,
    allowed_topics: d.allowedTopics,
    excluded_topics: d.excludedTopics,
    quiz_guidance: d.quizGuidance,
  }
}

function fakeBeautyProvider(
  handler?: (schemaName: string, attempt: number) => unknown,
): FakeContentGenerationProvider {
  let attempt = 0
  return new FakeContentGenerationProvider(async (req) => {
    attempt += 1
    const data =
      handler?.(req.schemaName, attempt) ??
      ({
        title: "Mots beauté",
        words: VALID_BEAUTY_WORDS.map((w) => ({
          display: w.display,
          topicKey: w.topicKey,
        })),
      } as const)
    return { ok: true, data }
  })
}

test("payload ne contient aucune donnée personnelle", () => {
  const ctx = buildWordSearchThemeContext({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
  })
  const payload = buildWordSearchThemeUserPayload(ctx)
  assert.equal(themePayloadLooksPersonalFree(payload), true)
  assert.equal("editorialDescription" in payload, true)
  assert.equal(Array.isArray(payload.allowedTopics), true)
  assert.equal(Array.isArray(payload.excludedTopics), true)
  assert.equal("targetWords" in payload, true)
  assert.equal("participants" in payload, false)
})

test("prompt inclut la définition éditoriale de l'univers", () => {
  const ctx = buildWordSearchThemeContext({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
  })
  const prompt = buildWordSearchThemeSystemPrompt(ctx)
  assert.match(prompt, /cosmétiques/)
  assert.match(prompt, /allowedTopics|maquillage|parfums/i)
})

test("normalisation accents via coerceWordSearchThemeWords", () => {
  const coerced = coerceWordSearchThemeWords({
    title: "Test",
    words: [{ display: "crème", topicKey: "skincare" }],
  })
  assert.equal(coerced.words[0]!.normalized, "CREME")
})

test("normalisation espaces tirets apostrophes", () => {
  assert.equal(normalizeWord("eau de parfum"), "EAUDEPARFUM")
  assert.equal(normalizeWord("Saint-Émilion"), "SAINTEMILION")
  assert.equal(normalizeWord("l'aigle"), "LAIGLE")
  const coerced = coerceWordSearchThemeWords({
    title: "T",
    words: [{ display: "eau de parfum", topicKey: "parfums" }],
  })
  assert.equal(coerced.words[0]!.normalized, "EAUDEPARFUM")
})

test("doublons après normalisation rejetés", () => {
  const ctx = buildWordSearchThemeContext({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
  })
  const words = [
    ...VALID_BEAUTY_WORDS.slice(0, 10),
    makeWord("Crème", "skincare"),
    makeWord("CREME", "skincare"),
  ]
  const result = validateWordSearchThemeGeneration({
    title: "T",
    words,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /doublon/i.test(e)))
  }
})

test("terme trop court rejeté", () => {
  const ctx = buildWordSearchThemeContext({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
  })
  const errors = validateWordSearchThemeWord(makeWord("AB", "skincare"), ctx, 1)
  assert.ok(errors.some((e) => /trop court/i.test(e)))
})

test("terme trop long rejeté", () => {
  const ctx = buildWordSearchThemeContext({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
  })
  const long = "A".repeat(15)
  const errors = validateWordSearchThemeWord(makeWord(long, "skincare"), ctx, 1)
  assert.ok(errors.some((e) => /trop long/i.test(e)))
})

test("topicKey invalide rejeté", () => {
  const ctx = buildWordSearchThemeContext({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
  })
  const words = VALID_BEAUTY_WORDS.map((w, i) =>
    i === 0 ? makeWord("MASCARA", "sculpture") : w,
  )
  const result = validateWordSearchThemeGeneration({
    title: "T",
    words,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /hors allowedTopics/i.test(e)))
  }
})

test("excluded topic rejeté", () => {
  const ctx = buildWordSearchThemeContext({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
  })
  const words = VALID_BEAUTY_WORDS.map((w, i) =>
    i === 0 ? makeWord("RENAISSANCE ARTISTIQUE", "histoire des cosmétiques") : w,
  )
  const result = validateWordSearchThemeGeneration({
    title: "T",
    words,
    context: ctx,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /exclu/i.test(e)))
  }
})

test("diversité topicKeys — minimum 3 si >=4 allowedTopics", () => {
  const ctx = buildWordSearchThemeContext({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
  })
  const monoTopic = VALID_BEAUTY_WORDS.map((w) => ({
    ...w,
    topicKey: "skincare",
  }))
  const evalBad = evaluateTopicKeyDiversity({
    words: monoTopic,
    allowedTopics: ctx.allowedTopics,
  })
  assert.equal(evalBad.ok, false)
  assert.ok(evalBad.distinctCount < 3)

  const evalGood = evaluateTopicKeyDiversity({
    words: VALID_BEAUTY_WORDS,
    allowedTopics: ctx.allowedTopics,
  })
  assert.equal(evalGood.ok, true)
  assert.ok(evalGood.distinctCount >= 3)
})

test("inclusion triviale PARFUM / PARFUMS détectée", () => {
  assert.equal(isTrivialInclusion("PARFUM", "PARFUMS"), true)
  assert.equal(isTrivialInclusion("SERUM", "MASCARA"), false)
})

test("adaptation vers moteur WORDSEARCH", () => {
  const generated = {
    seed: "engine-seed",
    words: VALID_BEAUTY_WORDS,
  }
  const input = toWordSearchThemeEngineInput(generated)
  assert.equal(input.entries.length, 12)
  assert.equal(input.seed, "engine-seed")
  const result = generateGame("WORDSEARCH", input)
  assert.equal(result.success, true)
})

test("même seed produit la même grille via le moteur existant", () => {
  const input = toWordSearchThemeEngineInput({
    seed: "deterministic-ws",
    words: VALID_BEAUTY_WORDS,
  })
  const a = generateGame("WORDSEARCH", input)
  const b = generateGame("WORDSEARCH", input)
  assert.equal(a.success, true)
  assert.equal(b.success, true)
  if (a.success && b.success) {
    assert.deepEqual(a.grid, b.grid)
    assert.deepEqual(
      a.placements.map((p) => p.normalizedWord),
      b.placements.map((p) => p.normalizedWord),
    )
  }
})

test("réparation unique ciblée remplace les mots invalides", async () => {
  let call = 0
  const provider = new FakeContentGenerationProvider(async (req) => {
    call += 1
    if (req.schemaName === "wordsearch_theme_v1") {
      const bad = VALID_BEAUTY_WORDS.map((w, i) => ({
        display: i === 0 ? "SCULPTURE" : w.display,
        topicKey: i === 0 ? "sculpture" : w.topicKey,
      }))
      return { ok: true, data: { title: "Mots beauté", words: bad } }
    }
    if (req.schemaName === "wordsearch_theme_repair_v1") {
      return {
        ok: true,
        data: {
          replacements: [{ index: 1, display: "KABUKI", topicKey: "maquillage" }],
        },
      }
    }
    return { ok: false, code: "INVALID_JSON", message: "unexpected" }
  })

  const result = await generateWordSearchThemeContent({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
    provider,
    maxRepairAttempts: 1,
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.repaired, true)
    assert.equal(call, 2)
    assert.equal(result.generated.words.length, 12)
  }
})

test("pipeline complet avec fake provider", async () => {
  const result = await generateWordSearchThemeContent({
    slot: wordsearchSlot(),
    universe: beautyUniverse(),
    provider: fakeBeautyProvider(),
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.generated.gameId, "WORDSEARCH_THEME")
    assert.equal(result.engineResult.success, true)
    assert.equal(result.validation.topicDistinctCount >= 3, true)
  }
})

test("schéma structured output inclut enum dynamique allowedTopics", () => {
  const schema = buildWordSearchThemeOutputSchema({
    targetWords: 12,
    allowedTopics: BEAUTY_KEYS.slice(0, 4),
  })
  const wordsProp = (schema.properties as Record<string, unknown>).words as {
    items?: { properties?: { topicKey?: { enum?: string[] } } }
  }
  const enumValues = wordsProp.items?.properties?.topicKey?.enum
  assert.deepEqual(enumValues, BEAUTY_KEYS.slice(0, 4))
})

test("QUIZ_THEME inchangé — pipeline quiz theme reste fonctionnel", async () => {
  const quizSlot: EditorialGameSlot = {
    slotId: "slot_quiz_theme",
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
    sourceInterestIds: ["NATURE"],
    sourceJokeIds: [],
    contentRequirements: {
      type: "QUIZ_CONTENT",
      targetQuestions: 6,
      choicesPerQuestion: 4,
      requirePersonalSource: false,
      universeId: "NATURE",
    },
    reason: "regression",
    priority: 1,
    seed: "quiz-regression",
  }

  const result = await generateQuizThemeContent({
    slot: quizSlot,
    universe: {
      id: "NATURE",
      name: "Nature",
      editorial_description: "Univers nature.",
      allowed_topics: ["faune", "flore", "géographie", "phénomène", "culture", "science"],
      excluded_topics: [],
      quiz_guidance: null,
    },
    provider: new FakeContentGenerationProvider(async () => ({
      ok: false,
      code: "NOT_CONFIGURED",
      message: "skip network",
    })),
    maxRepairAttempts: 0,
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.notEqual(result.code, "FORBIDDEN")
  }
})

test("applyWordSearchThemeReplacements remplace à l'index", () => {
  const original = VALID_BEAUTY_WORDS.slice(0, 3)
  const next = applyWordSearchThemeReplacements(original, [
    { index0: 1, word: makeWord("GLOSS", "maquillage") },
  ])
  assert.equal(next[1]!.display, "GLOSS")
  assert.equal(next[0]!.display, original[0]!.display)
})
