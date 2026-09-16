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
    }),
  )
  assert.ok(html.includes('data-source-photo-id="ph1"'))
  assert.ok(html.includes('data-layout="photo-collage"'))

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
