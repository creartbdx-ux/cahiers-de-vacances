import assert from "node:assert/strict"
import { test } from "node:test"
import { buildBookBlueprint } from "./planner"
import { pageCountsAsPersonalized } from "./personalization-touches"
import {
  fixtureProfileLight,
  fixtureProfilePersonalized,
  fixtureProfileRich,
} from "@/lib/questionnaire/fixtures"
import type { Palette, Style } from "@/lib/supabase/types"

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

function build(profile: ReturnType<typeof fixtureProfileLight>, seed: string, richness: "LIGHT" | "PERSONALIZED" | "RICH") {
  return buildBookBlueprint({
    bookProjectId: "proj",
    seed,
    profile,
    richnessLevel: richness,
    styles: STYLES,
    palettes: PALETTES,
  })
}

test("LIGHT_PERSONAL != type de page personnelle générique", () => {
  const bp = build(fixtureProfileLight(), "touch-light-1", "LIGHT")
  const reflection = bp.pages.filter((p) => p.archetypeId === "PERSONAL_REFLECTION")
  assert.equal(reflection.length, 0, "pas de quota Page personnelle ludique")

  const lightNeed = bp.pages.filter((p) => p.dataNeed === "LIGHT_PERSONAL")
  // Light-need pages are ordinary mechanics (logic/secret/test), not PERSONAL_REFLECTION
  for (const p of lightNeed) {
    assert.notEqual(p.archetypeId, "PERSONAL_REFLECTION")
    assert.ok(
      ["LOGIC_AGE_GAME", "SECRET_WORD_NAME_GAME", "LOGIC_CLOSE_PEOPLE_GAME", "PERSONALITY_TEST_TRAITS", "PERSONAL_QUICK_GAME", "GROUP_QUICK_GAME", "DUO_INTERACTION", "GROUP_WHO_IN_THE_BAND"].includes(
        p.archetypeId,
      ) || p.family === "QUICK_GAME" || p.family === "PERSONAL_GAME",
    )
  }
})

test("touch peut décorer un jeu THEME (mots mêlés)", () => {
  const bp = build(fixtureProfilePersonalized(), "touch-theme-ws", "PERSONALIZED")
  const ws = bp.pages.find(
    (p) =>
      p.archetypeId === "THEME_WORDSEARCH" && (p.personalizationTouches?.length ?? 0) > 0,
  )
  assert.ok(ws, "au moins un mots mêlés avec touches")
  assert.equal(ws!.personalizationType, "THEME")
  assert.ok(
    ws!.personalizationTouches!.some(
      (t) =>
        t.type === "CLOSE_PEOPLE_NAMES" ||
        t.type === "TRAITS" ||
        t.type === "INTERESTS" ||
        t.type === "RECIPIENT_NAME",
    ),
  )
  assert.ok(
    pageCountsAsPersonalized({
      personalizationTouches: ws!.personalizationTouches,
      dataNeed: ws!.dataNeed,
      family: ws!.family,
    }),
  )
})

test("PERSONAL % compte les pages avec touches (pas seulement PERSONAL type)", () => {
  const bp = build(fixtureProfileLight(), "touch-pct", "LIGHT")
  assert.ok(bp.stats.pagesWithTouches >= 5)
  assert.ok(bp.stats.personalPercent > 0)
  // Must be higher than raw PERSONAL family count when touches decorate THEME
  const personalTypeOnly = bp.pages.filter((p) => p.personalizationType === "PERSONAL").length
  assert.ok(bp.stats.pagesWithTouches + bp.stats.photoPages >= personalTypeOnly)
})

test("âge → touch sur archetype logique", () => {
  const bp = build(fixtureProfileLight(), "touch-age", "LIGHT")
  const logic = bp.pages.find((p) => p.archetypeId === "LOGIC_AGE_GAME")
  assert.ok(logic)
  assert.ok(logic!.personalizationTouches?.some((t) => t.type === "RECIPIENT_AGE"))
  assert.match(logic!.label, /logique|âge/i)
})

test("prénom → touch sur mot secret", () => {
  const bp = build(fixtureProfileLight(), "touch-name", "LIGHT")
  const secret = bp.pages.find((p) => p.archetypeId === "SECRET_WORD_NAME_GAME")
  assert.ok(secret)
  assert.ok(
    secret!.personalizationTouches?.some(
      (t) => t.type === "RECIPIENT_NAME" && t.usage === "solution",
    ),
  )
})

test("aucun quota de pages personnelles génériques", () => {
  const bp = build(fixtureProfileLight(), "no-quota", "LIGHT")
  assert.equal(
    bp.pages.filter((p) => p.archetypeId === "PERSONAL_REFLECTION").length,
    0,
  )
  assert.ok(bp.pages.length === 50)
  assert.ok(bp.stats.byFamily.THEME_GAME >= 20)
})

test("fixture LIGHT : blueprint 50 pages complet", () => {
  const bp = build(fixtureProfileLight(), "full-light", "LIGHT")
  assert.equal(bp.pages.length, 50)
  assert.ok(bp.stats.byDataNeed.THEME > 0)
  assert.ok(bp.stats.byDataNeed.NEUTRAL >= 0)
})

test("fixture RICH : peut inclure PHOTO ; DEEP si éligible", () => {
  const bp = build(fixtureProfileRich(), "full-rich", "RICH")
  assert.equal(bp.pages.length, 50)
  assert.ok(bp.stats.byDataNeed.PHOTO > 0)
  assert.ok(bp.stats.pagesWithTouches >= 8)
})

test("gaps reportent des mécaniques, pas « pages personnelles ludiques »", () => {
  const bp = build(fixtureProfileLight(), "gaps-mech", "LIGHT")
  const blob = bp.capabilityGaps.map((g) => `${g.label} ${g.recommendation}`).join(" | ")
  assert.ok(!/pages personnelles ludiques/i.test(blob))
  assert.ok(
    /logique|mot secret|personnalité|mécaniques thématiques|jeux rapides/i.test(blob),
  )
})

test("même seed → déterministe", () => {
  const a = build(fixtureProfileLight(), "det-touch", "LIGHT")
  const b = build(fixtureProfileLight(), "det-touch", "LIGHT")
  assert.deepEqual(
    a.pages.map((p) => [p.archetypeId, p.personalizationTouches?.map((t) => t.type).join(",") ?? ""]),
    b.pages.map((p) => [p.archetypeId, p.personalizationTouches?.map((t) => t.type).join(",") ?? ""]),
  )
})

test("Laure PERSONALIZED : proches → logique proches + touches sur thèmes", () => {
  const bp = build(fixtureProfilePersonalized(), "laure-pers", "PERSONALIZED")
  assert.equal(bp.pages.filter((p) => p.archetypeId === "PERSONAL_REFLECTION").length, 0)
  assert.ok(bp.pages.some((p) => p.archetypeId === "LOGIC_CLOSE_PEOPLE_GAME"))
  assert.ok(bp.pages.some((p) => p.archetypeId === "PERSONALITY_TEST_TRAITS"))
  assert.ok(bp.stats.pagesWithTouches >= 8)
})
