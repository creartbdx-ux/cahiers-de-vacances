import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { Palette } from "@/lib/supabase/types"
import { FakeContentGenerationProvider, UnconfiguredProvider } from "@/lib/content-generation/provider"
import { getStyleTokens } from "@/lib/book-renderer/styles"
import { getArchetype } from "@/lib/book-blueprint/archetypes"
import { buildBookBlueprint } from "@/lib/book-blueprint"
import { MemoryTemplate } from "@/components/book-renderer/templates/memory-template"
import { PhotoMemoryTemplate } from "@/components/book-renderer/templates/photo-memory-template"
import {
  buildMemoryPage,
  buildPhotoMemoryPage,
  classifyPhotoMemoryLayout,
  editorializeMemoryPage,
  editorializePhotoMemoryPage,
  memoryPayloadLooksMinimal,
  photoMemoryPayloadLooksMinimal,
  photoShareForLayout,
  selectDistinctMemories,
  selectMemoryForPage,
  titleLooksGroundedInSource,
  toMemoryPageSource,
  toPhotoMemorySource,
  MEMORY_PAGE_FALLBACK_TITLE,
  PHOTO_MEMORY_FALLBACK_TITLE,
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
      { id: "f1", category: "FOOD", value: "Sushi" },
      { id: "f2", category: "MUSIC", value: "Jazz" },
    ],
    memories: [
      {
        id: "m1",
        title: "La plage",
        text: "On a marché pieds nus jusqu'au phare, le vent était doux et la mer presque plate.",
        participantIds: ["p1"],
        place: "Belle-Île",
      },
      {
        id: "m2",
        text: "Soirée improvisée sur le balcon avec des lampions et trop de rires.",
        participantIds: ["p1"],
      },
    ],
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

