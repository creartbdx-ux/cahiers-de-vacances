import { test } from "node:test"
import assert from "node:assert/strict"
import {
  resolveUniverseEditorial,
  topicHitsExcluded,
  topicMatchesAllowed,
  UNIVERSE_EDITORIAL_DEFAULTS,
} from "./editorial"

test("BEAUTY defaults: cosmétiques, pas beaux-arts", () => {
  const beauty = resolveUniverseEditorial({ id: "BEAUTY", name: "Beauté" })
  assert.ok(/cosmétiques|soins personnels/i.test(beauty.editorialDescription))
  assert.ok(beauty.allowedTopics.some((t) => /skincare|maquillage|parfum/i.test(t)))
  assert.ok(beauty.excludedTopics.some((t) => /peinture|architecture|sculpture/i.test(t)))
  assert.ok(beauty.quizGuidance)
  assert.equal(beauty.hasTopicFrame, true)
})

test("BEAUTY exclut peinture / architecture / sculpture / esthétique", () => {
  const { excludedTopics } = UNIVERSE_EDITORIAL_DEFAULTS.BEAUTY!
  assert.ok(topicHitsExcluded("peinture Renaissance", "Botticelli", excludedTopics))
  assert.ok(topicHitsExcluded("architecture", "Alhambra", excludedTopics))
  assert.ok(topicHitsExcluded("sculpture antique", "Vénus de Milo", excludedTopics))
  assert.ok(topicHitsExcluded("esthétique japonaise", "wabi-sabi", excludedTopics))
  assert.ok(topicHitsExcluded("histoire du design", "Art nouveau", excludedTopics))
})

test("BEAUTY accepte skincare / maquillage / cheveux / parfum / cosmétique", () => {
  const { allowedTopics } = UNIVERSE_EDITORIAL_DEFAULTS.BEAUTY!
  assert.equal(topicMatchesAllowed("skincare", allowedTopics), true)
  assert.equal(topicMatchesAllowed("maquillage", allowedTopics), true)
  assert.equal(topicMatchesAllowed("cheveux", allowedTopics), true)
  assert.equal(topicMatchesAllowed("parfums", allowedTopics), true)
  assert.equal(topicMatchesAllowed("cosmétique", allowedTopics), true)
  assert.equal(topicMatchesAllowed("routines beauté", allowedTopics), true)
})

test("univers sans configuration complète : fallback propre", () => {
  const u = resolveUniverseEditorial({
    id: "UNKNOWN_X",
    name: "Inconnu",
    editorial_description: null,
    allowed_topics: [],
    excluded_topics: [],
    quiz_guidance: null,
  })
  assert.equal(u.universeName, "Inconnu")
  assert.ok(u.editorialDescription.includes("Inconnu"))
  assert.deepEqual(u.allowedTopics, [])
  assert.deepEqual(u.excludedTopics, [])
  assert.equal(u.hasTopicFrame, false)
  assert.equal(topicMatchesAllowed("n'importe quoi", u.allowedTopics), true)
  assert.equal(topicHitsExcluded("peinture", "x", u.excludedTopics), null)
})

test("DB fields override code defaults when present", () => {
  const u = resolveUniverseEditorial({
    id: "BEAUTY",
    name: "Beauté",
    editorial_description: "Description admin custom.",
    allowed_topics: ["vernis"],
    excluded_topics: ["peinture"],
    quiz_guidance: "Guidance admin.",
  })
  assert.equal(u.editorialDescription, "Description admin custom.")
  assert.deepEqual(u.allowedTopics, ["vernis"])
  assert.deepEqual(u.excludedTopics, ["peinture"])
  assert.equal(u.quizGuidance, "Guidance admin.")
})
