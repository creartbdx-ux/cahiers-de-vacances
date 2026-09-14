import assert from "node:assert/strict"
import { test } from "node:test"
import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { generateGame } from "@/lib/game-engines/registry"
import { normalizeAnswer } from "@/lib/game-engines/crossword/normalize"
import { UNIVERSE_EDITORIAL_DEFAULTS } from "@/lib/universes/editorial"
import { FakeContentGenerationProvider } from "../provider"
import { generateQuizThemeContent } from "../quiz-theme/generate"
import { generateWordSearchThemeContent } from "../wordsearch-theme/generate"
import { toCrosswordThemeEngineInput } from "./adapter"
import {
  buildCrosswordThemeContext,
  buildCrosswordThemeUserPayload,
  themePayloadLooksPersonalFree,
} from "./context"
import { generateCrosswordThemeContent } from "./generate"
import { buildCrosswordThemeSystemPrompt } from "./prompt"
import { buildCrosswordThemePreview, CROSSWORD_PREVIEW_BUILD_ERROR } from "./preview"
import {
  applyCrosswordThemeReplacements,
  buildCrosswordThemeOutputSchema,
  coerceCrosswordThemeEntries,
} from "./schema"
import {
  clueContainsAnswer,
  evaluateTopicKeyDiversity,
  isTrivialInclusion,
  validateCrosswordThemeEntry,
  validateCrosswordThemeGeneration,
} from "./validate"
import type { GeneratedCrosswordThemeEntry } from "./types"

function crosswordSlot(over: Partial<EditorialGameSlot> = {}): EditorialGameSlot {
  return {
    slotId: "slot_cw_theme_1",
    gameId: "CROSSWORD_THEME",
    gameName: "Mots croisés thématiques",
    technicalEngine: "CROSSWORD",
    personalizationType: "THEME",
    templateId: "CROSSWORD_01",
    universeId: "BEAUTY",
    difficulty: 3,
    sourceParticipantIds: [],
    sourceMemoryIds: [],
    sourceFactIds: [],
    sourceInterestIds: ["BEAUTY"],
    sourceJokeIds: [],
    contentRequirements: {
      type: "CROSSWORD_CONTENT",
      targetEntries: 10,
      answerMinLength: 3,
      answerMaxLength: 12,
      requirePersonalSource: false,
      universeId: "BEAUTY",
    },
    reason: "test crossword theme",
    priority: 1,
    seed: "cw-theme-seed",
    ...over,
  }
}

function makeEntry(
  answer: string,
  clue: string,
  topicKey: string,
  topicLabel?: string,
): GeneratedCrosswordThemeEntry {
  return {
    answer,
    normalized: normalizeAnswer(answer),
    clue,
    topicKey,
    topicLabel: topicLabel ?? topicKey,
  }
}

/** Mountain-themed answers proven to build a connected crossword grid. */
const VALID_ENTRIES: GeneratedCrosswordThemeEntry[] = [
  makeEntry("MONTAGNE", "Relief naturel élevé que l'on aime explorer.", "skincare", "relief"),
  makeEntry("CHALET", "Maison typique des séjours en altitude.", "maquillage", "abri"),
  makeEntry("SOMMET", "Point culminant d'un relief.", "parfums", "apex"),
  makeEntry("SENTIER", "Chemin étroit de randonnée.", "cheveux", "chemin"),
  makeEntry("GLACIER", "Immense fleuve de glace permanente.", "ongles", "glace"),
  makeEntry("NEIGE", "Manteau blanc des pentes hivernales.", "skincare", "hiver"),
  makeEntry("AIGLE", "Rapace majestueux des hautes cimes.", "vocabulaire beauté", "oiseau"),
  makeEntry("VALLEE", "Creux encaissé entre deux reliefs.", "routines beauté", "relief"),
  makeEntry("REFUGE", "Abri pour les marcheurs en altitude.", "maquillage", "abri"),
  makeEntry("TORRENT", "Cours d'eau vif dévalant la pente.", "parfums", "eau"),
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

function llmPayloadFromEntries(entries: GeneratedCrosswordThemeEntry[], title = "Cimes") {
  return {
    title,
    entries: entries.map((e) => ({
      answer: e.answer,
      clue: e.clue,
      topicKey: e.topicKey,
      topicLabel: e.topicLabel,
    })),
  }
}

test("payload ne contient aucune donnée personnelle", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const payload = buildCrosswordThemeUserPayload(ctx)
  assert.equal(themePayloadLooksPersonalFree(payload), true)
  assert.equal("editorialDescription" in payload, true)
  assert.equal("targetEntries" in payload, true)
  assert.equal("participants" in payload, false)
})

