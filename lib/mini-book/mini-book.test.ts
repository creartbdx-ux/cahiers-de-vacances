import assert from "node:assert/strict"
import { test } from "node:test"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { Palette, Style } from "@/lib/supabase/types"
import {
  assembleMiniBookPreview,
  miniBookCorrectionSharesGameContent,
} from "./assemble"
import { resolveCoverDisplayName, resolveCoverSubtitle } from "./cover-name"
import { MINI_BOOK_PAGE_COUNT } from "./types"
import { hashSeed, resolveBookVisualIdentity } from "./visual-identity"

function profile(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return {
    schemaVersion: 1,
    audience: "ME",
    creatorIsParticipant: true,
    participants: [{ id: "p1", firstName: "Emma" }],
    sharedProfile: { interestUniverseIds: ["BEAUTY", "TRAVEL", "FASHION"] },
    individualProfiles: [],
    personalFacts: [],
    memories: [],
    insideJokes: [],
    gamePreferences: { likedTypes: ["QUIZ", "WORDSEARCH", "CROSSWORD"], difficulty: 3 },
    visualPreferences: { paletteId: "AUTO", styleId: "AUTO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [],
    ...over,
  }
}

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
    background_color: "#fff",
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
    background_color: "#fff",
    text_color: "#111",
    active: true,
    created_at: "",
    updated_at: "",
  },
]

function assembleFixture(seed = "mini-seed") {
  const visualIdentity = resolveBookVisualIdentity({
    profile: profile(),
    seed,
    styles: STYLES,
    palettes: PALETTES,
  })
  return assembleMiniBookPreview({
    bookProjectId: "proj-1",
    seed,
    profile: profile(),
    visualIdentity,
    quiz: {
      slotId: "slot_quiz",
      universeId: "BEAUTY",
      universeName: "Beauté",
      title: "Quiz beauté",
    },
    wordsearch: {
      slotId: "slot_ws",
      universeId: "TRAVEL",
      universeName: "Voyage",
      title: "Mots voyage",
    },
    crossword: {
      slotId: "slot_cw",
      universeId: "FASHION",
      universeName: "Mode",
      title: "Croisés mode",
    },
  })
}

test("mini-cahier : exactement 8 pages dans le bon ordre", () => {
  const book = assembleFixture()
  assert.equal(book.pages.length, MINI_BOOK_PAGE_COUNT)
  assert.equal(book.version, 1)
  const kinds = book.pages.map((p) => p.kind)
  assert.deepEqual(kinds, [
    "COVER",
    "QUIZ",
    "WORDSEARCH",
    "CROSSWORD",
    "CORRECTIONS_DIVIDER",
    "QUIZ",
    "WORDSEARCH",
    "CROSSWORD",
  ])
  const modes = book.pages
    .filter((p) => p.kind === "QUIZ" || p.kind === "WORDSEARCH" || p.kind === "CROSSWORD")
    .map((p) => ("mode" in p ? p.mode : null))
  assert.deepEqual(modes, ["GAME", "GAME", "GAME", "CORRECTION", "CORRECTION", "CORRECTION"])
})

test("une seule identité visuelle globale", () => {
  const book = assembleFixture("id-seed")
  assert.ok(book.visualIdentity.styleId)
  assert.ok(book.visualIdentity.paletteId)
  assert.equal(book.pages.length, 8)
})

