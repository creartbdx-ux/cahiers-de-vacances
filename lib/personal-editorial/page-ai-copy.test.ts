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
    creator: {
      firstName: "Emma",
      isParticipant: false,
      participantId: null,
    },
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

test("PERSONAL_EDITORIAL reçoit creatorName depuis profile.creator", async () => {
  const result = await composePersonalEditorialWithAi({
    profile: profile(),
    seed: "profile-creator",
    provider: new UnconfiguredProvider(),
    // pas de creatorName injecté — doit venir du BookProfile
  })
  assert.equal(result.aiConfigured, false)
  assert.equal(result.overallMode, "FALLBACK")

  const ctx = buildPersonalEditorialAudienceContext(profile())
  assert.equal(ctx.creatorName, "Emma")
  assert.equal(ctx.creatorParticipantId, null)

  const blocks = collectPersonalBlocks({ profile: profile() })
  const opinionBlock = blocks.find((b) =>
    b.originalText.toLowerCase().includes("whitehaven"),
  )
  assert.ok(opinionBlock)
  assert.ok(opinionBlock!.facts.creatorOpinions.some((o) => /Emma/i.test(o)))
  assert.ok(!/créateur|personne qui/i.test(opinionBlock!.displayText))
})

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

async function rejectBadCopy(opts: {
  memoryText: string
  memoryId?: string
  pageTitle: string
  pageIntro?: string | null
  title: string | null
  text: string
  seed: string
}): Promise<Awaited<ReturnType<typeof editorializePersonalEditorialPage>>> {
  const blocks = collectPersonalBlocks({
    profile: profile({
      memories: [{ id: opts.memoryId ?? "m1", text: opts.memoryText }],
      photos: [],
    }),
    creatorName: "Emma",
  })
  const packed = composePersonalEditorialPages(blocks, opts.seed)
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: {
      pageTitle: opts.pageTitle,
      pageKicker: null,
      pageIntro: opts.pageIntro ?? null,
      blocks: [
        {
          sourceId: opts.memoryId ?? "m1",
          kicker: null,
          title: opts.title,
          text: opts.text,
        },
      ],
    },
  }))
  const ctx = buildPersonalEditorialAudienceContext(profile(), {
    creatorName: "Emma",
  })
  return editorializePersonalEditorialPage({
    page: packed[0]!,
    ctx,
    seed: opts.seed,
    provider,
  })
}

test("rejette poésie générique non supportée", async () => {
  const result = await rejectBadCopy({
    memoryText: "Petite balade en ville.",
    pageTitle: "En ville",
    title: null,
    text: "Un instant précieux gravé dans votre mémoire.",
    seed: "poetry",
  })
  assert.equal(result.mode, "FALLBACK")
  assert.ok(result.usedRepair)
  assert.ok(
    result.unsupportedClaims.some((c) => /poesie|instant|memoire/i.test(c)),
    result.unsupportedClaims.join("|"),
  )
})

test("rejette opinion réattribuée au destinataire", async () => {
  const result = await rejectBadCopy({
    memoryText:
      "Sami et moi sur Whitehaven Beach. J'ai adoré cette plage, c'est mon moment préféré.",
    pageTitle: "Whitehaven Beach",
    title: "Whitehaven Beach",
    text: "Votre plage préférée.",
    seed: "opinion-flip",
  })
  assert.equal(result.mode, "FALLBACK")
  assert.ok(
    result.unsupportedClaims.some((c) => /préférence|reattribu/i.test(c)) ||
      result.validationReasons.some((r) => /opinion-reattribuee/i.test(r)),
  )
})

test("rejette savoir général onsen", async () => {
  const result = await rejectBadCopy({
    memoryText: "Nous avons testé un onsen au Japon.",
    pageTitle: "Au Japon",
    title: "L'expérience du onsen",
    text: "Un spa traditionnel où l'on se baigne nu.",
    seed: "onsen-knowledge",
  })
  assert.equal(result.mode, "FALLBACK")
  assert.ok(
    result.unsupportedClaims.some((c) => /enrichissement|spa|nu/i.test(c)),
    result.unsupportedClaims.join("|"),
  )
})

test("rejette adjectif inventé restaurant réputé", async () => {
  const result = await rejectBadCopy({
    memoryText: "On va souvent au restaurant Penha au Portugal.",
    pageTitle: "Portugal",
    title: "Penha",
    text: "Un restaurant portugais réputé pour sa cuisine savoureuse.",
    seed: "portugal-adj",
  })
  assert.equal(result.mode, "FALLBACK")
  assert.ok(
    result.unsupportedClaims.some((c) => /repute|savoureux|enrichissement/i.test(c)),
    result.unsupportedClaims.join("|"),
  )
})

test("rejette creator générique alors que creatorName=Emma", async () => {
  const result = await rejectBadCopy({
    memoryText:
      "Whitehaven Beach. J'ai adoré cette plage, c'est mon moment préféré de notre voyage.",
    pageTitle: "Whitehaven Beach",
    title: "Whitehaven Beach",
    text: "Pour la personne qui a créé ce souvenir, cette plage reste le moment préféré du séjour.",
    seed: "creator-generic",
  })
  assert.equal(result.mode, "FALLBACK")
  assert.ok(
    result.unsupportedClaims.some((c) => /creator-generique/i.test(c)),
    result.unsupportedClaims.join("|"),
  )
})

test("rejette intro inutile / poétique", async () => {
  const result = await rejectBadCopy({
    memoryText: "Premier baiser à Eysines.",
    pageTitle: "Souvenirs en suspens",
    pageIntro:
      "Deux instants précieux, chacun avec sa date, son décor et sa place particulière dans la mémoire.",
    title: "Le premier baiser",
    text: "Votre premier baiser, à Eysines.",
    seed: "useless-intro",
  })
  assert.equal(result.mode, "FALLBACK")
  assert.ok(
    result.validationReasons.some((r) =>
      /intro|titre-abstrait/i.test(r),
    ) ||
      result.unsupportedClaims.some((c) => /intro|abstrait|poesie/i.test(c)),
    [...result.validationReasons, ...result.unsupportedClaims].join("|"),
  )
})

test("accepte copy Emma→Sami courte et attribuée", async () => {
  const blocks = collectPersonalBlocks({
    profile: profile({
      memories: [
        {
          id: "wh",
          text: "Sami et moi lors de notre voyage en Australie, sur la plage de Whitehaven Beach. J'ai adoré cette plage, c'est mon moment préféré de notre voyage.",
        },
      ],
      photos: [],
    }),
    creatorName: "Emma",
  })
  const packed = composePersonalEditorialPages(blocks, "good-emma")
  const provider = new FakeContentGenerationProvider(async () => ({
    ok: true,
    data: {
      pageTitle: "Whitehaven Beach",
      pageKicker: null,
      pageIntro: null,
      blocks: [
        {
          sourceId: "wh",
          kicker: null,
          title: "Whitehaven Beach",
          text: "Le moment préféré d'Emma pendant votre voyage en Australie.",
        },
      ],
    },
  }))
  const ctx = buildPersonalEditorialAudienceContext(profile(), {
    creatorName: "Emma",
  })
  const result = await editorializePersonalEditorialPage({
    page: packed[0]!,
    ctx,
    seed: "good-emma",
    provider,
  })
  assert.equal(result.mode, "AI")
  assert.equal(result.page.blocks[0]!.displayText, "Le moment préféré d'Emma pendant votre voyage en Australie.")
  assert.deepEqual(result.unsupportedClaims, [])
})
