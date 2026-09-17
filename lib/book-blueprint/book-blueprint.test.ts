import assert from "node:assert/strict"
import { test } from "node:test"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import type { Palette, Style } from "@/lib/supabase/types"
import { packCorrections } from "./corrections"
import { buildBookBlueprint } from "./planner"
import { READY_THEME_ARCHETYPE_IDS } from "./archetypes"
import { DEFAULT_TARGET_INTERIOR_PAGES } from "./types"

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
  {
    id: "POP",
    name: "Pop",
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
    id: "PINK",
    name: "Rose",
    primary_color: "#ec4899",
    secondary_color: "#f9a8d4",
    accent_color: "#f59e0b",
    background_color: "#fff7fb",
    text_color: "#111",
    active: true,
    created_at: "",
    updated_at: "",
  },
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

function baseProfile(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return {
    schemaVersion: 1,
    audience: "ME",
    creatorIsParticipant: true,
    participants: [{ id: "p1", firstName: "Alex" }],
    sharedProfile: { interestUniverseIds: ["BEAUTY", "TRAVEL", "FASHION", "NATURE"] },
    individualProfiles: [],
    personalFacts: [
      { id: "f1", category: "FOOD", value: "Pasta" },
      { id: "f2", category: "MUSIC", value: "Jazz" },
      { id: "f3", category: "PLACE", value: "Lisbonne" },
    ],
    memories: [],
    insideJokes: [],
    gamePreferences: { likedTypes: ["QUIZ", "WORDSEARCH", "CROSSWORD"], difficulty: 3 },
    visualPreferences: { paletteId: "PINK", styleId: "RETRO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [],
    ...over,
  }
}

function richOtherEmma(): BookProfileV1 {
  return baseProfile({
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    participants: [{ id: "p1", firstName: "Emma", relationship: "amie" }],
    personalFacts: [
      { id: "f1", category: "FOOD", value: "Sushi" },
      { id: "f2", category: "MUSIC", value: "Pop" },
      { id: "f3", category: "PLACE", value: "Paris" },
      { id: "f4", category: "HABIT", value: "Café du matin" },
      { id: "f5", category: "MOVIE_SERIES", value: "Comédies" },
    ],
    memories: [
      { id: "m1", text: "Week-end à la mer" },
      { id: "m2", text: "Anniversaire surprise" },
      { id: "m3", text: "Road trip d'été" },
      { id: "m4", text: "Soirée karaoke" },
    ],
    photos: [
      { id: "ph1", useAuthorized: true, storagePath: "books/t/1.jpg", caption: "Mer" },
      { id: "ph2", useAuthorized: true, storagePath: "books/t/2.jpg", caption: "Fête" },
      { id: "ph3", useAuthorized: true, storagePath: "books/t/3.jpg", caption: "Route" },
      { id: "ph4", useAuthorized: true, storagePath: "books/t/4.jpg", caption: "Karaoké" },
      { id: "ph5", useAuthorized: true, storagePath: "books/t/5.jpg", caption: "Café" },
    ],
    insideJokes: [{ id: "j1", text: "La blague du train" }],
  })
}

function build(
  profile: BookProfileV1,
  seed: string,
  richness: RichnessLevel = "ENOUGH",
  targetInteriorPages?: number,
) {
  return buildBookBlueprint({
    bookProjectId: "proj-test",
    seed,
    profile,
    richnessLevel: richness,
    styles: STYLES,
    palettes: PALETTES,
    targetInteriorPages,
  })
}

test("blueprint : exactement 50 pages intérieures par défaut", () => {
  const bp = build(baseProfile(), "seed-50")
  assert.equal(bp.targetInteriorPages, DEFAULT_TARGET_INTERIOR_PAGES)
  assert.equal(bp.pages.length, 50)
  assert.equal(bp.stats.interiorPageCount, 50)
  assert.equal(bp.pages[0]?.pageNumber, 1)
  assert.equal(bp.pages[49]?.pageNumber, 50)
})

test("couverture hors pagination intérieure", () => {
  const bp = build(baseProfile(), "seed-cover")
  assert.equal(bp.cover.outsideInteriorPagination, true)
  assert.ok(bp.cover.displayName)
  assert.ok(!bp.pages.some((p) => p.family === "OPENING" && p.pageNumber === 0))
})

test("targetInteriorPages configurable", () => {
  const bp = build(baseProfile(), "seed-40", "ENOUGH", 40)
  assert.equal(bp.pages.length, 40)
  assert.equal(bp.targetInteriorPages, 40)
})

test("ME composition adaptée — peu/pas de QUIZ_PERSONAL", () => {
  const bp = build(baseProfile({ audience: "ME" }), "seed-me", "RICH")
  assert.equal(bp.audience, "ME")
  assert.ok(!bp.pages.some((p) => p.gameId === "QUIZ_PERSONAL"))
  assert.ok(bp.stats.mainGamePages >= 18)
})

test("OTHER_PERSON composition adaptée — thème + photos album", () => {
  const bp = build(richOtherEmma(), "seed-other", "RICH")
  assert.equal(bp.audience, "OTHER_PERSON")
  assert.ok(!bp.pages.some((p) => p.gameId === "QUIZ_PERSONAL"))
  assert.equal(bp.stats.personalEditorialPages, 0)
  assert.ok(bp.stats.photoPages >= 1)
  // RICH OTHER: thème reste majoritaire côté jeux, sans monopoliser le cahier
  assert.ok(bp.stats.mainGamePages >= 14)
  assert.ok(bp.stats.themePercent >= 25)
})

test("DUO composition — plus de personnel ludique", () => {
  const bp = build(
    baseProfile({
      audience: "DUO",
      participants: [
        { id: "p1", firstName: "Emma" },
        { id: "p2", firstName: "Sami" },
      ],
      personalFacts: [
        { id: "f1", category: "FOOD", value: "A" },
        { id: "f2", category: "MUSIC", value: "B" },
        { id: "f3", category: "PLACE", value: "C" },
        { id: "f4", category: "HABIT", value: "D" },
      ],
      memories: [
        { id: "m1", text: "Souvenir duo 1" },
        { id: "m2", text: "Souvenir duo 2" },
      ],
    }),
    "seed-duo",
    "RICH",
  )
  assert.ok(bp.stats.pagesWithTouches + bp.stats.photoPages >= 4)
  assert.ok(bp.pages.some((p) => p.archetypeId === "DUO_INTERACTION" || p.gameId === "QUIZ_PERSONAL"))
})

test("GROUP composition — contenu collectif", () => {
  const bp = build(
    baseProfile({
      audience: "GROUP",
      groupName: "Les Copains",
      participants: [
        { id: "p1", firstName: "A" },
        { id: "p2", firstName: "B" },
        { id: "p3", firstName: "C" },
      ],
      personalFacts: [
        { id: "f1", category: "FOOD", value: "A" },
        { id: "f2", category: "MUSIC", value: "B" },
        { id: "f3", category: "PLACE", value: "C" },
        { id: "f4", category: "HABIT", value: "D" },
      ],
      insideJokes: [{ id: "j1", text: "Private joke" }],
      memories: [{ id: "m1", text: "WE groupe" }],
    }),
    "seed-group",
    "RICH",
  )
  assert.ok(
    bp.pages.some(
      (p) => p.archetypeId === "GROUP_WHO_IN_THE_BAND" || p.archetypeId === "GROUP_QUICK_GAME",
    ),
  )
})

test("profil sans photo fonctionne — aucune page photo obligatoire", () => {
  const bp = build(baseProfile({ photos: [] }), "seed-nophoto")
  assert.equal(bp.stats.photoPages, 0)
  assert.equal(bp.pages.length, 50)
})

test("profil avec photos répartit les pages personnelles photo", () => {
  const bp = build(richOtherEmma(), "seed-photos", "RICH")
  assert.ok(bp.stats.photoPages >= 1)
  const photoNums = bp.pages
    .filter((p) => (p.sourcePhotoIds?.length ?? 0) > 0)
    .map((p) => p.pageNumber)
  assert.ok(photoNums.length >= 1)
  if (photoNums.length >= 2) {
    const span = Math.max(...photoNums) - Math.min(...photoNums)
    assert.ok(span >= 1)
  }
})

test("profil riche augmente intelligemment le personnel", () => {
  const poor = build(baseProfile({ memories: [], photos: [] }), "seed-rich-cmp", "INSUFFICIENT")
  const rich = build(richOtherEmma(), "seed-rich-cmp", "RICH")
  const poorPersonal =
    poor.stats.photoPages + poor.stats.byFamily.PERSONAL_GAME
  const richPersonal =
    rich.stats.photoPages + rich.stats.byFamily.PERSONAL_GAME
  assert.ok(richPersonal > poorPersonal)
})

test("pas deux familles PHOTO brutes consécutives (legacy)", () => {
  const bp = build(richOtherEmma(), "seed-nophoto-adj", "RICH")
  for (let i = 1; i < bp.pages.length; i++) {
    const a = bp.pages[i - 1]!
    const b = bp.pages[i]!
    if (a.family === "PHOTO" && b.family === "PHOTO") {
      assert.fail(`photos consécutives pages ${a.pageNumber}-${b.pageNumber}`)
    }
  }
})

test("pas deux familles MEMORY brutes consécutives (legacy)", () => {
  const bp = build(richOtherEmma(), "seed-nomem-adj", "RICH")
  for (let i = 1; i < bp.pages.length; i++) {
    const a = bp.pages[i - 1]!
    const b = bp.pages[i]!
    if (a.family === "MEMORY" && b.family === "MEMORY") {
      assert.fail(`memories consécutives pages ${a.pageNumber}-${b.pageNumber}`)
    }
  }
})

test("pas 3 HEAVY consécutifs si alternatives", () => {
  const bp = build(richOtherEmma(), "seed-heavy", "RICH")
  let streak = 0
  for (const p of bp.pages) {
    if (p.density === "HEAVY") {
      streak++
      assert.ok(streak < 3, `3 HEAVY consécutifs vers page ${p.pageNumber}`)
    } else streak = 0
  }
})

test("corrections regroupées vers la fin", () => {
  const bp = build(richOtherEmma(), "seed-corr", "RICH")
  const corr = bp.pages.filter((p) => p.family === "CORRECTION")
  assert.ok(corr.length >= 1)
  const firstCorr = corr[0]!.pageNumber
  // Most content games before first correction
  const gamesBefore = bp.pages.filter(
    (p) => p.pageNumber < firstCorr && (p.family === "THEME_GAME" || p.gameId),
  )
  assert.ok(gamesBefore.length >= 5)
  // Closing after corrections
  const closing = bp.pages.find((p) => p.family === "CLOSING")
  assert.ok(closing && closing.pageNumber > corr[corr.length - 1]!.pageNumber)
  // Each correction packs >=1 game refs
  for (const c of corr) {
    assert.ok(c.correctionOf && c.correctionOf.length >= 1)
  }
})

test("corrections compactes — pack plusieurs jeux", () => {
  const packed = packCorrections([
    { gameSlotId: "a", weight: 0.8, label: "q" },
    { gameSlotId: "b", weight: 0.5, label: "w" },
    { gameSlotId: "c", weight: 0.5, label: "c" },
    { gameSlotId: "d", weight: 0.8, label: "q2" },
  ])
  assert.ok(packed.length < 4)
  assert.ok(packed.some((p) => p.corrects.length >= 2))
})

test("même seed = même blueprint", () => {
  const a = build(richOtherEmma(), "stable-bp", "RICH")
  const b = build(richOtherEmma(), "stable-bp", "RICH")
  assert.deepEqual(
    a.pages.map((p) => [p.archetypeId, p.universeId, p.visualRole]),
    b.pages.map((p) => [p.archetypeId, p.universeId, p.visualRole]),
  )
  assert.equal(a.visualIdentity.styleId, b.visualIdentity.styleId)
})

test("univers raisonnablement distribués", () => {
  const bp = build(richOtherEmma(), "seed-univ", "RICH")
  const counts = Object.values(bp.stats.universeCounts)
  assert.ok(counts.length >= 2)
  const max = Math.max(...counts)
  const sum = counts.reduce((a, b) => a + b, 0)
  assert.ok(max / sum <= 0.55, "un univers ne doit pas monopoliser")
})

test("READY/MISSING correctement identifié", () => {
  const bp = build(richOtherEmma(), "seed-status", "RICH")
  assert.ok(bp.stats.byStatus.READY >= 1)
  assert.ok(bp.stats.byStatus.MISSING >= 1)
  assert.ok(bp.pages.some((p) => p.gameId === "QUIZ_THEME" && p.implementationStatus === "READY"))
  assert.ok(
    READY_THEME_ARCHETYPE_IDS.includes("THEME_TRUE_FALSE"),
    "TRUE_FALSE_THEME doit être READY dans le blueprint",
  )
  assert.ok(bp.pages.some((p) => p.implementationStatus === "MISSING"))
  // Do not flood with only ready engines
  assert.ok(bp.stats.readyThemeGamePages <= 15)
  assert.ok(bp.stats.missingMechanicPages >= 1)
})

test("capabilityGaps corrects et prioritaires", () => {
  const bp = build(richOtherEmma(), "seed-gaps", "RICH")
  assert.ok(bp.capabilityGaps.length >= 1)
  assert.ok(bp.capabilityGaps.some((g) => g.gap > 0))
  assert.ok(bp.capabilityGaps.some((g) => g.recommendation.length > 10))
})

test("somme des pages toujours exacte", () => {
  for (const n of [30, 40, 50, 60]) {
    const bp = build(baseProfile(), `seed-sum-${n}`, "ENOUGH", n)
    assert.equal(bp.pages.length, n)
  }
})

test("identité visuelle unique pour tout le cahier", () => {
  const bp = build(baseProfile(), "seed-vis")
  assert.ok(bp.visualIdentity.styleId)
  assert.ok(bp.visualIdentity.paletteId)
})

test("visualRole varié — pas 4 identiques d'affilée", () => {
  const bp = build(richOtherEmma(), "seed-vrole", "RICH")
  let streak = 1
  for (let i = 1; i < bp.pages.length; i++) {
    if (bp.pages[i]!.visualRole === bp.pages[i - 1]!.visualRole) streak++
    else streak = 1
    assert.ok(streak <= 3)
  }
})

test("aucune régénération structurelle liée à l'IA (pur déterminisme local)", () => {
  // buildBookBlueprint is sync and seed-stable — proxy for "no IA"
  const a = build(baseProfile(), "no-ai")
  const b = build(baseProfile(), "no-ai")
  assert.equal(a.pages.length, b.pages.length)
  assert.equal(a.seed, "no-ai")
})