test("prompt inclut la définition éditoriale de l'univers", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const prompt = buildCrosswordThemeSystemPrompt(ctx)
  assert.match(prompt, /cosmétiques/)
  assert.match(prompt, /clue|définition/i)
})

test("normalisation accents via coerceCrosswordThemeEntries", () => {
  const coerced = coerceCrosswordThemeEntries({
    title: "T",
    entries: [
      {
        answer: "crème",
        clue: "Préparation cosmétique hydratante.",
        topicKey: "skincare",
        topicLabel: "soin",
      },
    ],
  })
  assert.equal(coerced.entries[0]!.normalized, "CREME")
})

test("normalisation espaces tirets apostrophes", () => {
  assert.equal(normalizeAnswer("eau de parfum"), "EAUDEPARFUM")
  assert.equal(normalizeAnswer("Saint-Émilion"), "SAINTEMILION")
  assert.equal(normalizeAnswer("l'aigle"), "LAIGLE")
})

test("answer trop courte rejetée", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const errors = validateCrosswordThemeEntry(
    makeEntry("AB", "Deux lettres seulement ici.", "skincare"),
    ctx,
    1,
  )
  assert.ok(errors.some((e) => /trop courte/i.test(e)))
})

test("answer trop longue rejetée", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const long = "A".repeat(13)
  const errors = validateCrosswordThemeEntry(
    makeEntry(long, "Mot artificiellement trop long pour la grille.", "skincare"),
    ctx,
    1,
  )
  assert.ok(errors.some((e) => /trop longue/i.test(e)))
})

test("doublons après normalisation rejetés", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const entries = [
    ...VALID_ENTRIES.slice(0, 8),
    makeEntry("Crème", "Préparation cosmétique hydratante.", "skincare"),
    makeEntry("CREME", "Autre formulation du même produit.", "skincare"),
  ]
  const result = validateCrosswordThemeGeneration({ title: "T", entries, context: ctx })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /doublon/i.test(e)))
  }
})

test("singulier/pluriel trivial rejeté", () => {
  assert.equal(isTrivialInclusion("PARFUM", "PARFUMS"), true)
  assert.equal(isTrivialInclusion("SERUM", "MASCARA"), false)
})

test("clue vide rejetée", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const errors = validateCrosswordThemeEntry(
    makeEntry("SERUM", "", "skincare"),
    ctx,
    1,
  )
  assert.ok(errors.some((e) => /clue vide/i.test(e)))
})

test("clue contenant directement answer rejetée", () => {
  assert.equal(clueContainsAnswer("Produit appelé sérum hydratant.", "SERUM"), true)
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const errors = validateCrosswordThemeEntry(
    makeEntry("SERUM", "Produit appelé sérum hydratant.", "skincare"),
    ctx,
    1,
  )
  assert.ok(errors.some((e) => /contient directement/i.test(e)))
})

test("topicKey invalide rejeté", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const entries = VALID_ENTRIES.map((e, i) =>
    i === 0 ? { ...e, topicKey: "sculpture" } : e,
  )
  const result = validateCrosswordThemeGeneration({ title: "T", entries, context: ctx })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /hors allowedTopics/i.test(e)))
  }
})

test("excluded topic rejeté", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const entries = VALID_ENTRIES.map((e, i) =>
    i === 0
      ? makeEntry(
          "MONTAGNE",
          "Courant de peinture Renaissance artistique célèbre.",
          "histoire des cosmétiques",
        )
      : e,
  )
  const result = validateCrosswordThemeGeneration({ title: "T", entries, context: ctx })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /exclu/i.test(e)))
  }
})

test("diversité topicKeys — minimum 3 si >=4 allowedTopics", () => {
  const ctx = buildCrosswordThemeContext({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
  })
  const mono = VALID_ENTRIES.map((e) => ({ ...e, topicKey: "skincare" }))
  const bad = evaluateTopicKeyDiversity({
    entries: mono,
    allowedTopics: ctx.allowedTopics,
  })
  assert.equal(bad.ok, false)

  const good = evaluateTopicKeyDiversity({
    entries: VALID_ENTRIES,
    allowedTopics: ctx.allowedTopics,
  })
  assert.equal(good.ok, true)
  assert.ok(good.distinctCount >= 3)
})

