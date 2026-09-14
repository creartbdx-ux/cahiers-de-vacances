import assert from "node:assert/strict"
import { test } from "node:test"
import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import { FakeContentGenerationProvider, UnconfiguredProvider } from "../provider"
import { toTrueFalseThemeEngineInput } from "./adapter"
import {
  buildTrueFalseThemeContext,
  buildTrueFalseThemeUserPayload,
  themePayloadLooksPersonalFree,
} from "./context"
import { generateTrueFalseThemeContent } from "./generate"
import { buildTrueFalseThemePreview, TRUE_FALSE_THEME_PREVIEW_BUILD_ERROR } from "./preview"
import { applyTrueFalseThemeReplacements, buildTrueFalseThemeOutputSchema } from "./schema"
import { validateTrueFalseThemeGeneration } from "./validate"
import type { GeneratedTrueFalseThemeStatement } from "./types"
import type { TrueFalseThemeStatementStyle } from "./styles"
import { getArchetype, READY_THEME_ARCHETYPE_IDS } from "@/lib/book-blueprint/archetypes"

function themeSlot(over: Partial<EditorialGameSlot> = {}): EditorialGameSlot {
  return {
    slotId: "slot_tf_theme_1",
    gameId: "TRUE_FALSE_THEME",
    gameName: "Vrai ou faux thématique",
    technicalEngine: "TRUE_FALSE",
    personalizationType: "THEME",
    templateId: "TRUE_FALSE_01",
    universeId: "BEAUTY",
    difficulty: 3,
    sourceParticipantIds: [],
    sourceMemoryIds: [],
    sourceFactIds: [],
    sourceInterestIds: ["BEAUTY"],
    sourceJokeIds: [],
    contentRequirements: {
      type: "TRUE_FALSE_CONTENT",
      targetStatements: 8,
      requirePersonalSource: false,
      universeId: "BEAUTY",
    },
    reason: "test tf theme",
    priority: 1,
    seed: "tf-theme-seed",
    ...over,
  }
}

const BEAUTY_KEYS = [
  "skincare",
  "maquillage",
  "cheveux",
  "parfums",
  "ongles",
  "routines beauté",
  "ingrédients cosmétiques",
  "vocabulaire beauté",
] as const

const STYLES: TrueFalseThemeStatementStyle[] = [
  "FACT",
  "COMPARISON",
  "VOCABULARY",
  "FUNCTION",
  "ORIGIN_HISTORY",
  "SURPRISING_FACT",
  "CLASSIFICATION",
  "NUMBER_FACT",
]

function makeS(
  over: Partial<GeneratedTrueFalseThemeStatement> &
    Pick<GeneratedTrueFalseThemeStatement, "id" | "topicKey" | "answer">,
): GeneratedTrueFalseThemeStatement {
  return {
    id: over.id,
    statement:
      over.statement ??
      `En cosmétique, une pratique stable liée à ${over.topicKey} concerne ${over.id}.`,
    answer: over.answer,
    explanation:
      over.explanation ??
      (over.answer
        ? `Parce que ${over.id} repose sur un fait cosmétique stable.`
        : `En réalité, le fait correct est l'inverse de l'affirmation pour ${over.id}.`),
    topicKey: over.topicKey,
    topicLabel: over.topicLabel ?? over.topicKey,
    statementStyle: over.statementStyle ?? "FACT",
  }
}

function validEight(): GeneratedTrueFalseThemeStatement[] {
  return BEAUTY_KEYS.map((topicKey, i) =>
    makeS({
      id: `s${i + 1}`,
      topicKey,
      topicLabel: `détail ${topicKey}`,
      statementStyle: STYLES[i]!,
      answer: i % 2 === 0,
      statement: `Affirmation cosmétique distincte numéro ${i + 1} sur ${topicKey} pour le cahier.`,
    }),
  )
}

function beautyCtx() {
  return buildTrueFalseThemeContext({
    slot: themeSlot(),
    universe: { id: "BEAUTY", name: "Beauté" },
  })
}

test("aucune donnée personnelle envoyée", () => {
  const ctx = beautyCtx()
  const payload = buildTrueFalseThemeUserPayload(ctx)
  assert.equal(themePayloadLooksPersonalFree(payload), true)
  assert.ok(!("personalFacts" in payload))
  assert.ok(payload.universeId)
  assert.ok(payload.editorialDescription)
})

test("contexte univers transmis", () => {
  const ctx = beautyCtx()
  assert.equal(ctx.universeId, "BEAUTY")
  assert.ok(ctx.allowedTopics.length >= 4)
  assert.equal(ctx.targetStatements, 8)
  assert.equal(ctx.difficulty, 3)
})

test("targetStatements=8 par défaut", () => {
  assert.equal(beautyCtx().targetStatements, 8)
})

