import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { BookProfileV1, QuestionnairePhoto } from "@/lib/questionnaire/types"
import type { Palette } from "@/lib/supabase/types"
import { getStyleTokens } from "@/lib/book-renderer/styles"
import { buildBookBlueprint } from "@/lib/book-blueprint"
import { getArchetype } from "@/lib/book-blueprint/archetypes"
import { getPersonalGameSources } from "@/lib/personal-game-sources"
import {
  planPhotoPages,
  splitPhotoCounts,
  buildPhotoCaption,
  classifyPhotoOrientation,
  resolveCollageComposition,
  type PhotoPageItem,
  type PhotoPageV1,
} from "@/lib/photo-pages"
import { PhotoCollageTemplate } from "@/components/book-renderer/templates/photo-collage-template"
import { PhotoTimelineTemplate } from "@/components/book-renderer/templates/photo-timeline-template"

const PALETTE: Palette = {
  id: "PINK",
  name: "Rose",
  primary_color: "#ec4899",
  secondary_color: "#f9a8d4",
  accent_color: "#f59e0b",
  background_color: "#fffaf5",
  text_color: "#111",
  active: true,
  created_at: "",
  updated_at: "",
}

function photo(
  id: string,
  over: Partial<QuestionnairePhoto> = {},
): QuestionnairePhoto {
  return {
    id,
    useAuthorized: true,
    storagePath: `books/t/${id}.jpg`,
    caption: over.caption ?? `Photo ${id}`,
    ...over,
  }
}

function profile(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return {
    schemaVersion: 1,
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    creator: { firstName: "Emma", isParticipant: false, participantId: null },
    participants: [{ id: "sami", firstName: "Sami" }],
    sharedProfile: { interestUniverseIds: ["TRAVEL", "BEAUTY", "FASHION", "NATURE"] },
    individualProfiles: [],
    personalFacts: [
      { id: "f1", category: "FOOD", value: "A" },
      { id: "f2", category: "MUSIC", value: "B" },
      { id: "f3", category: "PLACE", value: "C" },
    ],
    memories: [
      { id: "m1", text: "Premier baiser à Eysines, le 30 mars 2019." },
      { id: "m2", text: "Road trip en Australie." },
    ],
    insideJokes: [{ id: "j1", text: "La blague du train" }],
    gamePreferences: { likedTypes: ["QUIZ"], difficulty: 3 },
    visualPreferences: { paletteId: "PINK", styleId: "RETRO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [],
    ...over,
  }
}

test("splitPhotoCounts: 3→[3], 4→[4], 6→[3,3]", () => {
  assert.deepEqual(splitPhotoCounts(3), [3])
  assert.deepEqual(splitPhotoCounts(4), [4])
  assert.deepEqual(splitPhotoCounts(6), [3, 3])
})

test("3 photos => COLLAGE_3", () => {
  const { pages } = planPhotoPages({
    photos: [photo("a"), photo("b"), photo("c")],
    seed: "c3",
  })
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.kind, "COLLAGE")
  if (pages[0]!.kind === "COLLAGE") assert.equal(pages[0]!.layoutId, "COLLAGE_3")
  assert.equal(pages[0]!.photos.length, 3)
})

test("4 photos => COLLAGE_4", () => {
  const { pages } = planPhotoPages({
    photos: [photo("a"), photo("b"), photo("c"), photo("d")],
    seed: "c4",
  })
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.kind, "COLLAGE")
  if (pages[0]!.kind === "COLLAGE") assert.equal(pages[0]!.layoutId, "COLLAGE_4")
})

test("6 photos => plusieurs pages", () => {
  const photos = ["a", "b", "c", "d", "e", "f"].map((id) => photo(id))
  const { pages } = planPhotoPages({ photos, seed: "multi" })
  assert.equal(pages.length, 2)
  assert.equal(pages.reduce((n, p) => n + p.photos.length, 0), 6)
})

test("photo sans date => collage possible", () => {
  const { pages } = planPhotoPages({
    photos: [photo("a", { caption: "Porto" }), photo("b", { caption: "Lisbonne" })],
    seed: "nodate",
  })
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.kind, "COLLAGE")
})