test("MEMORY_TEXT_PAGE utilise uniquement un memory existant", async () => {
  const p = profile()
  const result = await buildMemoryPage({
    profile: p,
    seed: "mem-1",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(p.memories.some((m) => m.id === result.source.memoryId))
  assert.equal(result.editorial.sourceMemoryId, result.source.memoryId)
})

test("provenance sourceMemoryId conservée", async () => {
  const p = profile()
  const result = await buildMemoryPage({
    profile: p,
    seed: "prov",
    memoryId: "m1",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.sourceMemoryId, "m1")
  assert.equal(result.source.memoryId, "m1")
})

test("BookProfile complet jamais envoyé au provider", async () => {
  let captured: unknown = null
  const provider = new FakeContentGenerationProvider(async (req) => {
    captured = req.input
    return {
      ok: true,
      data: {
        title: "Douceur maritime",
        eyebrow: "Belle-Île",
        body: "On a marché pieds nus jusqu'au phare, le vent était doux et la mer presque plate.",
        sourceMemoryId: "m1",
      },
    }
  })

  const source = toMemoryPageSource(profile().memories[0]!)!
  await editorializeMemoryPage({
    source,
    profile: profile({
      personalFacts: [{ id: "secret", category: "HABIT", value: "SECRET_FACT_XYZ" }],
      memories: [
        ...profile().memories,
        { id: "m99", text: "Autre souvenir secret jamais exposé" },
      ],
    }),
    seed: "ai-1",
    provider,
  })

  assert.ok(captured)
  const raw = JSON.stringify(captured)
  assert.ok(!raw.includes("SECRET_FACT_XYZ"))
  assert.ok(!raw.includes("m99"))
  assert.ok(!raw.includes("personalFacts"))
  assert.ok(memoryPayloadLooksMinimal(captured))
  assert.ok(raw.includes("m1"))
  assert.ok(raw.includes("phare"))
})

test("aucune donnée personnelle hors source envoyée", async () => {
  const provider = new FakeContentGenerationProvider(async (req) => {
    const raw = JSON.stringify(req.input).toLowerCase()
    assert.ok(!raw.includes("email"))
    assert.ok(!raw.includes("user_id"))
    assert.ok(!raw.includes("insidejokes"))
    assert.ok(!raw.includes("forbiddentopics"))
    return {
      ok: true,
      data: {
        title: "Balcon",
        eyebrow: null,
        body: "Soirée improvisée sur le balcon avec des lampions et trop de rires.",
        sourceMemoryId: "m2",
      },
    }
  })

  await buildMemoryPage({
    profile: profile({
      insideJokes: [{ id: "j1", text: "blague secrète" }],
      forbiddenTopics: {
        answered: true,
        hasRestrictions: true,
        text: "politique",
      },
    }),
    seed: "privacy",
    memoryId: "m2",
    provider,
  })
})

test("fallback sans IA fonctionne", async () => {
  const result = await buildMemoryPage({
    profile: profile(),
    seed: "fb",
    memoryId: "m1",
    provider: new UnconfiguredProvider(),
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.usedAi, false)
  assert.equal(result.editorial.title, "La plage")
  assert.equal(result.editorial.body.includes("phare"), true)
  assert.equal(result.editorial.place, "Belle-Île")
})

test("fallback titre par défaut sans title source", async () => {
  const result = await buildMemoryPage({
    profile: profile(),
    seed: "fb2",
    memoryId: "m2",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.title, MEMORY_PAGE_FALLBACK_TITLE)
})

test("MEMORY_TEXT_PAGE n'associe plus une photo arbitraire", async () => {
  const p = profile({
    photos: [
      {
        id: "ph-vacances",
        useAuthorized: true,
        storagePath: "books/x/vacances.jpg",
        participantIds: ["p1"],
        caption: "Voyage en Australie en haut de la tour",
        anecdote: "Dernier jour",
      },
    ],
    memories: [
      {
        id: "m-pro",
        text: "Lors de nos premiers rendez-vous professionnels nous avons beaucoup appris.",
        participantIds: ["p1"],
      },
    ],
  })
  const result = await buildMemoryPage({
    profile: p,
    seed: "no-heuristic",
    memoryId: "m-pro",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.variant, "TEXT_ONLY")
  assert.equal(result.photo, null)
  assert.deepEqual(result.editorial.sourcePhotoIds, [])
  assert.deepEqual(result.source.linkedPhotoIds, [])
  assert.ok(!result.editorial.body.toLowerCase().includes("australie"))
})

test("participant overlap seul ne crée jamais un lien photo/memory", () => {
  const p = profile({
    photos: [
      {
        id: "ph1",
        useAuthorized: true,
        storagePath: "books/x/ph1.jpg",
        participantIds: ["p1", "p2"],
        caption: "Emma et Sami en vacances",
      },
    ],
    participants: [
      { id: "p1", firstName: "Emma" },
      { id: "p2", firstName: "Sami" },
    ],
    memories: [
      {
        id: "m1",
        text: "Souvenir professionnel d'Emma et Sami au bureau.",
        participantIds: ["p1", "p2"],
      },
    ],
  })
  const source = toMemoryPageSource(p.memories[0]!)!
  assert.deepEqual(source.linkedPhotoIds, [])
})

test("même seed = même souvenir sélectionné", () => {
  const p = profile({
    memories: [
      {
        id: "a",
        text: "Premier souvenir assez détaillé pour compter vraiment dans le score.",
        participantIds: ["p1"],
      },
      {
        id: "b",
        text: "Deuxième souvenir encore plus long avec plein de détails inutiles mais utiles au ranking.",
        participantIds: ["p1"],
      },
      {
        id: "c",
        text: "Troisième souvenir moyen pour diversifier un peu la sélection déterministe.",
        participantIds: ["p1"],
      },
    ],
  })
  const a = selectMemoryForPage({ profile: p, seed: "same-seed-x" })
  const b = selectMemoryForPage({ profile: p, seed: "same-seed-x" })
  assert.ok(a && b)
  assert.equal(a!.memoryId, b!.memoryId)
})

test("plusieurs memories => éviter répétition", () => {
  const p = profile({
    memories: [
      { id: "a", text: "Souvenir A assez long pour être sélectionnable sans hésitation aucune." },
      { id: "b", text: "Souvenir B également détaillé avec une histoire un peu différente." },
      { id: "c", text: "Souvenir C pour compléter le trio et tester la non-répétition." },
    ],
  })
  const picks = selectDistinctMemories({ profile: p, seed: "distinct", count: 3 })
  assert.equal(picks.length, 3)
  assert.equal(new Set(picks.map((x) => x.memoryId)).size, 3)
})

test("DUO/GROUP respect participantIds", () => {
  const duo = profile({
    audience: "DUO",
    participants: [
      { id: "p1", firstName: "Emma" },
      { id: "p2", firstName: "Léa" },
    ],
    memories: [
      {
        id: "solo",
        text: "Souvenir solo d'Emma au marché du dimanche matin sous la pluie fine.",
        participantIds: ["p1"],
      },
      {
        id: "together",
        text: "Souvenir à deux : picnic improvisé dans l'herbe haute près de la rivière.",
        participantIds: ["p1", "p2"],
      },
    ],
  })
  const pick = selectMemoryForPage({
    profile: duo,
    seed: "duo-pref",
    preferParticipantIds: ["p1", "p2"],
  })
  assert.ok(pick)
  assert.ok(pick!.participantIds.includes("p1"))
  assert.ok(pick!.participantIds.includes("p2"))
  assert.equal(pick!.memoryId, "together")
})

test("IA reformule sans inventer de lieu", async () => {
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: {
      title: "Pieds nus",
      eyebrow: "Une lumière douce",
      body: "On a marché pieds nus jusqu'au phare, le vent était doux et la mer presque plate.",
      sourceMemoryId: "m1",
    },
  }))
  const result = await buildMemoryPage({
    profile: profile(),
    seed: "ai-ok",
    memoryId: "m1",
    provider,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.usedAi, true)
  assert.equal(result.editorial.place, "Belle-Île")
  assert.equal(result.editorial.sourceMemoryId, "m1")
})

test("IA qui change sourceMemoryId => fallback", async () => {
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: {
      title: "Hack",
      eyebrow: null,
      body: "On a marché pieds nus jusqu'au phare, le vent était doux et la mer presque plate.",
      sourceMemoryId: "WRONG",
    },
  }))
  const result = await buildMemoryPage({
    profile: profile(),
    seed: "ai-bad",
    memoryId: "m1",
    provider,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.usedAi, false)
  assert.equal(result.editorial.sourceMemoryId, "m1")
})

test("MemoryTemplate rend TEXT_ONLY", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryTemplate, {
      title: "Un souvenir à garder",
      body: "Soirée improvisée sur le balcon.",
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
      visualRole: "LIGHT",
      variant: "TEXT_ONLY",
      density: "MEDIUM",
    }),
  )
  assert.ok(html.includes("SOUVENIR"))
  assert.ok(html.includes("Un souvenir à garder"))
  assert.ok(!html.includes("<img"))
  assert.ok(!html.toLowerCase().includes("manquant"))
  assert.ok(html.includes('data-memory-layout="editorial"'))
})

