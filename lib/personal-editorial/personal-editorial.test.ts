import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { Palette } from "@/lib/supabase/types"
import { getStyleTokens } from "@/lib/book-renderer/styles"
import { buildBookBlueprint } from "@/lib/book-blueprint"
import { getArchetype } from "@/lib/book-blueprint/archetypes"
import { PersonalEditorialTemplate } from "@/components/book-renderer/templates/personal-editorial-template"
import {
  blockWeight,
  collectPersonalBlocks,
  composePersonalEditorialPages,
  memoryToBlock,
  pageProvenance,
  photoToBlock,
  prefersDedicatedPage,
  PERSONAL_PAGE_MAX_BLOCKS,
  PERSONAL_PAGE_MAX_PHOTOS,
  type MemoryBlockV1,
  type PhotoMemoryBlockV1,
} from "./index"

function profile(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return {
    schemaVersion: 1,
    audience: "ME",
    creatorIsParticipant: true,
    participants: [{ id: "p1", firstName: "Emma" }],
    sharedProfile: { interestUniverseIds: ["TRAVEL"] },
    individualProfiles: [],
    personalFacts: [
      { id: "f1", category: "FOOD", value: "A" },
      { id: "f2", category: "MUSIC", value: "B" },
      { id: "f3", category: "PLACE", value: "C" },
    ],
    memories: [],
    insideJokes: [],
    gamePreferences: { likedTypes: ["QUIZ"], difficulty: 3 },
    visualPreferences: { paletteId: "PINK", styleId: "RETRO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [],
    ...over,
  }
}

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

const STYLES = [
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

function shortMemory(id: string, text: string): MemoryBlockV1 {
  return {
    type: "MEMORY",
    sourceMemoryId: id,
    title: "Un souvenir à garder",
    body: text,
    density: "SHORT",
    participantIds: ["p1"],
    fullPageRecommended: false,
  }
}

function shortPhoto(id: string): PhotoMemoryBlockV1 {
  return {
    type: "PHOTO_MEMORY",
    sourcePhotoId: id,
    signedUrl: `https://signed.example/${id}.jpg`,
    caption: "Petite légende",
    anecdote: null,
    title: "Petite légende",
    body: "Petite légende",
    density: "SHORT",
    photoLayout: "LANDSCAPE",
    participantIds: ["p1"],
    fullPageRecommended: true,
    weakSource: false,
  }
}

test("3 memories SHORT => peuvent produire 1 page composite", () => {
  const blocks = [
    shortMemory("m1", "Petite anecdote A."),
    shortMemory("m2", "Petite anecdote B."),
    shortMemory("m3", "Petite anecdote C."),
  ]
  const pages = composePersonalEditorialPages(blocks, "three-short")
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.blocks.length, 3)
  assert.equal(pages[0]!.layoutId, "THREE_SNIPPETS")
})

test("1 photo SHORT + 1 memory SHORT => 1 page", () => {
  const pages = composePersonalEditorialPages(
    [shortPhoto("ph1"), shortMemory("m1", "Anecdote courte.")],
    "photo-mem",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "PHOTO_PLUS_MEMORY")
  assert.equal(pages[0]!.blocks.length, 2)
})

test("2 photos compatibles en densité => 1 page", () => {
  const pages = composePersonalEditorialPages(
    [shortPhoto("ph1"), shortPhoto("ph2")],
    "two-photos",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "TWO_PHOTOS")
})

test("memory RICH => peut devenir HERO", () => {
  const rich: MemoryBlockV1 = {
    type: "MEMORY",
    sourceMemoryId: "rich",
    title: "Long séjour",
    body: "Texte riche ".repeat(40),
    density: "RICH",
    participantIds: ["p1"],
    fullPageRecommended: true,
  }
  assert.equal(prefersDedicatedPage(rich), true)
  const pages = composePersonalEditorialPages([rich], "hero-mem")
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "HERO_MEMORY")
  assert.equal(pages[0]!.isHero, true)
})

