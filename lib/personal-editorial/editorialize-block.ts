import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { ContentGenerationProvider, JsonSchemaObject } from "@/lib/content-generation/types"
import { createDefaultContentGenerationProvider } from "@/lib/content-generation/provider"
import {
  classifyMemoryDensity,
  recommendFullMemoryPage,
} from "@/lib/memory-pages/density"
import {
  classifyPhotoMemoryDensity,
  classifyPhotoMemoryLayout,
  photoMemoryCombinedText,
  recommendFullPhotoMemoryPage,
} from "@/lib/memory-pages/photo-layout"
import { toMemoryPageSource } from "@/lib/memory-pages/select-memory"
import { toPhotoMemorySource } from "@/lib/memory-pages/select-photo"
import {
  buildPersonalEditorialAudienceContext,
  type PersonalEditorialAudienceContext,
} from "./audience-context"
import { extractPersonalSourceFacts } from "./facts"
import {
  buildEditorialCopyFromFacts,
  type EditorialCopyFromFacts,
  type EditorialPerspectiveV2,
} from "./editorial-copy"
import { validateEditorialCopy } from "./validate-editorial"
import { assertPhotoBlockIntegrity } from "./provenance"
import type { MemoryBlockV1, PhotoMemoryBlockV1, PersonalBlockV1 } from "./types"

function mapPerspective(
  p: EditorialPerspectiveV2,
): PersonalBlockV1["perspective"] {
  return p
}

function applyCopyToMemory(
  base: Omit<MemoryBlockV1, keyof EditorialCopyFromFacts | "perspective" | "attributedQuote" | "claimsUsed" | "title" | "body" | "displayText" | "kicker" | "shortTitle" | "eyebrow"> & {
    facts: MemoryBlockV1["facts"]
    place?: string | null
  },
  copy: EditorialCopyFromFacts,
  usedAi: boolean,
): MemoryBlockV1 {
  return {
    ...base,
    type: "MEMORY",
    title: copy.shortTitle || base.place || "Moment",
    body: copy.displayText,
    displayText: copy.displayText,
    kicker: copy.kicker,
    shortTitle: copy.shortTitle,
    eyebrow: copy.kicker || base.place || null,
    perspective: mapPerspective(copy.perspective),
    attributedQuote: copy.attributedQuote,
    claimsUsed: copy.claimsUsed,
    usedAi,
  } as MemoryBlockV1
}

const BLOCK_SCHEMA: JsonSchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["sourceId", "kicker", "shortTitle", "displayText", "perspective", "claimsUsed"],
  properties: {
    sourceId: { type: "string", minLength: 1 },
    kicker: { type: ["string", "null"] },
    shortTitle: { type: ["string", "null"] },
    displayText: { type: "string", minLength: 1 },
    perspective: {
      type: "string",
      enum: ["CREATOR_ATTRIBUTED", "RECIPIENT", "SHARED", "NEUTRAL_EDITORIAL"],
    },
    claimsUsed: { type: "array", items: { type: "string" } },
  },
}

function editorialFromSource(input: {
  sourceId: string
  sourceType: "MEMORY" | "PHOTO_MEMORY"
  rawText: string
  place?: string | null
  title?: string | null
  ctx: PersonalEditorialAudienceContext
}): { facts: ReturnType<typeof extractPersonalSourceFacts>; copy: EditorialCopyFromFacts } {
  const facts = extractPersonalSourceFacts({
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    rawText: input.rawText,
    place: input.place,
    title: input.title,
    ctx: input.ctx,
  })
  let copy = buildEditorialCopyFromFacts({ facts, ctx: input.ctx })
  const validation = validateEditorialCopy({
    copy,
    facts,
    recipientNames: input.ctx.recipientNames,
  })
  if (!validation.ok) {
    // Safe repair: attributed quote
    copy = {
      kicker: input.ctx.creatorName || "Souvenir",
      shortTitle: facts.locations[0] || null,
      displayText: facts.quotes[0] || input.rawText,
      perspective: "CREATOR_ATTRIBUTED",
      attributedQuote: true,
      claimsUsed: ["repair-citation"],
    }
  }
  return { facts, copy }
}