test("équilibre 4/4 accepté", () => {
  const v = validateTrueFalseThemeGeneration({
    title: "Vrai ou faux : Beauté",
    statements: validEight(),
    context: beautyCtx(),
  })
  assert.equal(v.ok, true)
  if (v.ok) {
    assert.equal(v.trueCount, 4)
    assert.equal(v.falseCount, 4)
  }
})

test("8 vraies rejetées", () => {
  const statements = validEight().map((s) => ({ ...s, answer: true }))
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("8 fausses rejetées", () => {
  const statements = validEight().map((s) => ({
    ...s,
    answer: false,
    explanation: `Correction précise pour ${s.id} : le fait stable est différent.`,
  }))
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("statement vide rejeté", () => {
  const statements = validEight()
  statements[0]!.statement = "   "
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("explanation vide rejetée", () => {
  const statements = validEight()
  statements[0]!.explanation = ""
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("topicKey invalide rejeté", () => {
  const statements = validEight()
  statements[0]!.topicKey = "peinture"
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("excluded topic rejeté", () => {
  const statements = validEight()
  statements[1]!.statement = "La peinture à l'huile est un soin visage classique."
  statements[1]!.topicLabel = "peinture"
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("doublons rejetés", () => {
  const statements = validEight()
  statements[2]!.statement = statements[0]!.statement
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("moins de 4 styles => rejet", () => {
  const statements = validEight().map((s, i) => ({
    ...s,
    statementStyle: (i < 6 ? "FACT" : "COMPARISON") as TrueFalseThemeStatementStyle,
  }))
  // fix consecutive same style for first pairs by alternating two only — still < 4 distinct
  for (let i = 0; i < statements.length; i++) {
    statements[i]!.statementStyle = i % 2 === 0 ? "FACT" : "COMPARISON"
  }
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("double négation évidente rejetée", () => {
  const statements = validEight()
  statements[0]!.statement = "Il n'est pas faux que le sérum hydrate la peau en profondeur."
  const v = validateTrueFalseThemeGeneration({
    title: "x",
    statements,
    context: beautyCtx(),
  })
  assert.equal(v.ok, false)
})

test("réparation ciblée uniquement des invalides", async () => {
  const first = validEight()
  first[1]!.topicKey = "peinture"
  first[1]!.topicLabel = "art"
  first[4]!.statement = "Il n'est pas faux que le mascara allonge les cils."

  const kept = {
    s1: first[0]!.statement,
    s3: first[2]!.statement,
    s4: first[3]!.statement,
    s6: first[5]!.statement,
  }

  let calls = 0
  const provider = new FakeContentGenerationProvider(async (req) => {
    calls += 1
    if (calls === 1) {
      return { ok: true, data: { title: "Info ou intox beauté", statements: first } }
    }
    assert.equal(req.schemaName, "true_false_theme_repair_v1")
    const payload = req.input as { replaceIndexes?: number[] }
    assert.deepEqual(payload.replaceIndexes, [2, 5])
    return {
      ok: true,
      data: {
        replacements: [
          {
            index: 2,
            id: "s2-fixed",
            statement: "Une eau de toilette est généralement plus concentrée qu'une eau de parfum.",
            answer: false,
            explanation:
              "C'est l'inverse : l'eau de parfum est en général plus concentrée en jus parfumé.",
            topicKey: "parfums",
            topicLabel: "concentrations",
            statementStyle: "COMPARISON",
          },
          {
            index: 5,
            id: "s5-fixed",
            statement:
              "Le mascara waterproof résiste en général mieux à l'eau qu'un mascara classique.",
            answer: true,
            explanation: "La formule waterproof est conçue pour mieux tenir au contact de l'eau.",
            topicKey: "maquillage",
            topicLabel: "mascara",
            statementStyle: "ORIGIN_HISTORY",
          },
        ],
      },
    }
  })

  const result = await generateTrueFalseThemeContent({
    slot: themeSlot(),
    universe: { id: "BEAUTY", name: "Beauté" },
    provider,
    maxRepairAttempts: 1,
  })

  assert.equal(result.ok, true)
  assert.equal(calls, 2)
  if (result.ok) {
    assert.equal(result.repaired, true)
    assert.equal(result.repairedCount, 2)
    assert.equal(result.generated.statements[0]!.statement, kept.s1)
    assert.equal(result.generated.statements[2]!.statement, kept.s3)
    assert.equal(result.generated.statements[1]!.id, "s2-fixed")
    assert.equal(result.generated.statements[4]!.id, "s5-fixed")
  }
})

test("max 1 repair", async () => {
  let calls = 0
  const bad = validEight().map((s) => ({ ...s, topicKey: "peinture" }))
  const provider = new FakeContentGenerationProvider(async () => {
    calls += 1
    return { ok: true, data: { title: "x", statements: bad } }
  })
  const result = await generateTrueFalseThemeContent({
    slot: themeSlot(),
    universe: { id: "BEAUTY", name: "Beauté" },
    provider,
    maxRepairAttempts: 1,
  })
  assert.equal(result.ok, false)
  assert.ok(calls <= 2)
})

test("adapter TRUE_FALSE valide", () => {
  const engine = toTrueFalseThemeEngineInput({
    seed: "s",
    statements: validEight(),
  })
  assert.equal(engine.statements.length, 8)
  assert.equal(typeof engine.statements[0]!.correctAnswer, "boolean")
})

test("preview Jeu fonctionne", () => {
  const preview = buildTrueFalseThemePreview(validEight(), "preview-seed")
  assert.equal(preview.ok, true)
  if (preview.ok) {
    assert.equal(preview.trueFalse.statements.length, 8)
    assert.ok(preview.trueFalse.statements.every((s) => s.statement))
  }
})

test("preview Correction réutilise le même contenu", () => {
  const a = buildTrueFalseThemePreview(validEight(), "same-seed")
  const b = buildTrueFalseThemePreview(validEight(), "same-seed")
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    assert.deepEqual(
      a.trueFalse.statements.map((s) => s.statement),
      b.trueFalse.statements.map((s) => s.statement),
    )
    assert.deepEqual(
      a.trueFalse.statements.map((s) => s.correctAnswer),
      b.trueFalse.statements.map((s) => s.correctAnswer),
    )
  }
})

test("preview liste vide => message clair", () => {
  const preview = buildTrueFalseThemePreview([], "x")
  assert.equal(preview.ok, false)
  if (!preview.ok) assert.equal(preview.message, TRUE_FALSE_THEME_PREVIEW_BUILD_ERROR)
})

test("pipeline complet avec fake provider", async () => {
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: { title: "À vous de trancher — Beauté", statements: validEight() },
  }))
  const result = await generateTrueFalseThemeContent({
    slot: themeSlot(),
    universe: { id: "BEAUTY", name: "Beauté" },
    provider,
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.engineResult.success, true)
    assert.equal(result.generated.gameId, "TRUE_FALSE_THEME")
    assert.equal(result.generated.statements.length, 8)
  }
})

test("NOT_CONFIGURED sans clé", async () => {
  const result = await generateTrueFalseThemeContent({
    slot: themeSlot(),
    universe: { id: "BEAUTY", name: "Beauté" },
    provider: new UnconfiguredProvider(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, "NOT_CONFIGURED")
})

test("slot non TRUE_FALSE_THEME rejeté", async () => {
  const result = await generateTrueFalseThemeContent({
    slot: themeSlot({ gameId: "QUIZ_THEME" as "TRUE_FALSE_THEME" }),
    universe: { id: "BEAUTY", name: "Beauté" },
    provider: new FakeContentGenerationProvider(async () => ({
      ok: true,
      data: { title: "x", statements: validEight() },
    })),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, "FORBIDDEN")
})

test("schéma structured output enum topicKey", () => {
  const schema = buildTrueFalseThemeOutputSchema({
    targetStatements: 8,
    allowedTopics: ["skincare", "maquillage"],
  })
  const props = schema.properties as Record<string, unknown>
  assert.ok(props.title)
  assert.ok(props.statements)
})

test("applyTrueFalseThemeReplacements conserve les autres", () => {
  const base = validEight()
  const next = applyTrueFalseThemeReplacements(base, [
    {
      ...makeS({
        id: "fixed",
        topicKey: "skincare",
        answer: false,
        statement: "Remplacement valide d'une affirmation fausse plausible sur le skincare.",
        explanation: "Le fait correct est différent de l'énoncé remplacé.",
        statementStyle: "FACT",
      }),
      index0: 0,
    },
  ])
  assert.equal(next[0]!.id, "fixed")
  assert.equal(next[1]!.id, base[1]!.id)
})

test("Blueprint catalogue THEME_TRUE_FALSE = READY", () => {
  const a = getArchetype("THEME_TRUE_FALSE")
  assert.equal(a.implementationStatus, "READY")
  assert.equal(a.gameId, "TRUE_FALSE_THEME")
  assert.equal(a.estimatedDensity, "LIGHT")
  assert.ok(a.correctionWeight >= 0.35 && a.correctionWeight <= 0.5)
  assert.ok(READY_THEME_ARCHETYPE_IDS.includes("THEME_TRUE_FALSE"))
})

test("QUIZ_THEME inchangé — guards gameId", async () => {
  const result = await generateTrueFalseThemeContent({
    slot: themeSlot({ gameId: "WORDSEARCH_THEME" as "TRUE_FALSE_THEME" }),
    provider: new FakeContentGenerationProvider(async () => ({
      ok: true,
      data: { title: "x", statements: validEight() },
    })),
  })
  assert.equal(result.ok, false)
})