test("timeline uniquement avec dates fiables sur toute la page", () => {
  const dated = planPhotoPages({
    photos: [
      photo("a", { caption: "Eysines 2019", takenAt: "2019-03-30" }),
      photo("b", { caption: "Porto 2024", takenAt: "2024-06-01" }),
      photo("c", { caption: "Australie 2025", takenAt: "2025-01-10" }),
    ],
    seed: "tl",
  })
  assert.equal(dated.pages.length, 1)
  assert.equal(dated.pages[0]!.kind, "TIMELINE")

  const mixed = planPhotoPages({
    photos: [
      photo("a", { caption: "Eysines 2019", takenAt: "2019-03-30" }),
      photo("b", { caption: "Sans date" }),
      photo("c", { caption: "Aussi sans date" }),
    ],
    seed: "tl-mixed",
  })
  assert.equal(mixed.pages[0]!.kind, "COLLAGE")
})

test("provenance sourcePhotoId + captions liées", () => {
  const { pages } = planPhotoPages({
    photos: [
      photo("porto", { caption: "Porto après la dispute.", anecdote: "Réconciliation." }),
      photo("sydney", { caption: "Sydney Tower." }),
    ],
    seed: "prov",
  })
  const ids = pages.flatMap((p) => p.photos.map((x) => x.sourcePhotoId))
  assert.deepEqual(ids.sort(), ["porto", "sydney"])
  const porto = pages[0]!.photos.find((p) => p.sourcePhotoId === "porto")
  assert.ok(porto)
  assert.ok(porto!.caption || porto!.anecdote || porto!.kicker)
})

test("aucun memory indépendant injecté", () => {
  const { pages } = planPhotoPages({
    photos: [photo("a"), photo("b")],
    seed: "nomem",
  })
  for (const p of pages) {
    assert.ok(p.photos.every((ph) => ph.sourcePhotoId))
    assert.equal(
      "sourceMemoryId" in (p.photos[0] as object),
      false,
    )
  }
})

test("même seed => même composition", () => {
  const photos = [photo("a"), photo("b"), photo("c"), photo("d")]
  const a = planPhotoPages({ photos, seed: "stable" })
  const b = planPhotoPages({ photos, seed: "stable" })
  assert.deepEqual(
    a.pages.map((p) => ({
      kind: p.kind,
      ids: p.photos.map((x) => x.sourcePhotoId),
    })),
    b.pages.map((p) => ({
      kind: p.kind,
      ids: p.photos.map((x) => x.sourcePhotoId),
    })),
  )
})

test("memories n'ajoutent plus de pages Blueprint ; restent game sources", () => {
  const p = profile({
    photos: [photo("ph1"), photo("ph2"), photo("ph3")],
    memories: [
      { id: "m1", text: "Souvenir A assez long pour un jeu." },
      { id: "m2", text: "Souvenir B pour crossword." },
      { id: "m3", text: "Souvenir C." },
    ],
  })
  const sources = getPersonalGameSources(p)
  assert.equal(sources.memories.length, 3)
  assert.ok(sources.memories.every((m) => m.sourceMemoryId && m.facts))

  const bp = buildBookBlueprint({
    bookProjectId: "proj",
    seed: "v1-photos",
    profile: p,
    richnessLevel: "RICH",
    styles: [
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
    ],
    palettes: [PALETTE],
  })

  assert.equal(bp.stats.personalEditorialPages, 0)
  assert.equal(bp.pages.filter((x) => x.archetypeId === "PERSONAL_EDITORIAL_PAGE").length, 0)
  assert.equal(bp.pages.filter((x) => x.archetypeId === "MEMORY_TEXT_PAGE").length, 0)
  assert.ok(bp.stats.photoPages >= 1)
  assert.ok(
    bp.pages.some(
      (x) =>
        x.archetypeId === "PHOTO_COLLAGE_PAGE" ||
        x.archetypeId === "PHOTO_TIMELINE_PAGE",
    ),
  )
  assert.ok(
    bp.pages
      .filter((x) => x.archetypeId === "PHOTO_COLLAGE_PAGE")
      .every((x) => (x.sourcePhotoIds?.length ?? 0) >= 2),
  )
})