export function memoryToBlock(
  memory: BookProfileV1["memories"][number],
  profile: BookProfileV1,
  options?: { ctx?: PersonalEditorialAudienceContext; creatorName?: string | null },
): MemoryBlockV1 | null {
  const source = toMemoryPageSource(memory)
  if (!source) return null
  const ctx =
    options?.ctx ??
    buildPersonalEditorialAudienceContext(profile, {
      creatorName: options?.creatorName,
    })
  const density = classifyMemoryDensity({ source })
  const { facts, copy } = editorialFromSource({
    sourceId: source.memoryId,
    sourceType: "MEMORY",
    rawText: source.originalText,
    place: source.place,
    title: source.title,
    ctx,
  })

  return {
    type: "MEMORY",
    sourceMemoryId: source.memoryId,
    originalText: source.originalText,
    title: copy.shortTitle || source.place || facts.locations[0] || "Moment",
    body: copy.displayText,
    displayText: copy.displayText,
    density,
    participantIds: [...source.participantIds],
    fullPageRecommended: recommendFullMemoryPage({ density }),
    eyebrow: copy.kicker || source.place || null,
    place: source.place?.trim() || facts.locations[0] || null,
    kicker: copy.kicker,
    shortTitle: copy.shortTitle,
    semanticCategory: facts.category,
    semanticTags: facts.semanticTags,
    locations: facts.locations,
    trips: facts.tripContext,
    perspective: mapPerspective(copy.perspective),
    attributedQuote: copy.attributedQuote,
    usedAi: false,
    claimsUsed: copy.claimsUsed,
    facts,
  }
}

export function photoToBlock(
  photo: BookProfileV1["photos"][number],
  profile: BookProfileV1,
  signedUrl: string | null = null,
  aspectRatio?: number,
  options?: { ctx?: PersonalEditorialAudienceContext; creatorName?: string | null },
): PhotoMemoryBlockV1 | null {
  const source = toPhotoMemorySource(photo, signedUrl, aspectRatio)
  if (!source) return null
  const ctx =
    options?.ctx ??
    buildPersonalEditorialAudienceContext(profile, {
      creatorName: options?.creatorName,
    })
  const density = classifyPhotoMemoryDensity(source)
  const combined = photoMemoryCombinedText(source) || ""
  const weak = !combined.trim()

  if (weak) {
    const facts = extractPersonalSourceFacts({
      sourceId: source.photoId,
      sourceType: "PHOTO_MEMORY",
      rawText: "",
      ctx,
    })
    const block: PhotoMemoryBlockV1 = {
      type: "PHOTO_MEMORY",
      sourcePhotoId: source.photoId,
      signedUrl: source.signedUrl,
      caption: source.caption,
      anecdote: source.anecdote,
      originalText: "",
      title: "Photo",
      body: "",
      displayText: "",
      density,
      aspectRatio: source.aspectRatio,
      photoLayout: classifyPhotoMemoryLayout(source.aspectRatio),
      participantIds: [...source.participantIds],
      fullPageRecommended: false,
      weakSource: true,
      eyebrow: null,
      kicker: null,
      shortTitle: null,
      semanticCategory: "OTHER",
      semanticTags: [],
      locations: [],
      trips: [],
      perspective: "NEUTRAL_EDITORIAL",
      attributedQuote: false,
      usedAi: false,
      claimsUsed: [],
      facts,
    }
    assertPhotoBlockIntegrity(block)
    return block
  }

  const { facts, copy } = editorialFromSource({
    sourceId: source.photoId,
    sourceType: "PHOTO_MEMORY",
    rawText: combined,
    title: source.caption,
    ctx,
  })

  const block: PhotoMemoryBlockV1 = {
    type: "PHOTO_MEMORY",
    sourcePhotoId: source.photoId,
    signedUrl: source.signedUrl,
    caption: source.caption,
    anecdote: source.anecdote,
    originalText: combined,
    title: copy.shortTitle || facts.locations[0] || "Photo",
    body: copy.displayText,
    displayText: copy.displayText,
    density,
    aspectRatio: source.aspectRatio,
    photoLayout: classifyPhotoMemoryLayout(source.aspectRatio),
    participantIds: [...source.participantIds],
    fullPageRecommended: recommendFullPhotoMemoryPage({
      source,
      hasRenderablePhoto: Boolean(source.signedUrl),
    }),
    weakSource: false,
    eyebrow: copy.kicker,
    kicker: copy.kicker,
    shortTitle: copy.shortTitle,
    semanticCategory: facts.category,
    semanticTags: facts.semanticTags,
    locations: facts.locations,
    trips: facts.tripContext,
    perspective: mapPerspective(copy.perspective),
    attributedQuote: copy.attributedQuote,
    usedAi: false,
    claimsUsed: copy.claimsUsed,
    facts,
  }
  assertPhotoBlockIntegrity(block)
  return block
}