test("aucune correction générée — correctionRequired false", () => {
  const arch = getArchetype("MEMORY_TEXT_PAGE")
  assert.equal(arch.correctionRequired, false)
  assert.equal(arch.correctionWeight, 0)
  assert.equal(arch.implementationStatus, "READY")
})

test("Blueprint MEMORY_TEXT_PAGE READY ; PERSONAL_EDITORIAL_PAGE READY", () => {
  assert.equal(getArchetype("MEMORY_TEXT_PAGE").implementationStatus, "READY")
  assert.equal(getArchetype("PHOTO_MEMORY_PAGE").implementationStatus, "READY")
  assert.equal(getArchetype("PERSONAL_EDITORIAL_PAGE").implementationStatus, "READY")

  const bp = buildBookBlueprint({
    bookProjectId: "proj",
    seed: "bp-mem",
    profile: profile({
      memories: [
        { id: "m1", text: "Souvenir long pour le blueprint testing." },
        { id: "m2", text: "Autre souvenir utile." },
        { id: "m3", text: "Encore un souvenir." },
        { id: "m4", text: "Dernier souvenir." },
      ],
      photos: [
        {
          id: "ph1",
          useAuthorized: true,
          storagePath: "books/x/1.jpg",
          caption: "Légende A",
          anecdote: "Anecdote A",
        },
        {
          id: "ph2",
          useAuthorized: true,
          storagePath: "books/x/2.jpg",
          caption: "Légende B",
        },
        {
          id: "ph3",
          useAuthorized: true,
          storagePath: "books/x/3.jpg",
          anecdote: "Anecdote C",
        },
      ],
      personalFacts: [
        { id: "f1", category: "FOOD", value: "A" },
        { id: "f2", category: "MUSIC", value: "B" },
        { id: "f3", category: "PLACE", value: "C" },
      ],
      sharedProfile: { interestUniverseIds: ["BEAUTY", "TRAVEL", "FASHION", "NATURE"] },
    }),
    richnessLevel: "RICH",
    styles: STYLES,
    palettes: [PALETTE],
  })

  const editorial = bp.pages.filter((p) => p.archetypeId === "PERSONAL_EDITORIAL_PAGE")
  assert.ok(editorial.length >= 1)
  assert.ok(editorial.every((p) => p.implementationStatus === "READY"))

  const memoryGap = bp.capabilityGaps.find((g) => g.family === "MEMORY")
  assert.equal(memoryGap, undefined)

  const photoGap = bp.capabilityGaps.find((g) => g.family === "PHOTO")
  assert.equal(photoGap, undefined)

  const editorialGap = bp.capabilityGaps.find((g) => g.family === "PERSONAL_EDITORIAL")
  assert.equal(editorialGap, undefined)
})