test("archetypes photo READY ; PERSONAL_EDITORIAL expérimental", () => {
  assert.equal(getArchetype("PHOTO_COLLAGE_PAGE").implementationStatus, "READY")
  assert.equal(getArchetype("PHOTO_TIMELINE_PAGE").implementationStatus, "READY")
  assert.equal(getArchetype("PERSONAL_EDITORIAL_PAGE").implementationStatus, "PARTIAL")
})

test("templates Polaroid / timeline rendent sourcePhotoId", () => {
  const collagePage: PhotoPageV1 = {
    pageKey: "p1",
    kind: "COLLAGE",
    layoutId: "COLLAGE_2",
    photos: [
      {
        sourcePhotoId: "ph1",
        imageUrl: "https://example.com/1.jpg",
        kicker: "PORTO",
        caption: "Réconciliation.",
        anecdote: null,
        place: "Porto",
        dateLabel: null,
        sortKey: null,
        participantIds: [],
      },
      {
        sourcePhotoId: "ph2",
        imageUrl: "https://example.com/2.jpg",
        kicker: "SYDNEY",
        caption: "Dernier jour.",
        anecdote: null,
        place: "Sydney",
        dateLabel: null,
        sortKey: null,
        participantIds: [],
      },
    ],
  }
  const html = renderToStaticMarkup(
    createElement(PhotoCollageTemplate, {
      layoutId: "COLLAGE_2",
      photos: collagePage.photos,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
      seed: "tpl",
    }),
  )
  assert.ok(html.includes('data-source-photo-id="ph1"'))
  assert.ok(html.includes('data-layout="photo-collage"'))
  assert.ok(html.includes("data-variant="))

  const tl = renderToStaticMarkup(
    createElement(PhotoTimelineTemplate, {
      photos: [
        {
          ...collagePage.photos[0]!,
          dateLabel: "2019",
          sortKey: 2019,
        },
        {
          ...collagePage.photos[1]!,
          dateLabel: "2024",
          sortKey: 2024,
        },
      ],
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(tl.includes("2019"))
  assert.ok(tl.includes('data-layout="photo-timeline"'))
})

// --- Design / composition (planner unchanged) ---

function item(id: string, over: Partial<PhotoPageItem> = {}): PhotoPageItem {
  return {
    sourcePhotoId: id,
    imageUrl: `https://example.com/${id}.jpg`,
    kicker: null,
    caption: null,
    anecdote: null,
    place: null,
    dateLabel: null,
    sortKey: null,
    participantIds: [],
    ...over,
  }
}

test("landscape favorisée en zone large (HERO_TOP)", () => {
  const photos = [
    item("land", { kicker: "A", caption: "Vue large." }),
    item("l2", { kicker: "B", caption: "Autre large." }),
    item("sq", { kicker: "C", caption: "Carré." }),
  ]
  const comp = resolveCollageComposition({
    layoutId: "COLLAGE_3",
    photos,
    seed: "orient-land-majority",
    aspectRatios: { land: 1.7, l2: 1.5, sq: 1.0 },
  })
  assert.ok(comp.variant === "HERO_TOP" || comp.variant === "HERO_LEFT")
  if (comp.variant === "HERO_TOP") {
    assert.ok(
      comp.heroPhotoId === "land" || comp.heroPhotoId === "l2",
      "wide hero should be landscape",
    )
  }
  assert.equal(classifyPhotoOrientation(1.6), "LANDSCAPE")
  assert.equal(classifyPhotoOrientation(0.7), "PORTRAIT")
})

test("portrait favorisée en zone verticale (HERO_LEFT/RIGHT)", () => {
  const photos = [
    item("port", { kicker: "P", caption: "Debout." }),
    item("port2", { kicker: "Q", caption: "Debout deux." }),
    item("l1", { kicker: "L", caption: "Large." }),
  ]
  const comp = resolveCollageComposition({
    layoutId: "COLLAGE_3",
    photos,
    seed: "orient-port-majority",
    aspectRatios: { port: 0.68, port2: 0.72, l1: 1.5 },
  })
  assert.ok(comp.variant === "HERO_LEFT" || comp.variant === "HERO_RIGHT")
  assert.ok(
    comp.heroPhotoId === "port" || comp.heroPhotoId === "port2",
    `expected portrait hero, got ${comp.heroPhotoId}`,
  )
})

test("même seed => même variante collage", () => {
  const photos = [
    item("a", { caption: "Un." }),
    item("b", { caption: "Deux." }),
    item("c", { caption: "Trois." }),
  ]
  const ratios = { a: 1.5, b: 0.8, c: 1.1 }
  const x = resolveCollageComposition({
    layoutId: "COLLAGE_3",
    photos,
    seed: "stable-var",
    aspectRatios: ratios,
  })
  const y = resolveCollageComposition({
    layoutId: "COLLAGE_3",
    photos,
    seed: "stable-var",
    aspectRatios: ratios,
  })
  assert.equal(x.variant, y.variant)
  assert.equal(x.heroPhotoId, y.heroPhotoId)
  assert.deepEqual(
    x.photos.map((p) => p.sourcePhotoId),
    y.photos.map((p) => p.sourcePhotoId),
  )
})

test("captions non répétitives et courtes", () => {
  const c = buildPhotoCaption({
    caption: "Lui et moi à Porto.",
    anecdote: "Photo prise après une dispute — début de réconciliation.",
    place: "Porto",
    creatorName: "Emma",
  })
  assert.equal(c.kicker, "PORTO")
  assert.ok(c.caption)
  assert.ok(!/lui et moi à porto/i.test(c.caption!))
  assert.ok(c.caption!.split(/\s+/).length <= 18)
})

test("caption d'une photo jamais croisée", () => {
  const { pages } = planPhotoPages({
    photos: [
      photo("porto", {
        caption: "À Porto.",
        anecdote: "Réconciliation.",
        place: "Porto",
      }),
      photo("sydney", {
        caption: "Sydney Tower.",
        anecdote: "Coca sans bulles.",
        place: "Sydney",
      }),
    ],
    seed: "cross",
  })
  const porto = pages[0]!.photos.find((p) => p.sourcePhotoId === "porto")!
  const sydney = pages[0]!.photos.find((p) => p.sourcePhotoId === "sydney")!
  assert.ok(porto)
  assert.ok(sydney)
  assert.notEqual(porto.caption, sydney.caption)
  assert.ok(!/sydney/i.test(`${porto.kicker} ${porto.caption}`))
  assert.ok(!/porto/i.test(`${sydney.kicker} ${sydney.caption}`))
})

test("COLLAGE_2 / 3 / 4 compositions valides", () => {
  const c2 = resolveCollageComposition({
    layoutId: "COLLAGE_2",
    photos: [item("a"), item("b")],
    seed: "v2",
    aspectRatios: { a: 0.7, b: 0.7 },
  })
  assert.equal(c2.variant, "STACKED")

  const c2b = resolveCollageComposition({
    layoutId: "COLLAGE_2",
    photos: [item("a"), item("b")],
    seed: "v2b",
    aspectRatios: { a: 1.5, b: 1.4 },
  })
  assert.equal(c2b.variant, "SIDE_BY_SIDE")

  const c3 = resolveCollageComposition({
    layoutId: "COLLAGE_3",
    photos: [item("a"), item("b"), item("c")],
    seed: "v3",
  })
  assert.ok(["HERO_LEFT", "HERO_TOP", "HERO_RIGHT"].includes(c3.variant))
  assert.ok(c3.heroPhotoId)

  const c4 = resolveCollageComposition({
    layoutId: "COLLAGE_4",
    photos: [item("a"), item("b"), item("c"), item("d")],
    seed: "v4",
    aspectRatios: { a: 1.6, b: 1, c: 1, d: 1 },
  })
  assert.ok(["GRID_2X2", "HERO_PLUS_THREE"].includes(c4.variant))
})

test("pas de timeline sans dates fiables (planner)", () => {
  const { pages } = planPhotoPages({
    photos: [
      photo("a", { caption: "Sans date A" }),
      photo("b", { caption: "Sans date B" }),
      photo("c", { caption: "Sans date C" }),
    ],
    seed: "no-tl",
  })
  assert.equal(pages[0]!.kind, "COLLAGE")
})
