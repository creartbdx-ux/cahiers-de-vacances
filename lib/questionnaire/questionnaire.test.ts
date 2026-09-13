import assert from "node:assert/strict"
import { test } from "node:test"
import { deriveCreatorIsParticipant } from "./audience"
import { buildBookProfile } from "./build-profile"
import { calculateProfileRichness } from "./richness"
import {
  createEmptyQuestionnaire,
  newId,
  QUESTIONNAIRE_SCHEMA_VERSION,
  type QuestionnaireV1,
} from "./types"
import { validateQuestionnaireComplete, validateStep } from "./validate"

function baseSolo(audience: "ME" | "OTHER_PERSON"): QuestionnaireV1 {
  const pid = newId("p")
  return {
    ...createEmptyQuestionnaire(),
    audience,
    creatorIsParticipant: audience === "ME",
    participants: [
      {
        id: pid,
        firstName: audience === "ME" ? "Alex" : "Sam",
        ageBracket: "26-35",
        ...(audience === "OTHER_PERSON" ? { relationship: "ami" } : {}),
      },
    ],
    personality: {
      traitsByParticipantId: { [pid]: ["curieux", "taquin", "gourmand"] },
    },
    interestUniverseIds: ["MOUNTAIN", "TRAVEL", "BEACH"],
    personalFacts: [
      { id: newId("f"), category: "FOOD", value: "Raclette" },
      { id: newId("f"), category: "MUSIC", value: "Jazz" },
      { id: newId("f"), category: "PLACE", value: "Chamonix" },
    ],
    gamePreferences: { likedTypes: ["CROSSWORD", "QUIZ"], difficulty: 2 },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    visualPreferences: { paletteId: "ORANGE", styleId: "RETRO" },
  }
}

function baseDuo(): QuestionnaireV1 {
  const a = newId("p")
  const b = newId("p")
  return {
    ...createEmptyQuestionnaire(),
    audience: "DUO",
    creatorIsParticipant: true,
    duoType: "COUPLE",
    participants: [
      { id: a, firstName: "Léa", ageBracket: "26-35" },
      { id: b, firstName: "Noah", ageBracket: "26-35" },
    ],
    personality: {
      traitsByParticipantId: {
        [a]: ["complice", "taquin"],
        [b]: ["aventurier"],
      },
      duoDescription: "Un duo voyageur et taquin.",
      duoDynamics: ["complice", "aventurier"],
    },
    interestUniverseIds: ["TRAVEL", "BEACH", "FOOD"],
    personalFacts: [
      { id: newId("f"), category: "FOOD", value: "Pizza", participantIds: [a, b] },
      { id: newId("f"), category: "HABIT", value: "Café du matin", participantIds: [a] },
      { id: newId("f"), category: "EXPRESSION", value: "On y go" },
    ],
    gamePreferences: { likedTypes: ["WORDSEARCH", "TRUE_FALSE"], difficulty: 3 },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    visualPreferences: { paletteId: "AUTO", styleId: "AUTO" },
  }
}

function baseGroup(count: number): QuestionnaireV1 {
  const participants = Array.from({ length: count }, (_, i) => ({
    id: newId("p"),
    firstName: `P${i + 1}`,
    ageBracket: "26-35" as const,
  }))
  return {
    ...createEmptyQuestionnaire(),
    audience: "GROUP",
    creatorIsParticipant: false,
    groupName: "La bande",
    participants,
    personality: {
      traitsByParticipantId: {},
      groupTraits: ["fêtard", "complice", "gourmand"],
    },
    interestUniverseIds: ["PARTY", "TRAVEL", "MUSIC"],
    personalFacts: [
      { id: newId("f"), category: "ACTIVITY", value: "Randonnée" },
      { id: newId("f"), category: "DRINK", value: "Spritz" },
      { id: newId("f"), category: "MUSIC", value: "Indie" },
    ],
    gamePreferences: { likedTypes: ["QUIZ", "SURPRISE"], difficulty: 1 },
    forbiddenTopics: { answered: true, hasRestrictions: true, text: "Ex-conjoint" },
    visualPreferences: { paletteId: "BLUE", styleId: "POP" },
  }
}

test("schemaVersion = 1", () => {
  assert.equal(createEmptyQuestionnaire().schemaVersion, QUESTIONNAIRE_SCHEMA_VERSION)
  assert.equal(QUESTIONNAIRE_SCHEMA_VERSION, 1)
})

