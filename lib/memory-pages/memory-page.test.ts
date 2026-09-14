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
import {
  buildMemoryPage,
  editorializeMemoryPage,
  memoryPayloadLooksMinimal,
  selectDistinctMemories,
  selectMemoryForPage,
  toMemoryPageSource,
  MEMORY_PAGE_FALLBACK_TITLE,
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

test("MEMORY_PAGE utilise uniquement un memory existant", async () => {
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

  const source = toMemoryPageSource(profile().memories[0]!, profile())!
  await editorializeMemoryPage({
    source,
    profile: profile({
      personalFacts: [
        { id: "secret", category: "HABIT", value: "SECRET_FACT_XYZ" },
      ],
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

test("photo optionnelle — zéro photo => TEXT_ONLY complet", async () => {
  const result = await buildMemoryPage({
    profile: profile({ photos: [] }),
    seed: "nophoto",
    memoryId: "m1",
    forceFallback: true,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.variant, "TEXT_ONLY")
  assert.equal(result.photo, null)
  assert.ok(result.editorial.body.length > 10)
  assert.ok(result.editorial.title.length > 0)
})

test("photo disponible => variante PHOTO", async () => {
  const p = profile({
    photos: [
      {
        id: "ph1",
        useAuthorized: true,
        storagePath: "books/x/ph1.jpg",
        participantIds: ["p1"],
        caption: "Le phare",
      },
    ],
  })
  const result = await buildMemoryPage({
    profile: p,
    seed: "photo",
    memoryId: "m1",
    forceFallback: true,
    photoSignedUrls: { ph1: "https://signed.example/ph1.jpg" },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.editorial.variant, "PHOTO")
  assert.equal(result.photo?.photoId, "ph1")
  assert.equal(result.photo?.signedUrl, "https://signed.example/ph1.jpg")
  assert.deepEqual(result.editorial.sourcePhotoIds, ["ph1"])
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

test("MemoryTemplate rend PHOTO", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryTemplate, {
      title: "La plage",
      body: "Un beau souvenir.",
      style: getStyleTokens("RETRO"),
      palette: PALETTE,
      visualRole: "SECONDARY",
      variant: "PHOTO",
      photoUrl: "https://example.com/p.jpg",
      place: "Belle-Île",
    }),
  )
  assert.ok(html.includes("https://example.com/p.jpg"))
  assert.ok(html.includes("La plage"))
  assert.ok(!html.toLowerCase().includes("manquant"))
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
    }),
  )
  assert.ok(html.includes("SOUVENIR"))
  assert.ok(html.includes("Un souvenir à garder"))
  assert.ok(!html.includes("<img"))
  assert.ok(!html.toLowerCase().includes("manquant"))
})

test("aucune correction générée — correctionRequired false", () => {
  const arch = getArchetype("MEMORY_TEXT_PAGE")
  assert.equal(arch.correctionRequired, false)
  assert.equal(arch.correctionWeight, 0)
  assert.equal(arch.implementationStatus, "READY")
})

test("Blueprint MEMORY_TEXT_PAGE READY ; PHOTO_MEMORY_PAGE PARTIAL", () => {
  assert.equal(getArchetype("MEMORY_TEXT_PAGE").implementationStatus, "READY")
  assert.equal(getArchetype("PHOTO_MEMORY_PAGE").implementationStatus, "PARTIAL")

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
        { id: "ph1", useAuthorized: true },
        { id: "ph2", useAuthorized: true },
        { id: "ph3", useAuthorized: true },
      ],
      personalFacts: [
        { id: "f1", category: "FOOD", value: "A" },
        { id: "f2", category: "MUSIC", value: "B" },
        { id: "f3", category: "PLACE", value: "C" },
      ],
      sharedProfile: { interestUniverseIds: ["BEAUTY", "TRAVEL", "FASHION", "NATURE"] },
    }),
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

  const memoryPages = bp.pages.filter((p) => p.archetypeId === "MEMORY_TEXT_PAGE")
  assert.ok(memoryPages.length >= 1)
  assert.ok(memoryPages.every((p) => p.implementationStatus === "READY"))

  const photoPages = bp.pages.filter((p) => p.archetypeId === "PHOTO_MEMORY_PAGE")
  assert.ok(photoPages.every((p) => p.implementationStatus === "PARTIAL"))

  const memoryGap = bp.capabilityGaps.find((g) => g.family === "MEMORY")
  assert.equal(memoryGap, undefined, "MEMORY READY => plus de gap MEMORY")

  const photoGap = bp.capabilityGaps.find((g) => g.family === "PHOTO")
  assert.ok(photoGap && photoGap.gap > 0, "PHOTO encore PARTIAL => gap PHOTO")
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