test("adaptation vers moteur CROSSWORD + grille constructible", () => {
  const input = toCrosswordThemeEngineInput({
    seed: "engine-cw",
    entries: VALID_ENTRIES,
  })
  const result = generateGame("CROSSWORD", input)
  assert.equal(result.success, true)
})

test("même seed + même contenu = même grille", () => {
  const input = toCrosswordThemeEngineInput({
    seed: "deterministic-cw",
    entries: VALID_ENTRIES,
  })
  const a = generateGame("CROSSWORD", input)
  const b = generateGame("CROSSWORD", input)
  assert.equal(a.success, true)
  assert.equal(b.success, true)
  if (a.success && b.success) {
    assert.deepEqual(a.cells, b.cells)
  }
})

test("grille non constructible déclenche réparation ou ENGINE_REJECTED", async () => {
  const disconnected = Array.from({ length: 10 }, (_, i) =>
    makeEntry(
      ["ABC", "DEF", "GHI", "JKL", "MNO", "PQR", "STU", "VWX", "YZA", "BCD"][i]!,
      "Définition artificielle sans lettres communes utiles.",
      ["skincare", "maquillage", "parfums", "cheveux", "ongles"][i % 5]!,
    ),
  )

  let calls = 0
  const provider = new FakeContentGenerationProvider(async (req) => {
    calls += 1
    if (req.schemaName === "crossword_theme_v1") {
      return { ok: true, data: llmPayloadFromEntries(disconnected) }
    }
    // Repair returns same disconnected set → engine still fails
    if (req.schemaName === "crossword_theme_repair_v1") {
      const indexes = (req.schema.properties as { replacements?: { maxItems?: number } })
        ?.replacements
      const n = indexes?.maxItems ?? 3
      return {
        ok: true,
        data: {
          replacements: disconnected.slice(-n).map((e, i) => ({
            index: disconnected.length - n + i + 1,
            answer: e.answer,
            clue: e.clue,
            topicKey: e.topicKey,
            topicLabel: e.topicLabel,
          })),
        },
      }
    }
    return { ok: false, code: "INVALID_JSON", message: "unexpected" }
  })

  const result = await generateCrosswordThemeContent({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
    provider,
    maxRepairAttempts: 1,
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(
      result.code === "ENGINE_REJECTED" || result.code === "VALIDATION_FAILED",
      result.code,
    )
  }
  assert.ok(calls >= 1)
})

test("réparation ciblée max 1 — remplace topicKey invalide", async () => {
  let call = 0
  const provider = new FakeContentGenerationProvider(async (req) => {
    call += 1
    if (req.schemaName === "crossword_theme_v1") {
      const bad = VALID_ENTRIES.map((e, i) =>
        i === 0
          ? {
              answer: e.answer,
              clue: e.clue,
              topicKey: "sculpture",
              topicLabel: e.topicLabel,
            }
          : {
              answer: e.answer,
              clue: e.clue,
              topicKey: e.topicKey,
              topicLabel: e.topicLabel,
            },
      )
      return { ok: true, data: { title: "Cimes", entries: bad } }
    }
    if (req.schemaName === "crossword_theme_repair_v1") {
      return {
        ok: true,
        data: {
          replacements: [
            {
              index: 1,
              answer: "MONTAGNE",
              clue: "Relief naturel élevé que l'on aime explorer.",
              topicKey: "skincare",
              topicLabel: "relief",
            },
          ],
        },
      }
    }
    return { ok: false, code: "INVALID_JSON", message: "unexpected" }
  })

  const result = await generateCrosswordThemeContent({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
    provider,
    maxRepairAttempts: 1,
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.repaired, true)
    assert.equal(call, 2)
    assert.equal(result.gridBuildable, true)
    assert.equal(result.engineResult.success, true)
  }
})

test("pipeline complet avec fake provider", async () => {
  const result = await generateCrosswordThemeContent({
    slot: crosswordSlot(),
    universe: beautyUniverse(),
    provider: new FakeContentGenerationProvider(async () => ({
      ok: true,
      data: llmPayloadFromEntries(VALID_ENTRIES),
    })),
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.generated.gameId, "CROSSWORD_THEME")
    assert.equal(result.engineResult.success, true)
    assert.equal(result.gridBuildable, true)
  }
})

test("schéma structured output inclut enum dynamique allowedTopics", () => {
  const keys = UNIVERSE_EDITORIAL_DEFAULTS.BEAUTY!.allowedTopics.slice(0, 4)
  const schema = buildCrosswordThemeOutputSchema({
    targetEntries: 10,
    allowedTopics: keys,
  })
  const entriesProp = (schema.properties as Record<string, unknown>).entries as {
    items?: { properties?: { topicKey?: { enum?: string[] } } }
  }
  assert.deepEqual(entriesProp.items?.properties?.topicKey?.enum, keys)
})

test("preview Lab : résultat valide fournit cells pour CrosswordTemplate", () => {
  const preview = buildCrosswordThemePreview(VALID_ENTRIES, "lab-cw-preview")
  assert.equal(preview.ok, true)
  if (preview.ok) {
    assert.equal(preview.crossword.success, true)
    assert.ok(preview.crossword.cells.length > 0)
    assert.ok(preview.crossword.across.length + preview.crossword.down.length >= 4)
  }
})

test("preview Lab : même entries + seed => même grille", () => {
  const a = buildCrosswordThemePreview(VALID_ENTRIES, "stable-cw")
  const b = buildCrosswordThemePreview(VALID_ENTRIES, "stable-cw")
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    assert.deepEqual(a.crossword.cells, b.crossword.cells)
  }
})

