import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PERSONALITY_TRAIT_OPTIONS,
  DUO_DYNAMICS_OPTIONS,
  GROUP_TRAIT_OPTIONS,
  createEmptyQuestionnaire,
} from "./types"
import {
  AUDIENCE_OPTIONS,
  FORBIDDEN_SOLO_TRAITS,
  buildJourneySteps,
  getStepCopy,
  memorySuggestions,
  richnessClientMessage,
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

test("DUO affiche dynamique et wording participant vs non", () => {
  const qIn = createEmptyQuestionnaire()
  qIn.audience = "DUO"
  qIn.creatorIsParticipant = true
  assert.match(getStepCopy("interests", qIn).title, /vous aimez ensemble/i)
  assert.match(getStepCopy("memories", qIn).title, /vos souvenirs à deux/i)
  assert.ok(!/cadeau/i.test(getStepCopy("finale", qIn).title))

  const qOut = { ...qIn, creatorIsParticipant: false }
  assert.match(getStepCopy("interests", qOut).title, /ils aiment ensemble/i)
  assert.match(getStepCopy("memories", qOut).title, /leurs souvenirs à deux/i)
  assert.match(getStepCopy("finale", qOut).title, /cadeau/i)

  assert.ok(DUO_DYNAMICS_OPTIONS.includes("opposés mais complémentaires"))
  assert.ok(memorySuggestions("DUO").some((s) => /rencontre/i.test(s)))
})

test("GROUP copy dédiée + private jokes", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "GROUP"
  q.creatorIsParticipant = true
  assert.match(getStepCopy("participants", q).title, /votre groupe/i)
  assert.match(getStepCopy("personality", q).title, /bande/i)
  assert.match(getStepCopy("insideJokes", q).title, /private jokes/i)

  q.creatorIsParticipant = false
  assert.match(getStepCopy("participants", q).title, /^Présentez le groupe$/)
  assert.match(getStepCopy("memories", q).title, /souvenirs du groupe/i)
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
