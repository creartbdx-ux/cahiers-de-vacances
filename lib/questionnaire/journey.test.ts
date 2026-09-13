import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PERSONALITY_TRAIT_OPTIONS,
  DUO_DYNAMICS_OPTIONS,
  GROUP_TRAIT_OPTIONS,
  createEmptyQuestionnaire,
  newId,
} from "./types"
import {
  AUDIENCE_OPTIONS,
  FORBIDDEN_SOLO_TRAITS,
  buildJourneySteps,
  clearGroupParticularity,
  getStepCopy,
  listGroupParticularities,
  memorySuggestions,
  richnessClientMessage,
  setGroupParticularity,
  truncateTagList,
} from "./journey"

test("parcours ME sans étape private jokes, avec color+style séparés", () => {
  const steps = buildJourneySteps("ME", true)
  assert.ok(!steps.includes("insideJokes"))
  assert.ok(steps.includes("color"))
  assert.ok(steps.includes("style"))
  assert.ok(!steps.includes("visual" as never))
  assert.equal(steps.at(-1), "recap")
})

test("parcours GROUP a private jokes et plus d'étapes que ME", () => {
  const me = buildJourneySteps("ME", true)
  const group = buildJourneySteps("GROUP", true)
  assert.ok(group.includes("insideJokes"))
  assert.ok(group.length > me.length)
})

test("ME copy : 2e personne, pas de wording duo/groupe/cadeau", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "ME"
  q.creatorIsParticipant = true

  const titles = buildJourneySteps("ME", true).map((s) => getStepCopy(s, q).title)
  const blob = titles.join(" | ").toLowerCase()

  assert.ok(titles.some((t) => /parlons de vous/i.test(t)))
  assert.ok(titles.some((t) => /votre personnalité/i.test(t)))
  assert.ok(titles.some((t) => /ce que vous aimez/i.test(t)))
  assert.ok(!/les participants|opposés mais complémentaires|cadeau|leur duo|la bande/i.test(blob))

  const finale = getStepCopy("finale", q)
  assert.ok(/dernière chose/i.test(finale.title))
  assert.ok(!/message|cadeau|mot personnel/i.test(finale.title))
})

test("OTHER_PERSON copy : formulations à la 3e personne", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "OTHER_PERSON"
  q.creatorIsParticipant = false

  assert.match(getStepCopy("participants", q).title, /cette personne/i)
  assert.match(getStepCopy("personality", q).title, /sa personnalité/i)
  assert.match(getStepCopy("interests", q).title, /il\/elle aime/i)
  assert.match(getStepCopy("memories", q).title, /souvenirs à son sujet/i)
  assert.match(getStepCopy("finale", q).subtitle ?? "", /mot personnel|précision/i)
})

test("DUO participant : wording vous / vos", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "DUO"
  q.creatorIsParticipant = true

  assert.match(getStepCopy("participants", q).title, /vous deux/i)
  assert.match(getStepCopy("participants", q).subtitle ?? "", /votre duo/i)
  assert.match(getStepCopy("personality", q).title, /votre duo/i)
  assert.match(getStepCopy("interests", q).title, /vous aimez ensemble/i)
  assert.match(getStepCopy("memories", q).title, /vos souvenirs à deux/i)
  assert.ok(!/cadeau/i.test(getStepCopy("finale", q).title))
  assert.ok(DUO_DYNAMICS_OPTIONS.includes("opposés mais complémentaires"))
})

test("DUO non participant : wording elles / leurs", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "DUO"
  q.creatorIsParticipant = false

  assert.match(getStepCopy("participants", q).title, /ces deux personnes/i)
  assert.match(getStepCopy("participants", q).subtitle ?? "", /leur duo/i)
  assert.match(getStepCopy("personality", q).title, /leur duo/i)
  assert.match(getStepCopy("interests", q).title, /elles aiment ensemble/i)
  assert.match(getStepCopy("memories", q).title, /leurs souvenirs à deux/i)
  assert.match(getStepCopy("finale", q).title, /cadeau/i)
  assert.ok(memorySuggestions("DUO").some((s) => /rencontre/i.test(s)))
})

test("GROUP participant : wording votre / vos", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "GROUP"
  q.creatorIsParticipant = true

  assert.match(getStepCopy("participants", q).title, /votre groupe/i)
  assert.match(getStepCopy("personality", q).title, /votre bande/i)
  assert.match(getStepCopy("interests", q).title, /vous aimez faire ensemble/i)
  assert.match(getStepCopy("memories", q).title, /souvenirs de votre bande/i)
  assert.match(getStepCopy("insideJokes", q).title, /^Vos private jokes$/)
})