test("AUTO résolu une seule fois — même seed = même identité", () => {
  const a = resolveBookVisualIdentity({
    profile: profile({ visualPreferences: { styleId: "AUTO", paletteId: "AUTO" } }),
    seed: "stable-auto",
    styles: STYLES,
    palettes: PALETTES,
  })
  const b = resolveBookVisualIdentity({
    profile: profile({ visualPreferences: { styleId: "AUTO", paletteId: "AUTO" } }),
    seed: "stable-auto",
    styles: STYLES,
    palettes: PALETTES,
  })
  assert.equal(a.styleFromAuto, true)
  assert.equal(a.paletteFromAuto, true)
  assert.deepEqual(a, b)

  const c = resolveBookVisualIdentity({
    profile: profile({ visualPreferences: { styleId: "AUTO", paletteId: "AUTO" } }),
    seed: "other-seed",
    styles: STYLES,
    palettes: PALETTES,
  })
  // Different seed may differ — hash must at least be stable for same seed
  assert.equal(hashSeed("stable-auto"), hashSeed("stable-auto"))
  assert.notEqual(hashSeed("stable-auto"), hashSeed("other-seed"))
  void c
})

test("préférence explicite non-AUTO respectée", () => {
  const id = resolveBookVisualIdentity({
    profile: profile({ visualPreferences: { styleId: "RETRO", paletteId: "PINK" } }),
    seed: "any",
    styles: STYLES,
    palettes: PALETTES,
  })
  assert.equal(id.styleId, "RETRO")
  assert.equal(id.paletteId, "PINK")
  assert.equal(id.styleFromAuto, false)
  assert.equal(id.paletteFromAuto, false)
})

test("univers différents possibles par jeu", () => {
  const book = assembleFixture()
  const quiz = book.pages.find((p) => p.kind === "QUIZ" && "mode" in p && p.mode === "GAME")
  const ws = book.pages.find((p) => p.kind === "WORDSEARCH" && "mode" in p && p.mode === "GAME")
  const cw = book.pages.find((p) => p.kind === "CROSSWORD" && "mode" in p && p.mode === "GAME")
  assert.ok(quiz && "universeId" in quiz)
  assert.ok(ws && "universeId" in ws)
  assert.ok(cw && "universeId" in cw)
  assert.equal(quiz.universeId, "BEAUTY")
  assert.equal(ws.universeId, "TRAVEL")
  assert.equal(cw.universeId, "FASHION")
})

test("correction réutilise exactement le contenu Jeu (mêmes slots/titres)", () => {
  const book = assembleFixture()
  assert.equal(miniBookCorrectionSharesGameContent(book), true)
})

test("couverture adaptée ME", () => {
  assert.equal(resolveCoverDisplayName(profile({ audience: "ME" })), "Emma")
  assert.equal(resolveCoverSubtitle(profile({ audience: "ME" })), "Édition personnalisée")
})

test("couverture adaptée OTHER_PERSON", () => {
  const p = profile({
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    participants: [{ id: "p2", firstName: "Léa" }],
  })
  assert.equal(resolveCoverDisplayName(p), "Léa")
})

test("couverture adaptée DUO", () => {
  const p = profile({
    audience: "DUO",
    participants: [
      { id: "p1", firstName: "Emma" },
      { id: "p2", firstName: "Sami" },
    ],
  })
  assert.equal(resolveCoverDisplayName(p), "Emma & Sami")
  assert.equal(resolveCoverSubtitle(p), "Édition duo")
})

test("couverture adaptée GROUP", () => {
  const withName = profile({
    audience: "GROUP",
    groupName: "Les Copains",
    participants: [
      { id: "p1", firstName: "A" },
      { id: "p2", firstName: "B" },
    ],
  })
  assert.equal(resolveCoverDisplayName(withName), "Les Copains")
  const without = profile({
    audience: "GROUP",
    groupName: "",
    participants: [
      { id: "p1", firstName: "A" },
      { id: "p2", firstName: "B" },
      { id: "p3", firstName: "C" },
    ],
  })
  assert.equal(resolveCoverDisplayName(without), "A, B, C")
})

test("navigation pages ne change pas l'identité ni les slots (structure figée)", () => {
  const book = assembleFixture()
  const page1 = book.pages[0]
  const page8 = book.pages[7]
  assert.equal(page1?.kind, "COVER")
  assert.equal(page8?.kind, "CROSSWORD")
  assert.equal(book.visualIdentity.styleId, assembleFixture().visualIdentity.styleId)
})