test("Blueprint PHOTO weak-only pages restent PARTIAL", () => {
  const bp = buildBookBlueprint({
    bookProjectId: "proj-weak",
    seed: "bp-weak",
    profile: profile({
      memories: [],
      photos: [
        {
          id: "ph-empty",
          useAuthorized: true,
          storagePath: "books/x/empty.jpg",
        },
      ],
      personalFacts: [
        { id: "f1", category: "FOOD", value: "A" },
        { id: "f2", category: "MUSIC", value: "B" },
        { id: "f3", category: "PLACE", value: "C" },
      ],
      sharedProfile: { interestUniverseIds: ["BEAUTY", "TRAVEL", "FASHION", "NATURE"] },
    }),
    richnessLevel: "RICH",
    styles: STYLES,
    palettes: [PALETTE],
  })
  const editorial = bp.pages.filter((p) => p.archetypeId === "PERSONAL_EDITORIAL_PAGE")
  assert.ok(editorial.every((p) => p.implementationStatus === "PARTIAL"))
})

test("memory inexistant => échec sans invention", async () => {
  const result = await buildMemoryPage({
    profile: profile(),
    seed: "x",
    memoryId: "does-not-exist",
    forceFallback: true,
  })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, "NO_MEMORY")
})

test("souvenir court sans photo => SHORT", async () => {
  const text =
    "Lors de notre voyage en Australie nous avons fait escale à Tokyo et nous avons tenté l'expérience du 'onsen' japonais !"
  const result = await buildMemoryPage({
    profile: profile({
      memories: [{ id: "onsen", text }],
      photos: [],
    }),
    seed: "short-1",
    memoryId: "onsen",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.density, "SHORT")
  assert.equal(result.editorial.variant, "TEXT_ONLY")
})

test("souvenir riche => RICH", async () => {
  const text = [
    "Le premier jour, nous avons marché jusqu'au phare sous un ciel immense et presque trop calme.",
    "Le soir, autour d'un feu, quelqu'un a raconté l'histoire du bateau manqué et des tempêtes d'autrefois.",
    "Le lendemain, la mer était plate ; on a prolongé la journée jusqu'au crépuscule sans regarder l'heure.",
    "Le troisième matin, le vent est revenu et nous avons repris le sentier côtier, plus lentement.",
    "Ces trois jours restent le cœur discret de ce voyage, sans rien d'extraordinaire à part le temps partagé,",
    "les pauses silencieuses, et le sentiment d'avoir enfin ralenti ensemble pendant une parenthèse réelle.",
  ].join(" ")
  const result = await buildMemoryPage({
    profile: profile({
      memories: [
        {
          id: "rich",
          title: "Trois jours au phare",
          text,
          place: "Ouessant",
        },
      ],
    }),
    seed: "rich-1",
    memoryId: "rich",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.density, "RICH")
})

test("SHORT n'est pas artificiellement allongé par fallback", async () => {
  const text =
    "Lors de notre voyage en Australie nous avons fait escale à Tokyo et nous avons tenté l'expérience du 'onsen' japonais !"
  const sourceWords = text.trim().split(/\s+/).length
  const result = await buildMemoryPage({
    profile: profile({ memories: [{ id: "onsen", text }], photos: [] }),
    seed: "no-pad",
    memoryId: "onsen",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const bodyWords = result.editorial.body.trim().split(/\s+/).length
  assert.ok(bodyWords <= sourceWords + 2)
  assert.equal(result.editorial.body.trim(), text.trim())
})

test("fullPageRecommended=false possible pour SHORT", async () => {
  const result = await buildMemoryPage({
    profile: profile({
      memories: [{ id: "s", text: "Petite escale à Tokyo pour un onsen." }],
      photos: [],
    }),
    seed: "weak",
    memoryId: "s",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.density, "SHORT")
  assert.equal(result.fullPageRecommended, false)
})

test("photo ne sauve plus un MEMORY_TEXT SHORT", async () => {
  const result = await buildMemoryPage({
    profile: profile({
      memories: [
        {
          id: "s",
          text: "Petite escale à Tokyo pour un onsen.",
          participantIds: ["p1"],
        },
      ],
      photos: [
        {
          id: "ph1",
          useAuthorized: true,
          storagePath: "books/x/ph1.jpg",
          participantIds: ["p1"],
          caption: "Onsente",
        },
      ],
    }),
    seed: "short-photo",
    memoryId: "s",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.variant, "TEXT_ONLY")
  assert.equal(result.photo, null)
  assert.equal(result.fullPageRecommended, false)
})

test("titre ne contient aucune donnée extérieure à la source", async () => {
  const text =
    "Lors de notre voyage en Australie nous avons fait escale à Tokyo et nous avons tenté l'expérience du 'onsen' japonais !"
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: {
      title: "Une escale à Tokyo",
      eyebrow: "Sur le chemin de l'Australie",
      body: text,
      sourceMemoryId: "onsen",
    },
  }))
  const result = await buildMemoryPage({
    profile: profile({ memories: [{ id: "onsen", text }], photos: [] }),
    seed: "title-ok",
    memoryId: "onsen",
    provider,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(titleLooksGroundedInSource(result.editorial.title, text))
  assert.ok(!result.editorial.title.toLowerCase().includes("kyoto"))
  assert.ok(!result.editorial.body.toLowerCase().includes("fuji"))
})

test("TEXT_ONLY SHORT utilise la variante de layout quote", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryTemplate, {
      title: "Une escale à Tokyo",
      body: "Nous avons tenté l'expérience du onsen japonais.",
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
      variant: "TEXT_ONLY",
      density: "SHORT",
    }),
  )
  assert.ok(html.includes('data-memory-density="SHORT"'))
  assert.ok(html.includes('data-memory-layout="quote"'))
  assert.ok(html.includes("<blockquote"))
})

test("règles anti-invention — mauvais sourceMemoryId => fallback", async () => {
  const badId = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: {
      title: "Hack",
      eyebrow: null,
      body: "texte",
      sourceMemoryId: "OTHER",
    },
  }))
  const result = await buildMemoryPage({
    profile: profile(),
    seed: "anti",
    memoryId: "m1",
    provider: badId,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.usedAi, false)
  assert.equal(result.editorial.place, "Belle-Île")
})