test("GROUP non participant : wording ils / leurs", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "GROUP"
  q.creatorIsParticipant = false

  assert.match(getStepCopy("participants", q).title, /Présentez-nous ce groupe/)
  assert.match(getStepCopy("personality", q).title, /cette bande/i)
  assert.match(getStepCopy("interests", q).title, /ils aiment faire ensemble/i)
  assert.match(getStepCopy("memories", q).title, /souvenirs du groupe/i)
  assert.match(getStepCopy("insideJokes", q).title, /^Leurs private jokes$/)

  const blob = buildJourneySteps("GROUP", false)
    .map((s) => {
      const c = getStepCopy(s, q)
      return `${c.title} ${c.subtitle ?? ""}`
    })
    .join(" | ")
    .toLowerCase()
  assert.ok(!/\bvotre bande\b|\bvos private jokes\b|\bvous aimez faire ensemble\b/.test(blob))
})

test("GROUP particularités : aucune auto, ajout et suppression", () => {
  const a = newId("p")
  const b = newId("p")
  const participants = [
    { id: a, firstName: "Thomas", ageBracket: "26-35" as const, personalTrait: undefined as string | undefined },
    { id: b, firstName: "Léa", ageBracket: "26-35" as const, personalTrait: undefined as string | undefined },
  ]

  assert.deepEqual(listGroupParticularities(participants), [])

  const withOne = setGroupParticularity(participants, a, "Il est toujours en retard")
  assert.equal(listGroupParticularities(withOne).length, 1)
  assert.equal(listGroupParticularities(withOne)[0].text, "Il est toujours en retard")
  assert.equal(listGroupParticularities(withOne)[0].participantId, a)

  const cleared = clearGroupParticularity(withOne, a)
  assert.deepEqual(listGroupParticularities(cleared), [])
  assert.equal(cleared.find((p) => p.id === a)?.personalTrait, undefined)

  const emptyOk = setGroupParticularity(participants, a, "   ")
  assert.deepEqual(listGroupParticularities(emptyOk), [])
})

test("récap truncateTagList : listes courtes et longues", () => {
  const short = truncateTagList(["A", "B", "C"], 6)
  assert.deepEqual(short.visible, ["A", "B", "C"])
  assert.equal(short.overflow, 0)

  const long = truncateTagList(["1", "2", "3", "4", "5", "6", "7", "8"], 6)
  assert.deepEqual(long.visible, ["1", "2", "3", "4", "5", "6"])
  assert.equal(long.overflow, 2)
})

test("traits individuels ME/OTHER excluent traits relationnels", () => {
  for (const forbidden of FORBIDDEN_SOLO_TRAITS) {
    assert.ok(!(PERSONALITY_TRAIT_OPTIONS as readonly string[]).includes(forbidden))
  }
  assert.ok(!(PERSONALITY_TRAIT_OPTIONS as readonly string[]).includes("complice"))
  assert.ok(GROUP_TRAIT_OPTIONS.includes("complice"))
  assert.ok(!(GROUP_TRAIT_OPTIONS as readonly string[]).includes("opposés mais complémentaires"))
})

test("labels audience UX sans IDs techniques", () => {
  const labels = AUDIENCE_OPTIONS.map((o) => o.label).join(" ")
  assert.match(labels, /Pour moi/)
  assert.match(labels, /Pour quelqu'un/)
  assert.match(labels, /deux personnes/)
  assert.match(labels, /groupe d'amis/)
})

test("richnessClientMessage n'expose pas RICH/ENOUGH", () => {
  assert.ok(!/RICH|ENOUGH|INSUFFICIENT/.test(richnessClientMessage("RICH")))
  assert.ok(!/RICH|ENOUGH|INSUFFICIENT/.test(richnessClientMessage("ENOUGH")))
  assert.match(richnessClientMessage("RICH"), /particulièrement personnalisé/i)
})

test("progression dynamique : étapes réellement présentes", () => {
  const me = buildJourneySteps("ME", true)
  const duo = buildJourneySteps("DUO", false)
  assert.equal(me.filter((s) => s === "insideJokes").length, 0)
  assert.equal(duo.filter((s) => s === "insideJokes").length, 1)
  assert.equal(me.indexOf("color") < me.indexOf("style"), true)
})
