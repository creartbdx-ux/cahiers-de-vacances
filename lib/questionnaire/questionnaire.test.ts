import assert from "node:assert/strict"
import { test } from "node:test"
import { deriveCreatorIsParticipant } from "./audience"
import { buildBookProfile } from "./build-profile"
import { normalizeBookProfileCreator } from "./creator"
import { calculateProfileRichness } from "./richness"
import {
  createEmptyQuestionnaire,
  newId,
  QUESTIONNAIRE_SCHEMA_VERSION,
  type QuestionnaireV1,
} from "./types"
import { validateQuestionnaireComplete, validateStep } from "./validate"
import { buildPersonalEditorialAudienceContext } from "../personal-editorial/audience-context"
import { extractPersonalSourceFacts } from "../personal-editorial/facts"

function baseSolo(audience: "ME" | "OTHER_PERSON"): QuestionnaireV1 {
  const pid = newId("p")
  return {
    ...createEmptyQuestionnaire(),
    audience,
    creatorIsParticipant: audience === "ME",
    ...(audience === "OTHER_PERSON" ? { creatorFirstName: "Emma" } : {}),
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
    creatorParticipantId: a,
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
    creatorFirstName: "Emma",
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

test("OTHER_PERSON valide", () => {
  const q = baseSolo("OTHER_PERSON")
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.creatorIsParticipant, false)
  assert.equal(profile.participants[0].relationship, "ami")
  assert.equal(profile.creator?.firstName, "Emma")
  assert.equal(profile.creator?.isParticipant, false)
  assert.equal(profile.creator?.participantId, null)
})

test("ME valide", () => {
  const q = baseSolo("ME")
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.audience, "ME")
  assert.equal(profile.creatorIsParticipant, true)
  assert.equal(profile.schemaVersion, 1)
  assert.equal(profile.creator?.firstName, "Alex")
  assert.equal(profile.creator?.isParticipant, true)
  assert.equal(profile.creator?.participantId, q.participants[0]!.id)
  const richness = calculateProfileRichness(q, profile)
  assert.equal(richness.canCreate, true)
  assert.ok(richness.level === "LIGHT" || richness.level === "PERSONALIZED" || richness.level === "RICH")
})

test("DUO valide", () => {
  const q = baseDuo()
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.audience, "DUO")
  assert.equal(profile.duoType, "COUPLE")
  assert.equal(profile.sharedProfile.duoDescription, "Un duo voyageur et taquin.")
  assert.equal(profile.individualProfiles.length, 2)
  assert.equal(profile.creator?.firstName, "Léa")
  assert.equal(profile.creator?.participantId, q.participants[0]!.id)
  assert.equal(profile.creator?.isParticipant, true)
})