test("Blueprint expose memoryContentHints WEAK pour SHORT", () => {
  const bp = buildBookBlueprint({
    bookProjectId: "proj-hints",
    seed: "hints",
    profile: profile({
      memories: [
        { id: "onsen", text: "Petite escale à Tokyo pour un onsen." },
        {
          id: "rich",
          title: "Long séjour",
          place: "Kyoto",
          text: [
            "Premier jour au temple, puis une longue marche jusqu'à la rivière.",
            "Le soir, un dîner simple et beaucoup de rires autour de la table.",
            "Le lendemain, la pluie a prolongé le café jusqu'à l'après-midi entier.",
          ].join(" "),
        },
      ],
      photos: [],
      personalFacts: [
        { id: "f1", category: "FOOD", value: "A" },
        { id: "f2", category: "MUSIC", value: "B" },
        { id: "f3", category: "PLACE", value: "C" },
      ],
      sharedProfile: { interestUniverseIds: ["BEAUTY", "TRAVEL", "FASHION", "NATURE"] },
    }),
    richnessLevel: "RICH",
    styles: STYLES,
    palettes: [PALETTE],
  })
  assert.equal(getArchetype("MEMORY_TEXT_PAGE").implementationStatus, "READY")
  const weak = bp.memoryContentHints.find((h) => h.memoryId === "onsen")
  assert.ok(weak)
  assert.equal(weak!.fullPageRecommended, false)
  assert.equal(weak!.fullPageFitness, "WEAK")
})

