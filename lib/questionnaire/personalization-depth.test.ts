import assert from "node:assert/strict"
import { test } from "node:test"
import { buildBookBlueprint } from "@/lib/book-blueprint/planner"
import type { Palette, Style } from "@/lib/supabase/types"
import {
  computePersonalizationCapabilities,
  normalizePersonalizationDepth,
} from "./capabilities"
import {
  fixtureProfileLight,
  fixtureProfilePersonalized,
  fixtureProfileRich,
} from "./fixtures"
import { calculateProfileRichness } from "./richness"
import {
  createEmptyQuestionnaire,
  newId,
  type QuestionnaireV1,
} from "./types"
import { validateQuestionnaireComplete, validateStep } from "./validate"
import { buildBookProfile } from "./build-profile"
import { richnessClientMessage } from "./journey"

const STYLES: Style[] = [
  {
    id: "RETRO",
    name: "Rétro",
    description: null,
    typography_title: null,
    typography_body: null,
    decor_density: null,
    active: true,
    created_at: "",
    updated_at: "",
  },
]

const PALETTES: Palette[] = [
  {
    id: "ORANGE",
    name: "Orange",
    primary_color: "#ea580c",
    secondary_color: "#fdba74",
    accent_color: "#2563eb",
    background_color: "#fff7ed",
    text_color: "#111",
    active: true,
    created_at: "",
    updated_at: "",
  },
]

function lightQuestionnaire(): QuestionnaireV1 {
  const pid = newId("p")
  return {
    ...createEmptyQuestionnaire(),
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    creatorFirstName: "Emma",
    participants: [
      { id: pid, firstName: "Laure", ageBracket: "26-35", relationship: "sœur" },
    ],
    personality: {
      traitsByParticipantId: { [pid]: ["drôle", "solaire", "créatif"] },
    },
    interestUniverseIds: ["TRAVEL", "FOOD", "MUSIC"],
    personalFacts: [],
    memories: [],
    insideJokes: [],
    gamePreferences: { likedTypes: ["QUIZ", "WORDSEARCH"], difficulty: 2 },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    visualPreferences: { paletteId: "ORANGE", styleId: "RETRO" },
  }
}

test("PROFILE LIGHT : capabilities + depth LIGHT", () => {
  const profile = fixtureProfileLight()
  const caps = computePersonalizationCapabilities(profile)
  assert.equal(caps.depth, "LIGHT")
  assert.equal(caps.hasMemories, false)
  assert.equal(caps.hasPhotos, false)
  assert.equal(caps.hasRecipientName, true)
  assert.equal(caps.hasTraits, true)
  assert.equal(caps.hasInterests, true)
})

test("PROFILE PERSONALIZED : depth PERSONALIZED + close people", () => {
  const caps = computePersonalizationCapabilities(fixtureProfilePersonalized())
  assert.equal(caps.depth, "PERSONALIZED")
  assert.equal(caps.hasClosePeople, true)
  assert.equal(caps.hasFamilyContext, true)
  assert.equal(caps.hasPersonalFacts, true)
  assert.equal(caps.hasMemories, false)
})

test("PROFILE RICH : depth RICH + deep + photo", () => {
  const caps = computePersonalizationCapabilities(fixtureProfileRich())
  assert.equal(caps.depth, "RICH")
  assert.equal(caps.hasMemories, true)
  assert.equal(caps.hasInsideJokes, true)
  assert.equal(caps.hasPhotos, true)
  assert.equal(caps.hasBirthDate, true)
})

test("LIGHT questionnaire : création OK sans facts/memories/photos", () => {
  const q = lightQuestionnaire()
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  assert.deepEqual(validateStep("personalFacts", q), [])
  assert.deepEqual(validateStep("memories", q), [])
  const richness = calculateProfileRichness(q)
  assert.equal(richness.canCreate, true)
  assert.equal(richness.level, "LIGHT")
  assert.ok(!/insuffisant/i.test(richness.message))
  assert.ok(!/INSUFFICIENT/.test(richnessClientMessage(richness.level)))
})