export function collectPersonalBlocks(input: {
  profile: BookProfileV1
  photoSignedUrls?: Record<string, string>
  aspectRatios?: Record<string, number>
  maxMemories?: number
  maxPhotos?: number
  creatorName?: string | null
}): PersonalBlockV1[] {
  const ctx = buildPersonalEditorialAudienceContext(input.profile, {
    creatorName: input.creatorName,
  })
  const memories = (input.profile.memories ?? []).filter((m) => m.text?.trim())
  const photos = (input.profile.photos ?? []).filter(
    (p) => p.useAuthorized && Boolean(p.storagePath),
  )
  const out: PersonalBlockV1[] = []

  for (const m of memories.slice(0, input.maxMemories ?? memories.length)) {
    const block = memoryToBlock(m, input.profile, { ctx })
    if (block) out.push(block)
  }
  for (const p of photos.slice(0, input.maxPhotos ?? photos.length)) {
    // URL keyed by photo id — never by array index
    const url = input.photoSignedUrls?.[p.id] ?? null
    const ratio = input.aspectRatios?.[p.id]
    const block = photoToBlock(p, input.profile, url, ratio, { ctx })
    if (block) {
      assertPhotoBlockIntegrity(block)
      out.push(block)
    }
  }
  return out
}

/**
 * Optional AI polish — one source only. Fake provider in tests.
 */
