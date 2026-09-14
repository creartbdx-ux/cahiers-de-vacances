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
  blockTextWordCount,
  collectPersonalBlocks,
  composePersonalEditorialPages,
  isTrueHeroCandidate,
  memoryToBlock,
  pageFillScore,
  pageProvenance,
  photoToBlock,
  prefersDedicatedPage,
  PERSONAL_PAGE_CAPACITY,
  PERSONAL_PAGE_MAX_BLOCKS,
  PERSONAL_PAGE_MAX_PHOTOS,
  type MemoryBlockV1,
  type PhotoMemoryBlockV1,
} from "./index"
import {
  classifyMemoryDensity,
  classifyPhotoMemoryDensity,
  toMemoryPageSource,
  toPhotoMemorySource,
  wordCount,
} from "@/lib/memory-pages"

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

function shortMemory(id: string, text = "Petite anecdote."): MemoryBlockV1 {
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

function mediumMemory(id: string): MemoryBlockV1 {
  return {
    type: "MEMORY",
    sourceMemoryId: id,
    title: "Moment partagé",
    body: "Une anecdote un peu plus longue pour un souvenir de densité moyenne, sans être un récit riche.",
    density: "MEDIUM",
    participantIds: ["p1"],
    fullPageRecommended: true, // may be true — must NOT force HERO
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
    fullPageRecommended: true, // typical photo flag — must NOT force HERO
    weakSource: false,
  }
}

function mediumPhoto(id: string): PhotoMemoryBlockV1 {
  return {
    type: "PHOTO_MEMORY",
    sourcePhotoId: id,
    signedUrl: `https://signed.example/${id}.jpg`,
    caption: "Légende un peu plus détaillée de la photo",
    anecdote: "Petite note",
    title: "Légende un peu plus détaillée",
    body: "Légende un peu plus détaillée de la photo. Petite note",
    density: "MEDIUM",
    photoLayout: "LANDSCAPE",
    participantIds: ["p1"],
    fullPageRecommended: true,
    weakSource: false,
  }
}

test("3 memories SHORT => THREE_SNIPPETS sur 1 page", () => {
  const pages = composePersonalEditorialPages(
    [
      shortMemory("m1", "Petite anecdote A."),
      shortMemory("m2", "Petite anecdote B."),
      shortMemory("m3", "Petite anecdote C."),
    ],
    "three-short",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "THREE_SNIPPETS")
  assert.ok(pages[0]!.pageFillScore >= 0.6)
})

test("1 PHOTO MEDIUM + MEMORY SHORT => PHOTO_PLUS_MEMORY", () => {
  const pages = composePersonalEditorialPages(
    [mediumPhoto("ph1"), shortMemory("m1")],
    "photo-mem",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "PHOTO_PLUS_MEMORY")
})

test("1 PHOTO MEDIUM + 2 MEMORY SHORT => PHOTO_PLUS_TWO_SNIPPETS", () => {
  const pages = composePersonalEditorialPages(
    [mediumPhoto("ph1"), shortMemory("m1"), shortMemory("m2")],
    "photo-two",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "PHOTO_PLUS_TWO_SNIPPETS")
})

test("2 PHOTO SHORT/MEDIUM => peuvent partager une page", () => {
  const pages = composePersonalEditorialPages(
    [shortPhoto("ph1"), mediumPhoto("ph2")],
    "two-photos",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "TWO_PHOTOS")
})

test("2 MEMORY MEDIUM => TWO_MEMORIES correctement rempli", () => {
  const pages = composePersonalEditorialPages(
    [mediumMemory("m1"), mediumMemory("m2")],
    "two-mem",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "TWO_MEMORIES")
  assert.equal(pages[0]!.pageFillScore, 1)
  const html = renderToStaticMarkup(
    createElement(PersonalEditorialTemplate, {
      page: pages[0]!,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(html.includes('data-memory-split="50-50"'))
  assert.ok(html.includes('data-packing-fill="1.00"') || html.includes('data-personal-fill="1.00"'))
})

test("7 blocs moyens/courts => objectif <=4 pages", () => {
  const blocks = [
    mediumPhoto("ph1"),
    mediumPhoto("ph2"),
    shortPhoto("ph3"),
    mediumMemory("m1"),
    shortMemory("m2"),
    shortMemory("m3"),
    shortMemory("m4"),
  ]
  assert.equal(blocks.length, 7)
  const pages = composePersonalEditorialPages(blocks, "seven-blocks")
  assert.ok(pages.length <= 4, `expected <=4 pages, got ${pages.length}`)
  assert.ok(pages.filter((p) => p.isHero).length <= 1)
  // Most pages should be reasonably filled
  const underfilled = pages.filter((p) => p.pageFillScore < 0.6 && !p.isHero)
  assert.ok(underfilled.length === 0 || pages.length === 1)
})

test("MEMORY SHORT seul + autres blocs => pas HERO", () => {
  const pages = composePersonalEditorialPages(
    [shortMemory("alone"), mediumPhoto("ph1"), shortMemory("m2")],
    "no-short-hero",
  )
  const alonePage = pages.find((p) =>
    p.blocks.some((b) => b.type === "MEMORY" && b.sourceMemoryId === "alone"),
  )
  assert.ok(alonePage)
  assert.equal(alonePage!.isHero, false)
  assert.ok(alonePage!.blocks.length >= 2)
})

test("HERO non automatique avec fullPageRecommended=true", () => {
  const block = mediumPhoto("phX")
  assert.equal(block.fullPageRecommended, true)
  assert.equal(isTrueHeroCandidate(block), false)
  assert.equal(prefersDedicatedPage(block), false)
  const pages = composePersonalEditorialPages(
    [block, shortMemory("m1")],
    "no-auto-hero",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.isHero, false)
})

test("RICH réel => HERO possible", () => {
  const rich: MemoryBlockV1 = {
    type: "MEMORY",
    sourceMemoryId: "rich",
    title: "Long séjour",
    body: "Texte riche détaillé ".repeat(30),
    density: "RICH",
    participantIds: ["p1"],
    fullPageRecommended: true,
  }
  assert.equal(isTrueHeroCandidate(rich), true)
  const pages = composePersonalEditorialPages([rich], "hero-mem")
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "HERO_MEMORY")
  assert.equal(pages[0]!.isHero, true)
  assert.equal(pages[0]!.heroReason, "RICH + volume suffisant")
})

test("bloc isolé MEDIUM ne devient pas HERO uniquement parce qu'il est dernier", () => {
  const pages = composePersonalEditorialPages([mediumMemory("solo")], "solo-medium")
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "SINGLE_MEMORY")
  assert.equal(pages[0]!.isHero, false)
  assert.equal(pages[0]!.heroReason, null)
  const html = renderToStaticMarkup(
    createElement(PersonalEditorialTemplate, {
      page: pages[0]!,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(html.includes('data-layout-zone="single-memory"'))
  assert.ok(!html.includes("bloc isolé"))
})

test("PHOTO_PLUS_MEMORY utilise zone photo + vraie zone mémoire", () => {
  const pages = composePersonalEditorialPages(
    [mediumPhoto("ph1"), shortMemory("m1")],
    "ppm-zones",
  )
  assert.equal(pages[0]!.layoutId, "PHOTO_PLUS_MEMORY")
  const html = renderToStaticMarkup(
    createElement(PersonalEditorialTemplate, {
      page: pages[0]!,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(html.includes('data-layout-zone="photo-plus-memory"'))
  assert.ok(html.includes('data-source="photo"'))
  assert.ok(html.includes('data-source="memory"'))
  assert.ok(html.includes("Souvenir"))
})

test("TWO_MEMORIES répartit dans la hauteur", () => {
  const pages = composePersonalEditorialPages(
    [mediumMemory("m1"), mediumMemory("m2")],
    "two-mem-h",
  )
  const html = renderToStaticMarkup(
    createElement(PersonalEditorialTemplate, {
      page: pages[0]!,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(html.includes('data-layout-zone="two-memories"'))
  assert.ok(html.includes('data-memory-split="50-50"'))
})

test("THREE_SNIPPETS utilise trois zones", () => {
  const pages = composePersonalEditorialPages(
    [shortMemory("a"), shortMemory("b"), shortMemory("c")],
    "three-z",
  )
  const html = renderToStaticMarkup(
    createElement(PersonalEditorialTemplate, {
      page: pages[0]!,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(html.includes('data-layout-zone="three-snippets"'))
})

test("orientation portrait PHOTO_PLUS_MEMORY", () => {
  const portrait = { ...mediumPhoto("phP"), aspectRatio: 0.7, photoLayout: "PORTRAIT" as const }
  const pages = composePersonalEditorialPages([portrait, shortMemory("m1")], "port")
  const html = renderToStaticMarkup(
    createElement(PersonalEditorialTemplate, {
      page: pages[0]!,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(html.includes("photo-plus-memory-portrait") || html.includes("photo-plus-memory"))
})

test("même seed = même layout", () => {
  const blocks = [shortPhoto("p1"), shortMemory("m1"), mediumMemory("m2")]
  const a = composePersonalEditorialPages(blocks, "layout-seed")
  const b = composePersonalEditorialPages(blocks, "layout-seed")
  assert.deepEqual(
    a.map((p) => p.layoutId),
    b.map((p) => p.layoutId),
  )
})

test("photo RICH => HERO possible", () => {
  const rich: PhotoMemoryBlockV1 = {
    ...shortPhoto("phR"),
    density: "RICH",
    caption: "Longue légende ".repeat(12),
    anecdote: "Anecdote détaillée ".repeat(16),
    body: `${"Longue légende ".repeat(12)} ${"Anecdote détaillée ".repeat(16)}`,
    fullPageRecommended: true,
  }
  assert.equal(isTrueHeroCandidate(rich), true)
  const pages = composePersonalEditorialPages([rich], "hero-photo")
  assert.equal(pages[0]!.layoutId, "HERO_PHOTO_MEMORY")
  assert.equal(pages[0]!.heroReason, "RICH + volume suffisant")
})

test("pageFillScore calculé ; éviter page <60% si combinaison existe", () => {
  const pages = composePersonalEditorialPages(
    [shortMemory("a"), shortMemory("b"), shortMemory("c")],
    "fill",
  )
  assert.equal(pages.length, 1)
  assert.ok(pageFillScore(pages[0]!.blocks) >= 0.6)
  assert.equal(pages[0]!.pageFillScore, pageFillScore(pages[0]!.blocks))
})

test("même seed => même composition", () => {
  const blocks = [
    shortMemory("m1"),
    shortMemory("m2"),
    shortPhoto("p1"),
    mediumMemory("m3"),
  ]
  const a = composePersonalEditorialPages(blocks, "seed-stable")
  const b = composePersonalEditorialPages(blocks, "seed-stable")
  assert.deepEqual(
    a.map((p) => ({ layout: p.layoutId, ids: pageProvenance(p), fill: p.pageFillScore })),
    b.map((p) => ({ layout: p.layoutId, ids: pageProvenance(p), fill: p.pageFillScore })),
  )
})

test("provenance inchangée ; aucun faux lien", () => {
  const pages = composePersonalEditorialPages(
    [shortPhoto("phX"), shortMemory("mY")],
    "prov",
  )
  const prov = pageProvenance(pages[0]!)
  assert.deepEqual(prov.sourcePhotoIds.sort(), ["phX"])
  assert.deepEqual(prov.sourceMemoryIds.sort(), ["mY"])
})

test("max 3 blocks / max 2 photos", () => {
  const blocks = [
    shortMemory("m1"),
    shortMemory("m2"),
    shortMemory("m3"),
    shortMemory("m4"),
    shortPhoto("p1"),
    shortPhoto("p2"),
    shortPhoto("p3"),
  ]
  const pages = composePersonalEditorialPages(blocks, "caps")
  for (const page of pages) {
    assert.ok(page.blocks.length <= PERSONAL_PAGE_MAX_BLOCKS)
    assert.ok(
      page.blocks.filter((b) => b.type === "PHOTO_MEMORY").length <=
        PERSONAL_PAGE_MAX_PHOTOS,
    )
    assert.ok(page.weight <= PERSONAL_PAGE_CAPACITY)
  }
})

test("Blueprint utilise pages composées (pas 1:1)", () => {
  assert.equal(getArchetype("PERSONAL_EDITORIAL_PAGE").implementationStatus, "READY")
  const p = profile({
    memories: [
      { id: "m1", text: "Petite anecdote A." },
      { id: "m2", text: "Petite anecdote B." },
      { id: "m3", text: "Petite anecdote C." },
      { id: "m4", text: "Petite anecdote D." },
    ],
    photos: [
      { id: "ph1", useAuthorized: true, storagePath: "books/x/1.jpg", caption: "Légende A" },
      { id: "ph2", useAuthorized: true, storagePath: "books/x/2.jpg", caption: "Légende B" },
    ],
    sharedProfile: { interestUniverseIds: ["BEAUTY", "TRAVEL", "FASHION", "NATURE"] },
  })
  const blocks = collectPersonalBlocks({ profile: p })
  const composed = composePersonalEditorialPages(blocks, "pep-bp:personal-editorial")
  const bp = buildBookBlueprint({
    bookProjectId: "proj",
    seed: "pep-bp",
    profile: p,
    richnessLevel: "RICH",
    styles: STYLES,
    palettes: [PALETTE],
  })
  const editorial = bp.pages.filter((x) => x.archetypeId === "PERSONAL_EDITORIAL_PAGE")
  assert.equal(editorial.length, composed.length)
  assert.ok(editorial.length < blocks.length)
  assert.equal(bp.pages.filter((x) => x.archetypeId === "MEMORY_TEXT_PAGE").length, 0)
  assert.equal(bp.pages.filter((x) => x.archetypeId === "PHOTO_MEMORY_PAGE").length, 0)
})

test("template PHOTO_PLUS_MEMORY sépare les sources", () => {
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
  assert.ok(html.includes('data-object-fit="cover"'))
})

test("poids photo MEDIUM permet TWO_PHOTOS", () => {
  assert.equal(blockWeight(mediumPhoto("p")), 2)
  assert.equal(blockWeight(shortPhoto("p")), 2)
})

test("memoryToBlock / photoToBlock", () => {
  const p = profile({
    memories: [{ id: "m1", text: "Hello world souvenir." }],
    photos: [
      { id: "ph1", useAuthorized: true, storagePath: "x.jpg", caption: "Cap" },
    ],
  })
  assert.ok(memoryToBlock(p.memories[0]!, p))
  assert.ok(photoToBlock(p.photos[0]!, p, "https://x"))
})

function wordsN(n: number, seed = "mot"): string {
  return Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ")
}

test("memory ~30 mots => SHORT", () => {
  const text = wordsN(30, "court")
  assert.equal(wordCount(text), 30)
  const source = toMemoryPageSource({
    id: "s30",
    text,
    title: "Titre décoratif",
    place: "Lieu décoratif",
  })!
  assert.equal(classifyMemoryDensity({ source }), "SHORT")
})

test("memory ~60 mots => MEDIUM, pas RICH", () => {
  const text = wordsN(60, "moyen")
  const source = toMemoryPageSource({
    id: "s60",
    text,
    title: "Titre long qui ne compte pas",
    place: "Paris",
  })!
  assert.equal(classifyMemoryDensity({ source }), "MEDIUM")
})

test("memory substantiel => RICH", () => {
  const text = wordsN(100, "riche")
  const source = toMemoryPageSource({ id: "s100", text })!
  assert.equal(classifyMemoryDensity({ source }), "RICH")
})

test("titre/lieu seuls ne gonflent pas artificiellement la densité", () => {
  const text = wordsN(28, "body")
  const bare = toMemoryPageSource({ id: "a", text })!
  const fancy = toMemoryPageSource({
    id: "b",
    text,
    title: "Un très beau titre de souvenir",
    place: "Saint-Malo",
  })!
  assert.equal(classifyMemoryDensity({ source: bare }), "SHORT")
  assert.equal(classifyMemoryDensity({ source: fancy }), "SHORT")
})

test("photo + texte court ne devient pas RICH automatiquement", () => {
  const source = toPhotoMemorySource(
    {
      id: "ph",
      useAuthorized: true,
      storagePath: "x.jpg",
      caption: "Deux phrases courtes. Rien de plus.",
      anecdote: "Encore une note brève.",
    },
    "https://x",
  )!
  assert.equal(classifyPhotoMemoryDensity(source), "SHORT")
})

test("3 photos + 4 petits memories => peut produire 3 pages", () => {
  const blocks = [
    shortPhoto("ph1"),
    shortPhoto("ph2"),
    mediumPhoto("ph3"),
    shortMemory("m1", wordsN(25, "a")),
    shortMemory("m2", wordsN(22, "b")),
    shortMemory("m3", wordsN(18, "c")),
    shortMemory("m4", wordsN(20, "d")),
  ]
  assert.equal(blocks.length, 7)
  const pages = composePersonalEditorialPages(blocks, "3ph-4mem")
  assert.ok(pages.length <= 3, `expected <=3 pages, got ${pages.length}`)
  assert.ok(pages.some((p) => p.layoutId === "PHOTO_PLUS_TWO_SNIPPETS"))
})

test("PHOTO_PLUS_TWO_SNIPPETS réellement sélectionnable et zones", () => {
  const pages = composePersonalEditorialPages(
    [mediumPhoto("ph1"), shortMemory("m1"), shortMemory("m2")],
    "ppt-select",
  )
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.layoutId, "PHOTO_PLUS_TWO_SNIPPETS")
  const html = renderToStaticMarkup(
    createElement(PersonalEditorialTemplate, {
      page: pages[0]!,
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
    }),
  )
  assert.ok(html.includes('data-layout-zone="photo-plus-two"'))
  assert.equal((html.match(/data-source="memory"/g) ?? []).length, 2)
})

test("RICH conserve possibilité de 4 pages", () => {
  const richBody = wordsN(95, "riche")
  const rich: MemoryBlockV1 = {
    type: "MEMORY",
    sourceMemoryId: "rich",
    title: "Long séjour",
    body: richBody,
    density: "RICH",
    participantIds: ["p1"],
    fullPageRecommended: true,
  }
  const blocks = [
    mediumPhoto("ph1"),
    mediumPhoto("ph2"),
    shortPhoto("ph3"),
    rich,
    mediumMemory("m2"),
    mediumMemory("m3"),
    mediumMemory("m4"),
  ]
  const pages = composePersonalEditorialPages(blocks, "rich-keeps-pages")
  // With a true RICH + medium companions, packing may need 4 pages
  assert.ok(pages.length >= 3)
  assert.ok(pages.length <= 4)
  assert.ok(isTrueHeroCandidate(rich))
  assert.ok(
    pages.some(
      (p) =>
        p.layoutId === "HERO_MEMORY" ||
        p.blocks.some((b) => b.type === "MEMORY" && b.sourceMemoryId === "rich"),
    ),
  )
})

test("variantes PHOTO_PLUS_MEMORY seed-stables", () => {
  const a = composePersonalEditorialPages(
    [mediumPhoto("ph1"), shortMemory("m1")],
    "var-seed",
  )
  const b = composePersonalEditorialPages(
    [mediumPhoto("ph1"), shortMemory("m1")],
    "var-seed",
  )
  assert.equal(a[0]!.layoutVariant, b[0]!.layoutVariant)
  assert.ok(a[0]!.layoutVariant === "STACK" || a[0]!.layoutVariant === "ASYMMETRIC")
})

test("blockTextWordCount expose le volume réel", () => {
  const m = shortMemory("m", wordsN(12, "w"))
  assert.equal(blockTextWordCount(m), 12)
})