test("ME/DUO/GROUP : deep fields jamais requis", () => {
  for (const audience of ["ME", "DUO", "GROUP"] as const) {
    const q = lightQuestionnaire()
    if (audience === "ME") {
      q.audience = "ME"
      q.creatorIsParticipant = true
      q.creatorFirstName = null
      q.participants[0]!.firstName = "Alex"
      q.participants[0]!.relationship = undefined
    } else if (audience === "DUO") {
      const a = newId("p")
      const b = newId("p")
      q.audience = "DUO"
      q.creatorIsParticipant = true
      q.creatorParticipantId = a
      q.duoType = "FRIENDS"
      q.participants = [
        { id: a, firstName: "Léa", ageBracket: "26-35" },
        { id: b, firstName: "Noah", ageBracket: "26-35" },
      ]
      q.personality = {
        traitsByParticipantId: {},
        duoDescription: "Duo complice",
        duoDynamics: ["complice", "taquin"],
      }
    } else {
      q.audience = "GROUP"
      q.creatorIsParticipant = false
      q.creatorFirstName = "Emma"
      q.participants = [
        { id: newId("p"), firstName: "A" },
        { id: newId("p"), firstName: "B" },
        { id: newId("p"), firstName: "C" },
      ]
      q.personality = {
        traitsByParticipantId: {},
        groupTraits: ["fêtard", "complice", "gourmand"],
      }
    }
    q.personalFacts = []
    q.memories = []
    q.photos = []
    assert.deepEqual(validateQuestionnaireComplete(q), [], audience)
    assert.equal(calculateProfileRichness(q).canCreate, true, audience)
  }
})

test("normalizePersonalizationDepth legacy mapping", () => {
  assert.equal(normalizePersonalizationDepth("INSUFFICIENT"), "LIGHT")
  assert.equal(normalizePersonalizationDepth("ENOUGH"), "PERSONALIZED")
  assert.equal(normalizePersonalizationDepth("RICH"), "RICH")
  assert.equal(normalizePersonalizationDepth("LIGHT"), "LIGHT")
})

test("Blueprint LIGHT : cahier complet, 0 memories/photos OK", () => {
  const profile = fixtureProfileLight()
  const bp = buildBookBlueprint({
    bookProjectId: "proj-light",
    seed: "seed-light-a",
    profile,
    richnessLevel: "LIGHT",
    styles: STYLES,
    palettes: PALETTES,
  })
  assert.equal(bp.pages.length, 50)
  assert.equal(bp.personalizationDepth, "LIGHT")
  assert.ok(bp.stats.byDataNeed.THEME > 0)
  assert.ok(bp.stats.byDataNeed.NEUTRAL + bp.stats.byDataNeed.THEME > 10)
  assert.equal(bp.stats.byDataNeed.PHOTO, 0)
  assert.equal(bp.stats.byDataNeed.DEEP_PERSONAL, 0)
  // No customer-facing rejection codes in reasons
  assert.ok(!bp.pages.some((p) => /rejected|insuffisant|INSUFFICIENT/i.test(p.reason)))
})

test("Blueprint PERSONALIZED : plus de LIGHT_PERSONAL", () => {
  const light = buildBookBlueprint({
    bookProjectId: "p",
    seed: "seed-cmp",
    profile: fixtureProfileLight(),
    richnessLevel: "LIGHT",
    styles: STYLES,
    palettes: PALETTES,
  })
  const personalized = buildBookBlueprint({
    bookProjectId: "p",
    seed: "seed-cmp",
    profile: fixtureProfilePersonalized(),
    richnessLevel: "PERSONALIZED",
    styles: STYLES,
    palettes: PALETTES,
  })
  assert.ok(
    personalized.stats.byDataNeed.LIGHT_PERSONAL >= light.stats.byDataNeed.LIGHT_PERSONAL,
  )
  assert.equal(personalized.personalizationDepth, "PERSONALIZED")
})

test("Blueprint RICH : PHOTO disponible, diversité theme conservée", () => {
  const rich = buildBookBlueprint({
    bookProjectId: "p",
    seed: "seed-rich",
    profile: fixtureProfileRich(),
    richnessLevel: "RICH",
    styles: STYLES,
    palettes: PALETTES,
  })
  assert.equal(rich.personalizationDepth, "RICH")
  assert.ok(rich.stats.byDataNeed.PHOTO > 0)
  assert.ok(rich.stats.byDataNeed.THEME > 0)
  assert.ok(rich.stats.byDataNeed.NEUTRAL >= 0)
})

test("Blueprint déterministe même seed", () => {
  const profile = fixtureProfileLight()
  const a = buildBookBlueprint({
    bookProjectId: "p",
    seed: "det-1",
    profile,
    richnessLevel: "LIGHT",
    styles: STYLES,
    palettes: PALETTES,
  })
  const b = buildBookBlueprint({
    bookProjectId: "p",
    seed: "det-1",
    profile,
    richnessLevel: "LIGHT",
    styles: STYLES,
    palettes: PALETTES,
  })
  assert.deepEqual(
    a.pages.map((p) => p.archetypeId),
    b.pages.map((p) => p.archetypeId),
  )
})

test("buildBookProfile copie closePeople / lifeContext", () => {
  const q = lightQuestionnaire()
  q.closePeople = [{ id: "cp1", firstName: "Lolo", relationship: "ami" }]
  q.lifeContext = { hasPet: true, petNames: ["Rex"] }
  const profile = buildBookProfile(q)
  assert.equal(profile.closePeople?.[0]?.firstName, "Lolo")
  assert.equal(profile.lifeContext?.hasPet, true)
})