export async function polishPersonalBlockWithAi(input: {
  block: PersonalBlockV1
  ctx: PersonalEditorialAudienceContext
  seed: string
  provider?: ContentGenerationProvider
  forceFallback?: boolean
}): Promise<PersonalBlockV1> {
  const base = input.block
  if (input.forceFallback) return base
  if (base.type === "PHOTO_MEMORY" && base.weakSource) return base

  const provider = input.provider ?? createDefaultContentGenerationProvider()
  if (!provider.configured) return base

  const sourceId =
    base.type === "MEMORY" ? base.sourceMemoryId : base.sourcePhotoId

  const payload = {
    sourceId,
    sourceType: base.type,
    originalText: base.originalText,
    facts: {
      sharedFacts: base.facts.sharedFacts,
      creatorOpinions: base.facts.creatorOpinions,
      locations: base.facts.locations,
      tripContext: base.facts.tripContext,
      events: base.facts.events,
    },
    audience: input.ctx.audience,
    creatorName: input.ctx.creatorName,
    recipientNames: input.ctx.recipientNames,
  }

  const system = [
    "Éditorialisez UN fragment pour un cahier imprimé (lecteur = destinataire).",
    "OTHER_PERSON : voix NEUTRAL_EDITORIAL ou CREATOR_ATTRIBUTED.",
    "Interdit : « X et moi », « j'ai » non attribué, mélange votre/nous, récits « vous êtes allé… ».",
    "Les opinions du créateur restent attribuées au créateur.",
    "N'inventez aucun lieu/date/personne/fait. Condenser est autorisé.",
    "sourceId DOIT matcher. claimsUsed = faits utilisés.",
  ].join("\n")

  const raw = await provider.generateStructured<{
    sourceId: string
    kicker: string | null
    shortTitle: string | null
    displayText: string
    perspective: EditorialPerspectiveV2
    claimsUsed: string[]
  }>({
    system,
    input: payload,
    schemaName: "personal_editorial_block_v2",
    schema: BLOCK_SCHEMA,
    seed: input.seed,
  })

  if (!raw.ok) return base
  if (String(raw.data.sourceId ?? "").trim() !== sourceId) return base

  const copy: EditorialCopyFromFacts = {
    kicker: raw.data.kicker,
    shortTitle: raw.data.shortTitle,
    displayText: String(raw.data.displayText ?? "").trim(),
    perspective: raw.data.perspective,
    attributedQuote: raw.data.perspective === "CREATOR_ATTRIBUTED" &&
      /^«|^"/.test(String(raw.data.displayText ?? "")),
    claimsUsed: Array.isArray(raw.data.claimsUsed) ? raw.data.claimsUsed.map(String) : [],
  }
  if (!copy.displayText) return base

  const validation = validateEditorialCopy({
    copy,
    facts: base.facts,
    recipientNames: input.ctx.recipientNames,
  })
  if (!validation.ok) return base

  if (base.type === "MEMORY") {
    return {
      ...base,
      title: copy.shortTitle || base.title,
      body: copy.displayText,
      displayText: copy.displayText,
      kicker: copy.kicker,
      shortTitle: copy.shortTitle,
      perspective: mapPerspective(copy.perspective),
      attributedQuote: copy.attributedQuote,
      claimsUsed: copy.claimsUsed,
      usedAi: true,
    }
  }

  const next: PhotoMemoryBlockV1 = {
    ...base,
    title: copy.shortTitle || base.title,
    body: copy.displayText,
    displayText: copy.displayText,
    kicker: copy.kicker,
    shortTitle: copy.shortTitle,
    perspective: mapPerspective(copy.perspective),
    attributedQuote: copy.attributedQuote,
    claimsUsed: copy.claimsUsed,
    usedAi: true,
    // provenance locked
    sourcePhotoId: base.sourcePhotoId,
    signedUrl: base.signedUrl,
    caption: base.caption,
    anecdote: base.anecdote,
    originalText: base.originalText,
    facts: base.facts,
  }
  assertPhotoBlockIntegrity(next)
  return next
}

export async function collectAndEditorializePersonalBlocks(input: {
  profile: BookProfileV1
  seed: string
  photoSignedUrls?: Record<string, string>
  aspectRatios?: Record<string, number>
  maxMemories?: number
  maxPhotos?: number
  creatorName?: string | null
  forceFallback?: boolean
  provider?: ContentGenerationProvider
}): Promise<PersonalBlockV1[]> {
  const ctx = buildPersonalEditorialAudienceContext(input.profile, {
    creatorName: input.creatorName,
  })
  const blocks = collectPersonalBlocks({
    profile: input.profile,
    photoSignedUrls: input.photoSignedUrls,
    aspectRatios: input.aspectRatios,
    maxMemories: input.maxMemories,
    maxPhotos: input.maxPhotos,
    creatorName: input.creatorName,
  })
  const out: PersonalBlockV1[] = []
  for (let i = 0; i < blocks.length; i++) {
    out.push(
      await polishPersonalBlockWithAi({
        block: blocks[i]!,
        ctx,
        seed: `${input.seed}:block:${i}`,
        provider: input.provider,
        forceFallback: input.forceFallback,
      }),
    )
  }
  return out
}

// silence unused helper
void applyCopyToMemory
