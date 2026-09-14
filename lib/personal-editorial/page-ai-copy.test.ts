import assert from "node:assert/strict"
import { test } from "node:test"
import { FakeContentGenerationProvider, UnconfiguredProvider } from "@/lib/content-generation/provider"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import { composePersonalEditorialWithAi } from "./pipeline"
import { composePersonalEditorialPages } from "./compose"
import { collectPersonalBlocks } from "./editorialize-block"
import { editorializePersonalEditorialPage } from "./page-ai-copy"
import { buildPersonalEditorialAudienceContext } from "./audience-context"

function profile(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return {
    schemaVersion: 1,
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    participants: [{ id: "sami", firstName: "Sami" }],
    sharedProfile: { interestUniverseIds: ["TRAVEL"] },
    individualProfiles: [],
    personalFacts: [
      { id: "f1", category: "FOOD", value: "A" },
      { id: "f2", category: "MUSIC", value: "B" },
      { id: "f3", category: "PLACE", value: "C" },
    ],
    memories: [
      {
        id: "wh",
        text: "Sami et moi lors de notre voyage en Australie, sur la plage de Whitehaven Beach. J'ai adoré cette plage, c'est mon moment préféré de notre voyage.",
      },
      {
        id: "sydney-mem",
        text: "Tout en haut de la Sydney Tower Eye. C'était notre dernier jour en Australie.",
      },
    ],
    insideJokes: [],
    gamePreferences: { likedTypes: ["QUIZ"], difficulty: 3 },
    visualPreferences: { paletteId: "PINK", styleId: "RETRO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [
      {
        id: "sydney",
        useAuthorized: true,
        storagePath: "s.jpg",
        caption: "Sydney Tower Eye.",
        anecdote: "C'était notre dernier jour en Australie.",
      },
      {
        id: "wh-photo",
        useAuthorized: true,
        storagePath: "w.jpg",
        caption: "Whitehaven Beach.",
        anecdote: "J'ai adoré cette plage.",
      },
    ],
    ...over,
  }
}

test("provider absent => FALLBACK explicite", async () => {
  const result = await composePersonalEditorialWithAi({
    profile: profile(),
    seed: "no-ai",
    creatorName: "Emma",
    provider: new UnconfiguredProvider(),
  })
  assert.equal(result.aiConfigured, false)
  assert.equal(result.overallMode, "FALLBACK")
  assert.equal(result.aiCallCount, 0)
  assert.equal(result.fallbackBanner, true)
  assert.ok(result.pages.every((p) => p.editorialMode === "FALLBACK"))
})

test("provider configuré => mode AI used ; 1 appel par page max sans repair", async () => {
  let calls = 0
  const provider = new FakeContentGenerationProvider(async (req) => {
    calls += 1
    const payload = req.input as {
      requiredSourceIds?: string[]
      pageContext?: { sources: Array<{ sourceId: string }> }
    }
    const ids =
      payload.requiredSourceIds ??
      payload.pageContext?.sources.map((s) => s.sourceId) ??
      []
    return {
      ok: true,
      data: {
        pageTitle: "En Australie",
        pageKicker: null,
        pageIntro: null,
        blocks: ids.map((sourceId) => {
          const isWh = /wh/i.test(sourceId)
          return {
            sourceId,
            kicker: null,
            title: isWh ? "Whitehaven Beach" : "Sydney",
            text: isWh
              ? "Le coup de cœur d'Emma."
              : "Un dernier souvenir, tout en haut de la Sydney Tower Eye.",
          }
        }),
      },
    }
  })

  const result = await composePersonalEditorialWithAi({
    profile: profile(),
    seed: "with-ai",
    creatorName: "Emma",
    provider,
  })

  assert.equal(result.aiConfigured, true)
  assert.ok(
    result.overallMode === "AI" || result.overallMode === "MIXED",
    result.overallMode,
  )
  assert.ok(result.aiCallCount >= result.pageCount)
  assert.ok(calls >= result.pageCount)
  assert.ok(result.pages.some((p) => p.editorialMode === "AI"))

  for (const page of result.pages) {
    if (page.editorialMode !== "AI") continue
    for (const b of page.blocks) {
      assert.ok(!/Sami et moi/i.test(b.displayText))
      assert.equal(b.usedAi, true)
      if (b.type === "PHOTO_MEMORY") {
        assert.equal(b.facts.sourceId, b.sourcePhotoId)
      }
    }
  }

  const wh = result.pages
    .flatMap((p) => p.blocks)
    .find(
      (b) =>
        b.usedAi &&
        b.originalText.toLowerCase().includes("whitehaven") &&
        /ador/i.test(b.originalText),
    )
  if (wh) {
    assert.match(wh.displayText, /emma/i)
    assert.ok(!/votre moment préfér/i.test(wh.displayText))
  }
})