test("GROUP valide", () => {
  const q = baseGroup(4)
  assert.deepEqual(validateQuestionnaireComplete(q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.participants.length, 4)
  assert.equal(profile.sharedProfile.groupTraits?.length, 3)
  assert.equal(profile.creator?.firstName, "Emma")
  assert.equal(profile.creator?.isParticipant, false)
  assert.equal(profile.creator?.participantId, null)
})

test("GROUP > 10 refusé", () => {
  const q = baseGroup(11)
  const errors = validateQuestionnaireComplete(q)
  assert.ok(errors.some((e) => /10|Maximum|GROUP/i.test(e)))
})

test("minimum 1 intérêt", () => {
  const q = baseSolo("ME")
  q.interestUniverseIds = []
  assert.ok(validateStep("interests", q).length > 0)
  q.interestUniverseIds = ["MOUNTAIN"]
  assert.deepEqual(validateStep("interests", q), [])
})

test("personal facts facultatifs (0 OK)", () => {
  const q = baseSolo("ME")
  q.personalFacts = []
  assert.deepEqual(validateStep("personalFacts", q), [])
  assert.deepEqual(validateQuestionnaireComplete(q), [])
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
  const light = calculateProfileRichness(q)
  assert.equal(light.level, "PERSONALIZED") // has personalFacts in baseSolo
  assert.equal(light.canCreate, true)

  q.personalFacts = []
  const coreOnly = calculateProfileRichness(q)
  assert.equal(coreOnly.level, "LIGHT")
  assert.equal(coreOnly.canCreate, true)

  q.memories = [{ id: "m1", text: "Premier sommet ensemble" }]
  const rich = calculateProfileRichness(q)
  assert.equal(rich.level, "RICH")

  q.interestUniverseIds = []
  const incomplete = calculateProfileRichness(q)
  assert.equal(incomplete.level, "LIGHT")
  assert.equal(incomplete.canCreate, false)
  assert.ok(incomplete.missing.length > 0)
})

test("OTHER_PERSON exige creatorFirstName", () => {
  const q = baseSolo("OTHER_PERSON")
  q.creatorFirstName = null
  assert.ok(validateStep("participants", q).some((e) => /prénom/i.test(e)))
})

test("DUO participant exige creatorParticipantId", () => {
  const q = baseDuo()
  q.creatorParticipantId = null
  assert.ok(validateStep("participants", q).some((e) => /qui êtes-vous|personnes/i.test(e)))
})

test("GROUP participant sélectionne creator participant", () => {
  const q = baseGroup(3)
  q.creatorIsParticipant = true
  q.creatorFirstName = null
  q.creatorParticipantId = q.participants[1]!.id
  assert.deepEqual(validateStep("participants", q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.creator?.firstName, "P2")
  assert.equal(profile.creator?.participantId, q.participants[1]!.id)
})

test("DUO non participant demande prénom créateur", () => {
  const q = baseDuo()
  q.creatorIsParticipant = false
  q.creatorParticipantId = null
  q.creatorFirstName = null
  assert.ok(validateStep("participants", q).some((e) => /prénom/i.test(e)))
  q.creatorFirstName = "Camille"
  assert.deepEqual(validateStep("participants", q), [])
  const profile = buildBookProfile(q)
  assert.equal(profile.creator?.firstName, "Camille")
  assert.equal(profile.creator?.participantId, null)
})

test("anciens BookProfile sans creator restent lisibles", () => {
  const legacy = {
    ...buildBookProfile(baseSolo("ME")),
  }
  delete (legacy as { creator?: unknown }).creator
  const normalized = normalizeBookProfileCreator(legacy)
  assert.equal(normalized.firstName, "Alex")
  assert.equal(normalized.isParticipant, true)

  const legacyOther = {
    ...buildBookProfile(baseSolo("OTHER_PERSON")),
  }
  delete (legacyOther as { creator?: unknown }).creator
  const n2 = normalizeBookProfileCreator(legacyOther)
  assert.equal(n2.firstName, null)
  assert.equal(n2.isParticipant, false)
})

test("creatorName jamais inventé depuis email", () => {
  const profile = buildBookProfile(baseSolo("OTHER_PERSON"))
  profile.creator = { firstName: null, isParticipant: false, participantId: null }
  const ctx = buildPersonalEditorialAudienceContext(profile)
  assert.equal(ctx.creatorName, null)
})

test("fixture Emma → Sami : creator opinion owner correct", () => {
  const q = baseSolo("OTHER_PERSON")
  q.creatorFirstName = "Emma"
  q.participants[0]!.firstName = "Sami"
  q.memories = [
    {
      id: "wh",
      text: "J'ai adoré Whitehaven Beach, c'est mon moment préféré de notre voyage.",
    },
  ]
  const profile = buildBookProfile(q)
  assert.equal(profile.creator?.firstName, "Emma")
  const ctx = buildPersonalEditorialAudienceContext(profile)
  assert.equal(ctx.creatorName, "Emma")
  assert.deepEqual(ctx.recipientNames, ["Sami"])
  const facts = extractPersonalSourceFacts({
    sourceId: "wh",
    sourceType: "MEMORY",
    rawText: q.memories[0]!.text,
    ctx,
  })
  assert.ok(facts.creatorOpinions.some((o) => /Emma/i.test(o)))
  assert.ok(!facts.creatorOpinions.some((o) => /créateur/i.test(o)))
})