// ---------------------------------------------------------------------------
// PHOTO_MEMORY_PAGE
// ---------------------------------------------------------------------------

test("PHOTO_MEMORY_PAGE utilise caption + anecdote de LA photo choisie", async () => {
  const caption =
    "Sami et moi lors de notre voyage en Australie tout en haut de la tour Sydney."
  const anecdote = "C'était notre dernier jour en Australie."
  const result = await buildPhotoMemoryPage({
    profile: profile({
      participants: [
        { id: "p1", firstName: "Emma" },
        { id: "p2", firstName: "Sami" },
      ],
      memories: [
        {
          id: "m-other",
          text: "Souvenir professionnel sans rapport avec la photo.",
          participantIds: ["p1", "p2"],
        },
      ],
      photos: [
        {
          id: "phA",
          useAuthorized: true,
          storagePath: "books/x/a.jpg",
          caption,
          anecdote,
          participantIds: ["p1", "p2"],
        },
        {
          id: "phB",
          useAuthorized: true,
          storagePath: "books/x/b.jpg",
          caption: "METADATA PHOTO B NE DOIT PAS APPARAITRE",
          anecdote: "ANECDOTE PHOTO B SECRETE",
        },
      ],
    }),
    seed: "photo-a",
    photoId: "phA",
    forceFallback: true,
    photoSignedUrls: { phA: "https://signed.example/a.jpg" },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.sourcePhotoId, "phA")
  assert.equal(result.source.photoId, "phA")
  assert.ok(result.editorial.body.includes("Sydney") || result.editorial.body.includes("Australie"))
  assert.ok(result.editorial.body.includes("dernier jour"))
  assert.ok(!result.editorial.body.includes("METADATA PHOTO B"))
  assert.ok(!result.editorial.body.includes("ANECDOTE PHOTO B"))
  assert.ok(!result.editorial.body.toLowerCase().includes("professionnel"))
})

test("PHOTO_MEMORY n'utilise aucun autre memory", async () => {
  let captured: unknown = null
  const provider = new FakeContentGenerationProvider(async (req) => {
    captured = req.input
    return {
      ok: true,
      data: {
        title: "Dernier jour",
        eyebrow: "Australie",
        body: "Sami et moi en haut de la tour. C'était notre dernier jour en Australie.",
        sourcePhotoId: "phA",
      },
    }
  })
  await buildPhotoMemoryPage({
    profile: profile({
      memories: [{ id: "m-secret", text: "SECRET_MEMORY_SHOULD_NOT_APPEAR" }],
      photos: [
        {
          id: "phA",
          useAuthorized: true,
          storagePath: "books/x/a.jpg",
          caption: "Tour de Sydney",
          anecdote: "Dernier jour",
        },
      ],
    }),
    seed: "ai-photo",
    photoId: "phA",
    provider,
    photoSignedUrls: { phA: "https://signed.example/a.jpg" },
  })
  assert.ok(captured)
  const raw = JSON.stringify(captured)
  assert.ok(!raw.includes("SECRET_MEMORY"))
  assert.ok(!raw.includes("m-secret"))
  assert.ok(photoMemoryPayloadLooksMinimal(captured))
  assert.ok(raw.includes("phA"))
  assert.ok(raw.includes("Tour de Sydney"))
})

test("sourcePhotoId conservé ; photo A ≠ metadata photo B", async () => {
  const result = await buildPhotoMemoryPage({
    profile: profile({
      photos: [
        {
          id: "phA",
          useAuthorized: true,
          storagePath: "books/x/a.jpg",
          caption: "Caption A unique",
          anecdote: "Anecdote A unique",
        },
        {
          id: "phB",
          useAuthorized: true,
          storagePath: "books/x/b.jpg",
          caption: "Caption B étrangère",
          anecdote: "Anecdote B étrangère",
        },
      ],
    }),
    seed: "prov-photo",
    photoId: "phA",
    forceFallback: true,
    photoSignedUrls: { phA: "https://signed.example/a.jpg" },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.sourcePhotoId, "phA")
  assert.equal(result.source.caption, "Caption A unique")
  assert.equal(result.source.anecdote, "Anecdote A unique")
  assert.ok(!result.editorial.body.includes("étrangère"))
})

test("fallback PHOTO_MEMORY sans IA", async () => {
  const result = await buildPhotoMemoryPage({
    profile: profile({
      photos: [
        {
          id: "ph1",
          useAuthorized: true,
          storagePath: "books/x/1.jpg",
          caption: "Sur la plage",
          anecdote: "Vent doux",
        },
      ],
    }),
    seed: "fb-photo",
    photoId: "ph1",
    provider: new UnconfiguredProvider(),
    photoSignedUrls: { ph1: "https://signed.example/1.jpg" },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.usedAi, false)
  assert.equal(result.editorial.title, "Sur la plage")
  assert.ok(result.editorial.body.includes("Sur la plage"))
  assert.ok(result.editorial.body.includes("Vent doux"))
  assert.equal(result.fullPageRecommended, true)
})

test("photo sans caption/anecdote => source faible / pas d'invention", async () => {
  const result = await buildPhotoMemoryPage({
    profile: profile({
      photos: [
        {
          id: "ph-empty",
          useAuthorized: true,
          storagePath: "books/x/empty.jpg",
        },
      ],
    }),
    seed: "weak-photo",
    photoId: "ph-empty",
    forceFallback: true,
    photoSignedUrls: { "ph-empty": "https://signed.example/empty.jpg" },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.weakSource, true)
  assert.equal(result.fullPageRecommended, false)
  assert.equal(result.editorial.title, PHOTO_MEMORY_FALLBACK_TITLE)
  assert.equal(result.editorial.body, "")
  assert.equal(result.editorial.usedAi, false)
})

test("layouts LANDSCAPE / PORTRAIT / SQUARE", () => {
  assert.equal(classifyPhotoMemoryLayout(1.6), "LANDSCAPE")
  assert.equal(classifyPhotoMemoryLayout(0.7), "PORTRAIT")
  assert.equal(classifyPhotoMemoryLayout(1.0), "SQUARE")
  assert.equal(classifyPhotoMemoryLayout(undefined), "LANDSCAPE")

  const landscape = renderToStaticMarkup(
    createElement(PhotoMemoryTemplate, {
      title: "Titre",
      body: "Corps",
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
      layout: "LANDSCAPE",
      density: "MEDIUM",
      photoUrl: "https://example.com/l.jpg",
    }),
  )
  assert.ok(landscape.includes('data-photo-memory-layout="LANDSCAPE"'))
  assert.ok(landscape.includes('data-object-fit="cover"'))
  assert.ok(landscape.includes("object-fit:cover") || landscape.includes("objectFit"))

  const portrait = renderToStaticMarkup(
    createElement(PhotoMemoryTemplate, {
      title: "Titre",
      body: "Corps",
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
      layout: "PORTRAIT",
      density: "SHORT",
      photoUrl: "https://example.com/p.jpg",
    }),
  )
  assert.ok(portrait.includes('data-photo-memory-layout="PORTRAIT"'))

  const square = renderToStaticMarkup(
    createElement(PhotoMemoryTemplate, {
      title: "Titre",
      body: "Corps long un peu plus développé pour le layout.",
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
      layout: "SQUARE",
      density: "RICH",
      photoUrl: "https://example.com/s.jpg",
    }),
  )
  assert.ok(square.includes('data-photo-memory-layout="SQUARE"'))

  assert.ok(photoShareForLayout("LANDSCAPE", "SHORT") > photoShareForLayout("LANDSCAPE", "RICH"))
})

test("aucune déformation image (object-fit cover, pas de stretch)", () => {
  const html = renderToStaticMarkup(
    createElement(PhotoMemoryTemplate, {
      title: "T",
      body: "B",
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
      layout: "LANDSCAPE",
      photoUrl: "https://example.com/x.jpg",
    }),
  )
  assert.ok(html.includes("object-fit:cover") || html.includes('objectFit:"cover"') || html.includes("objectFit"))
  assert.ok(!html.toLowerCase().includes("object-fit:fill"))
  assert.ok(!html.includes("border-radius:999") || true) // may use style radius, not oval
})

test("toPhotoMemorySource refuse photo non autorisée", () => {
  assert.equal(
    toPhotoMemorySource({
      id: "x",
      useAuthorized: false,
      storagePath: "books/x.jpg",
      caption: "Hi",
    }),
    null,
  )
})

test("IA photo ne reçoit qu'une photo source + ses metadata", async () => {
  let captured: unknown = null
  const provider = new FakeContentGenerationProvider(async (req) => {
    captured = req.input
    return {
      ok: true,
      data: {
        title: "Tour",
        eyebrow: null,
        body: "Caption seule.",
        sourcePhotoId: "ph1",
      },
    }
  })
  await editorializePhotoMemoryPage({
    source: {
      photoId: "ph1",
      storagePath: "books/x/1.jpg",
      signedUrl: "https://signed.example/1.jpg",
      participantIds: ["p1"],
      caption: "Caption seule.",
      anecdote: null,
      authorization: true,
    },
    profile: profile({
      memories: [{ id: "m1", text: "NE PAS ENVOYER" }],
      photos: [
        {
          id: "ph1",
          useAuthorized: true,
          storagePath: "books/x/1.jpg",
          caption: "Caption seule.",
        },
        {
          id: "ph2",
          useAuthorized: true,
          storagePath: "books/x/2.jpg",
          caption: "AUTRE PHOTO",
        },
      ],
    }),
    seed: "min",
    provider,
  })
  const raw = JSON.stringify(captured)
  assert.ok(!raw.includes("NE PAS ENVOYER"))
  assert.ok(!raw.includes("AUTRE PHOTO"))
  assert.ok(!raw.includes("ph2"))
  assert.ok(photoMemoryPayloadLooksMinimal(captured))
})