test("photo RICH => peut devenir HERO", () => {
  const rich: PhotoMemoryBlockV1 = {
    ...shortPhoto("phR"),
    density: "RICH",
    caption: "Longue légende ".repeat(20),
    anecdote: "Anecdote détaillée ".repeat(15),
    body: "Longue légende et anecdote",
    fullPageRecommended: true,
  }
  assert.equal(prefersDedicatedPage(rich), true)
  const pages = composePersonalEditorialPages([rich], "hero-photo")
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "HERO_PHOTO_MEMORY")
})

test("fullPageRecommended=false => pas automatiquement page entière", () => {
  const a = shortMemory("a", "Un.")
  const b = shortMemory("b", "Deux.")
  assert.equal(a.fullPageRecommended, false)
  const pages = composePersonalEditorialPages([a, b], "no-auto-full")
  assert.equal(pages.length, 1)
  assert.ok(pages[0]!.blocks.length >= 2)
  assert.equal(pages[0]!.isHero, false)
})

test("aucune provenance perdue ; aucun faux lien photo/memory", () => {
  const pages = composePersonalEditorialPages(
    [shortPhoto("phX"), shortMemory("mY", "Texte Y")],
    "prov",
  )
  assert.equal(pages.length, 1)
  const prov = pageProvenance(pages[0]!)
  assert.deepEqual(prov.sourcePhotoIds, ["phX"])
  assert.deepEqual(prov.sourceMemoryIds, ["mY"])
  // Blocks remain separate — no merged narrative id
  assert.equal(pages[0]!.blocks[0]!.type === "PHOTO_MEMORY" || pages[0]!.blocks[1]!.type === "PHOTO_MEMORY", true)
  assert.equal(pages[0]!.blocks.some((b) => b.type === "MEMORY"), true)
})

test("max 3 blocks/page et max 2 photos/page", () => {
  const blocks = [
    shortMemory("m1", "A"),
    shortMemory("m2", "B"),
    shortMemory("m3", "C"),
    shortMemory("m4", "D"),
    shortPhoto("p1"),
    shortPhoto("p2"),
    shortPhoto("p3"),
  ]
  const pages = composePersonalEditorialPages(blocks, "caps")
  for (const page of pages) {
    assert.ok(page.blocks.length <= PERSONAL_PAGE_MAX_BLOCKS)
    assert.ok(
      page.blocks.filter((b) => b.type === "PHOTO_MEMORY").length <= PERSONAL_PAGE_MAX_PHOTOS,
    )
  }
})

test("même seed => même composition", () => {
  const blocks = [
    shortMemory("m1", "A"),
    shortMemory("m2", "B"),
    shortPhoto("p1"),
    shortMemory("m3", "C"),
  ]
  const a = composePersonalEditorialPages(blocks, "seed-stable")
  const b = composePersonalEditorialPages(blocks, "seed-stable")
  assert.deepEqual(
    a.map((p) => ({ layout: p.layoutId, ids: pageProvenance(p) })),
    b.map((p) => ({ layout: p.layoutId, ids: pageProvenance(p) })),
  )
})

test("collectPersonalBlocks conserve densités et provenances", () => {
  const p = profile({
    memories: [
      { id: "m1", text: "Court." },
      {
        id: "m2",
        title: "Riche",
        place: "Kyoto",
        text: [
          "Premier jour au temple puis une longue marche.",
          "Le soir un dîner simple et beaucoup de rires.",
          "Le lendemain la pluie a prolongé le café.",
        ].join(" "),
      },
    ],
    photos: [
      {
        id: "ph1",
        useAuthorized: true,
        storagePath: "books/x/1.jpg",
        caption: "Tour",
        anecdote: "Dernier jour",
      },
    ],
  })
  const blocks = collectPersonalBlocks({
    profile: p,
    photoSignedUrls: { ph1: "https://signed.example/1.jpg" },
  })
  assert.ok(blocks.some((b) => b.type === "MEMORY" && b.sourceMemoryId === "m1"))
  assert.ok(blocks.some((b) => b.type === "PHOTO_MEMORY" && b.sourcePhotoId === "ph1"))
  const photo = blocks.find((b) => b.type === "PHOTO_MEMORY") as PhotoMemoryBlockV1
  assert.equal(photo.caption, "Tour")
  assert.equal(photo.anecdote, "Dernier jour")
})

