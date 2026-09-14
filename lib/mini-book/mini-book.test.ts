import assert from "node:assert/strict"
import { test } from "node:test"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { Palette, Style } from "@/lib/supabase/types"
import { resolveCrosswordPageLayout } from "@/lib/book-renderer/crossword-layout"
import {
  assembleMiniBookPreview,
  miniBookCorrectionSharesGameContent,
} from "./assemble"
import { resolveCoverDisplayName, resolveCoverSubtitle } from "./cover-name"
import { resolveMiniBookPageColors } from "./page-colors"
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

test("mini-cahier V2 : exactement 6 pages dans le bon ordre", () => {
  const book = assembleFixture()
  assert.equal(book.pages.length, MINI_BOOK_PAGE_COUNT)
  assert.equal(book.version, 1)
  const kinds = book.pages.map((p) => p.kind)
  assert.deepEqual(kinds, [
    "COVER",
    "QUIZ",
    "WORDSEARCH",
    "CROSSWORD",
    "QUIZ_CORRECTION",
    "LETTERS_CORRECTION",
  ])
  assert.ok(!kinds.includes("CORRECTIONS_DIVIDER" as never))
})

test("pas de pages de correction en template jeu complet", () => {
  const book = assembleFixture()
  const gameModes = book.pages.filter(
    (p) => p.kind === "QUIZ" || p.kind === "WORDSEARCH" || p.kind === "CROSSWORD",
  )
  assert.equal(gameModes.length, 3)
  for (const p of gameModes) {
    assert.equal("mode" in p && p.mode, "GAME")
  }
  assert.ok(book.pages.some((p) => p.kind === "QUIZ_CORRECTION"))
  assert.ok(book.pages.some((p) => p.kind === "LETTERS_CORRECTION"))
})

test("une seule identité visuelle globale (style + palette)", () => {
  const book = assembleFixture("id-seed")
  assert.ok(book.visualIdentity.styleId)
  assert.ok(book.visualIdentity.paletteId)
  assert.equal(book.pages.length, 6)
  const ids = new Set([book.visualIdentity.styleId, book.visualIdentity.paletteId])
  assert.equal(ids.size, 2)
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
  assert.equal(hashSeed("stable-auto"), hashSeed("stable-auto"))
  assert.notEqual(hashSeed("stable-auto"), hashSeed("other-seed"))
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
  const quiz = book.pages.find((p) => p.kind === "QUIZ")
  const ws = book.pages.find((p) => p.kind === "WORDSEARCH")
  const cw = book.pages.find((p) => p.kind === "CROSSWORD")
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

test("palette distribuée entre les pages — déterministe, distincte, unique palette", () => {
  const palette = PALETTES[0]!
  const cover = resolveMiniBookPageColors(palette, "COVER")
  const quiz = resolveMiniBookPageColors(palette, "QUIZ")
  const ws = resolveMiniBookPageColors(palette, "WORDSEARCH")
  const cw = resolveMiniBookPageColors(palette, "CROSSWORD")
  const qCorr = resolveMiniBookPageColors(palette, "QUIZ_CORRECTION")
  const letters = resolveMiniBookPageColors(palette, "LETTERS_CORRECTION")

  assert.equal(cover.background, resolveMiniBookPageColors(palette, "COVER").background)
  assert.notEqual(cover.background, quiz.background)
  assert.notEqual(quiz.background, ws.background)
  assert.notEqual(ws.background, cw.background)
  assert.notEqual(qCorr.background, letters.background)
  assert.equal(cw.background, palette.background_color)
})

test("crossword privilégie la lisibilité de la grille (layout adaptatif)", () => {
  assert.equal(
    resolveCrosswordPageLayout({ acrossCount: 3, downCount: 3, width: 8, height: 8 }),
    "side-by-side",
  )
  assert.equal(
    resolveCrosswordPageLayout({ acrossCount: 8, downCount: 7, width: 12, height: 12 }),
    "grid-top",
  )
  assert.equal(
    resolveCrosswordPageLayout({ acrossCount: 5, downCount: 4, width: 9, height: 9 }),
    "side-by-side",
  )
})

test("structure compacte : page 5 quiz, page 6 lettres combinées", () => {
  const book = assembleFixture()
  assert.equal(book.pages[4]?.kind, "QUIZ_CORRECTION")
  assert.equal(book.pages[5]?.kind, "LETTERS_CORRECTION")
  const letters = book.pages[5]
  assert.ok(letters && letters.kind === "LETTERS_CORRECTION")
  assert.equal(letters.wordsearch.slotId, "slot_ws")
  assert.equal(letters.crossword.slotId, "slot_cw")
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

test("navigation pages ne change pas l'identité ni les slots", () => {
  const book = assembleFixture()
  assert.equal(book.pages[0]?.kind, "COVER")
  assert.equal(book.pages[5]?.kind, "LETTERS_CORRECTION")
  assert.equal(book.visualIdentity.styleId, assembleFixture().visualIdentity.styleId)
})

test("jeu absent : structure reste exploitable (corrections pointent toujours vers les slots)", () => {
  const book = assembleFixture()
  const quizCorr = book.pages.find((p) => p.kind === "QUIZ_CORRECTION")
  const letters = book.pages.find((p) => p.kind === "LETTERS_CORRECTION")
  assert.ok(quizCorr && quizCorr.kind === "QUIZ_CORRECTION")
  assert.ok(letters && letters.kind === "LETTERS_CORRECTION")
  // Structure does not require live content blobs — pages remain addressable.
  assert.equal(quizCorr.slotId, "slot_quiz")
  assert.equal(letters.wordsearch.slotId, "slot_ws")
  assert.equal(letters.crossword.slotId, "slot_cw")
  assert.equal(book.pages.filter((p) => p.kind === "WORDSEARCH").length, 1)
  assert.equal(book.pages.filter((p) => p.kind === "CROSSWORD").length, 1)
})