test("ME valide", () => {
  const q = baseSolo("ME")
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.audience, "ME")
  assert.equal(profile.creatorIsParticipant, true)
  assert.equal(profile.schemaVersion, 1)
  assert.equal(calculateProfileRichness(q, profile).level === "ENOUGH" || calculateProfileRichness(q, profile).level === "RICH", true)
})

test("OTHER_PERSON valide", () => {
  const q = baseSolo("OTHER_PERSON")
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.creatorIsParticipant, false)
  assert.equal(profile.participants[0].relationship, "ami")
})

test("DUO valide", () => {
  const q = baseDuo()
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.audience, "DUO")
  assert.equal(profile.duoType, "COUPLE")
  assert.equal(profile.sharedProfile.duoDescription, "Un duo voyageur et taquin.")
  assert.equal(profile.individualProfiles.length, 2)
})

test("GROUP valide", () => {
  const q = baseGroup(4)
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.participants.length, 4)
  assert.equal(profile.sharedProfile.groupTraits?.length, 3)
})

test("GROUP > 10 refusé", () => {
  const q = baseGroup(11)
  const errors = validateQuestionnaireComplete(q)
  assert.ok(errors.some((e) => /10|Maximum|GROUP/i.test(e)))
})

test("minimum 3 intérêts", () => {
  const q = baseSolo("ME")
  q.interestUniverseIds = ["MOUNTAIN", "TRAVEL"]
  assert.ok(validateStep("interests", q).length > 0)
})

test("minimum 3 personal facts", () => {
  const q = baseSolo("ME")
  q.personalFacts = q.personalFacts.slice(0, 2)
  assert.ok(validateStep("personalFacts", q).length > 0)
})

test("difficulté hors 1–4 refusée", () => {
  const q = baseSolo("ME")
  // @ts-expect-error intentional
  q.gamePreferences.difficulty = 5
  assert.ok(validateQuestionnaireComplete(q).some((e) => /difficulté|1–4|1-4/i.test(e)))
})

test("plus de 10 photos refusé", () => {
  const q = baseSolo("ME")
  q.photos = Array.from({ length: 11 }, (_, i) => ({
    id: `ph_${i}`,
    useAuthorized: true,
  }))
  assert.ok(validateQuestionnaireComplete(q).some((e) => /10|photos/i.test(e)))
})

test("forbiddenTopics explicitement répondu", () => {
  const q = baseSolo("ME")
  q.forbiddenTopics = null
  assert.ok(validateStep("forbidden", q).length > 0)
  assert.throws(() => buildBookProfile(q))
})

test("buildBookProfile n'invente aucune donnée", () => {
  const q = baseSolo("ME")
  q.finalMessage = undefined
  q.memories = []
  const profile = buildBookProfile(q)
  assert.equal(profile.finalMessage, undefined)
  assert.deepEqual(profile.memories, [])
  assert.equal(profile.participants[0].firstName, "Alex")
  assert.ok(!("invented" in profile))
})

test("données communes et individuelles correctement séparées", () => {
  const q = baseDuo()
  const profile = buildBookProfile(q)
  assert.ok(profile.sharedProfile.duoDescription)
  assert.ok(profile.sharedProfile.duoDynamics)
  assert.equal(profile.individualProfiles[0].traits.length >= 1, true)
  assert.ok(!("traitsByParticipantId" in profile.sharedProfile))
})

test("creatorIsParticipant correctement dérivé", () => {
  assert.equal(deriveCreatorIsParticipant("ME", null), true)
  assert.equal(deriveCreatorIsParticipant("OTHER_PERSON", true), false)
  assert.equal(deriveCreatorIsParticipant("DUO", true), true)
  assert.equal(deriveCreatorIsParticipant("DUO", false), false)
  assert.equal(deriveCreatorIsParticipant("GROUP", false), false)
})

test("calculateProfileRichness", () => {
  const q = baseSolo("ME")
  const enough = calculateProfileRichness(q)
  assert.equal(enough.level, "ENOUGH")

  q.memories = [{ id: "m1", text: "Premier sommet ensemble" }]
  const rich = calculateProfileRichness(q)
  assert.equal(rich.level, "RICH")

  q.interestUniverseIds = []
  const insuff = calculateProfileRichness(q)
  assert.equal(insuff.level, "INSUFFICIENT")
  assert.ok(insuff.missing.length > 0)
})