test("Blueprint compte pages composites ; PERSONAL_EDITORIAL READY", () => {
  assert.equal(getArchetype("PERSONAL_EDITORIAL_PAGE").implementationStatus, "READY")
  const p = profile({
    memories: [
      { id: "m1", text: "Petite anecdote A." },
      { id: "m2", text: "Petite anecdote B." },
      { id: "m3", text: "Petite anecdote C." },
      { id: "m4", text: "Petite anecdote D." },
    ],
    photos: [
      {
        id: "ph1",
        useAuthorized: true,
        storagePath: "books/x/1.jpg",
        caption: "Légende A",
      },
      {
        id: "ph2",
        useAuthorized: true,
        storagePath: "books/x/2.jpg",
        caption: "Légende B",
      },
    ],
    sharedProfile: { interestUniverseIds: ["BEAUTY", "TRAVEL", "FASHION", "NATURE"] },
  })
  const bp = buildBookBlueprint({
    bookProjectId: "proj",
    seed: "pep-bp",
    profile: p,
    richnessLevel: "RICH",
    styles: STYLES,
    palettes: [PALETTE],
  })

  const editorial = bp.pages.filter((x) => x.archetypeId === "PERSONAL_EDITORIAL_PAGE")
  assert.ok(editorial.length >= 1)
  assert.ok(editorial.every((x) => x.implementationStatus === "READY"))
  assert.equal(bp.stats.personalEditorialPages, editorial.length)

  // Fewer pages than raw block count (4 memories + 2 photos = 6 blocks)
  const blocks = collectPersonalBlocks({ profile: p })
  assert.ok(editorial.length < blocks.length)

  const gap = bp.capabilityGaps.find((g) => g.family === "PERSONAL_EDITORIAL")
  assert.equal(gap, undefined)

  // Old 1:1 archetypes no longer planned as pages
  assert.equal(bp.pages.filter((x) => x.archetypeId === "MEMORY_TEXT_PAGE").length, 0)
  assert.equal(bp.pages.filter((x) => x.archetypeId === "PHOTO_MEMORY_PAGE").length, 0)
})

test("PersonalEditorialTemplate rend layout composite", () => {
  const pages = composePersonalEditorialPages(
    [shortPhoto("ph1"), shortMemory("m1", "Texte")],
    "tpl",
  )
  const html = renderToStaticMarkup(
    createElement(PersonalEditorialTemplate, {
      page: pages[0]!,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(html.includes('data-personal-layout="PHOTO_PLUS_MEMORY"'))
  assert.ok(html.includes("object-fit:cover") || html.includes("objectFit") || html.includes('data-object-fit="cover"'))
})

test("poids densités", () => {
  assert.equal(blockWeight(shortMemory("m", "x")), 1)
  assert.equal(blockWeight(shortPhoto("p")), 2)
})

test("memoryToBlock / photoToBlock", () => {
  const p = profile({
    memories: [{ id: "m1", text: "Hello world souvenir." }],
    photos: [
      {
        id: "ph1",
        useAuthorized: true,
        storagePath: "x.jpg",
        caption: "Cap",
      },
    ],
  })
  const mb = memoryToBlock(p.memories[0]!, p)
  const pb = photoToBlock(p.photos[0]!, p, "https://x")
  assert.ok(mb)
  assert.equal(mb!.sourceMemoryId, "m1")
  assert.ok(pb)
  assert.equal(pb!.sourcePhotoId, "ph1")
})