test("preview Lab : liste vide => message admin clair", () => {
  const preview = buildCrosswordThemePreview([], "seed")
  assert.equal(preview.ok, false)
  if (!preview.ok) {
    assert.equal(preview.message, CROSSWORD_PREVIEW_BUILD_ERROR)
  }
})

test("instructions CROSSWORD_01 génériques — jamais « montagne »", async () => {
  const { CROSSWORD_01_INSTRUCTION, CROSSWORD_01_SAMPLE, QUIZ_01_SAMPLE, WORDSEARCH_01_SAMPLE } =
    await import("@/lib/book-renderer/templates")
  assert.equal(CROSSWORD_01_SAMPLE.instruction, CROSSWORD_01_INSTRUCTION)
  assert.equal(CROSSWORD_01_INSTRUCTION, "Complétez la grille à l'aide des définitions.")
  assert.equal(/montagne/i.test(CROSSWORD_01_SAMPLE.instruction), false)
  assert.equal(/montagne/i.test(QUIZ_01_SAMPLE.instruction), false)
  assert.equal(/montagne/i.test(WORDSEARCH_01_SAMPLE.instruction), false)
})

test("applyCrosswordThemeReplacements remplace à l'index", () => {
  const next = applyCrosswordThemeReplacements(VALID_ENTRIES.slice(0, 3), [
    {
      index0: 1,
      entry: makeEntry("NEIGE", "Manteau blanc des pentes hivernales.", "skincare"),
    },
  ])
  assert.equal(next[1]!.answer, "NEIGE")
  assert.equal(next[0]!.answer, VALID_ENTRIES[0]!.answer)
})

test("QUIZ_THEME et WORDSEARCH_THEME inchangés (guards gameId)", async () => {
  const quiz = await generateQuizThemeContent({
    slot: {
      ...crosswordSlot(),
      gameId: "QUIZ_THEME",
      technicalEngine: "QUIZ",
      templateId: "QUIZ_01",
      contentRequirements: {
        type: "QUIZ_CONTENT",
        targetQuestions: 6,
        choicesPerQuestion: 4,
        requirePersonalSource: false,
        universeId: "NATURE",
      },
    },
    provider: new FakeContentGenerationProvider(async () => ({
      ok: false,
      code: "NOT_CONFIGURED",
      message: "skip",
    })),
    maxRepairAttempts: 0,
  })
  assert.equal(quiz.ok, false)
  if (!quiz.ok) assert.notEqual(quiz.code, "FORBIDDEN")

  const ws = await generateWordSearchThemeContent({
    slot: {
      ...crosswordSlot(),
      gameId: "WORDSEARCH_THEME",
      technicalEngine: "WORDSEARCH",
      templateId: "WORDSEARCH_01",
      contentRequirements: {
        type: "WORDSEARCH_CONTENT",
        targetWords: 12,
        requirePersonalSource: false,
        universeId: "BEAUTY",
      },
    },
    provider: new FakeContentGenerationProvider(async () => ({
      ok: false,
      code: "NOT_CONFIGURED",
      message: "skip",
    })),
    maxRepairAttempts: 0,
  })
  assert.equal(ws.ok, false)
  if (!ws.ok) assert.notEqual(ws.code, "FORBIDDEN")
})