test("réponse IA ne peut pas ajouter de source", async () => {
  const blocks = collectPersonalBlocks({
    profile: profile(),
    creatorName: "Emma",
  })
  const packed = composePersonalEditorialPages(blocks, "extra-src")
  const page = packed[0]!
  const expected = page.blocks.map((b) =>
    b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId,
  )

  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: {
      pageTitle: "Test",
      pageKicker: null,
      pageIntro: null,
      blocks: [
        ...expected.map((sourceId) => ({
          sourceId,
          kicker: null,
          title: "T",
          text: "Texte neutre supporté.",
        })),
        {
          sourceId: "invented-source",
          kicker: null,
          title: "Hack",
          text: "Ne doit pas passer.",
        },
      ],
    },
  }))

  const ctx = buildPersonalEditorialAudienceContext(profile(), {
    creatorName: "Emma",
  })
  const result = await editorializePersonalEditorialPage({
    page,
    ctx,
    seed: "extra",
    provider,
  })
  // Extra source => validation fail => fallback after repair attempt
  assert.equal(result.mode, "FALLBACK")
  assert.ok(result.usedRepair)
  assert.ok(!result.page.blocks.some((b) => (b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId) === "invented-source"))
})

test("invention lieu rejetée puis fallback", async () => {
  const blocks = collectPersonalBlocks({
    profile: profile({
      memories: [{ id: "m1", text: "Petite balade sans lieu célèbre." }],
      photos: [],
    }),
    creatorName: "Emma",
  })
  const packed = composePersonalEditorialPages(blocks, "invent-place")
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: {
      pageTitle: "À Tokyo",
      pageKicker: null,
      pageIntro: null,
      blocks: [
        {
          sourceId: "m1",
          kicker: null,
          title: "Tokyo",
          text: "Un séjour inventé à Tokyo.",
        },
      ],
    },
  }))
  const ctx = buildPersonalEditorialAudienceContext(profile(), { creatorName: "Emma" })
  const result = await editorializePersonalEditorialPage({
    page: packed[0]!,
    ctx,
    seed: "tokyo-fake",
    provider,
  })
  assert.equal(result.mode, "FALLBACK")
  assert.ok(!/tokyo/i.test(result.page.blocks[0]!.displayText))
})

test("Régénérer rédaction ne change pas packing", async () => {
  let calls = 0
  const provider = new FakeContentGenerationProvider(async (req) => {
    calls += 1
    const payload = req.input as { requiredSourceIds?: string[] }
    const ids = payload.requiredSourceIds ?? []
    return {
      ok: true,
      data: {
        pageTitle: `Titre ${calls}`,
        pageKicker: null,
        pageIntro: null,
        blocks: ids.map((sourceId) => ({
          sourceId,
          kicker: null,
          title: null,
          text: `Version ${calls} pour ${sourceId}.`,
        })),
      },
    }
  })

  const first = await composePersonalEditorialWithAi({
    profile: profile(),
    seed: "pack-stable",
    creatorName: "Emma",
    provider,
  })
  const packingIds = first.packedPages.map((p) =>
    p.blocks.map((b) => (b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId)).join(","),
  )

  const second = await composePersonalEditorialWithAi({
    profile: profile(),
    seed: "pack-stable-regen",
    creatorName: "Emma",
    provider,
    packedPages: first.packedPages,
  })
  const packingIds2 = second.packedPages.map((p) =>
    p.blocks.map((b) => (b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId)).join(","),
  )
  assert.deepEqual(packingIds, packingIds2)
  assert.equal(second.pageCount, first.pageCount)
})

test("sourceIds imposés préservés après AI", async () => {
  const provider = new FakeContentGenerationProvider(async (req) => {
    const payload = req.input as { requiredSourceIds: string[] }
    return {
      ok: true,
      data: {
        pageTitle: "Quelques moments",
        pageKicker: null,
        pageIntro: null,
        blocks: payload.requiredSourceIds.map((sourceId) => ({
          sourceId,
          kicker: null,
          title: "Repère",
          text: "Un fragment éditorial.",
        })),
      },
    }
  })
  const result = await composePersonalEditorialWithAi({
    profile: profile(),
    seed: "ids",
    creatorName: "Emma",
    provider,
  })
  const before = new Set(
    result.packedPages.flatMap((p) =>
      p.blocks.map((b) => (b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId)),
    ),
  )
  const after = new Set(
    result.pages.flatMap((p) =>
      p.blocks.map((b) => (b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId)),
    ),
  )
  assert.deepEqual([...before].sort(), [...after].sort())
})
