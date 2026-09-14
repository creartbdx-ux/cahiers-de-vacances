import type { AudienceType, BookProfileV1 } from "@/lib/questionnaire/types"
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
import type { PersonalEditorialAudienceContext } from "./audience-context"
import { buildPersonalEditorialAudienceContext } from "./audience-context"
import { classifyPersonalSemantics } from "./semantic"
import {
  hasForbiddenCreatorVoice,
  rewritePerspectiveDeterministic,
  type PersonalFactPerspective,
} from "./perspective"
import type { MemoryBlockV1, PhotoMemoryBlockV1, PersonalBlockV1 } from "./types"

function clampWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(" ")
  return words.slice(0, max).join(" ")
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

const BLOCK_SCHEMA: JsonSchemaObject = {
  type: "object",
  additionalProperties: false,
  required: [
    "sourceId",
    "kicker",
    "shortTitle",
    "displayText",
    "perspective",
  ],
  properties: {
    sourceId: { type: "string", minLength: 1 },
    kicker: { type: ["string", "null"] },
    shortTitle: { type: ["string", "null"] },
    displayText: { type: "string", minLength: 1 },
    perspective: {
      type: "string",
      enum: [
        "CREATOR_PERSPECTIVE_FACT",
        "RECIPIENT_FACT",
        "SHARED_FACT",
      ],
    },
  },
}

function genericTitleBan(title: string): boolean {
  const t = title.trim().toLowerCase()
  const banned = [
    "un moment à garder",
    "un souvenir partagé",
    "un souvenir à garder",
    "voyage portugal",
    "voyage australie",
    "un souvenir",
  ]
  return banned.includes(t)
}

function finalizeTitles(input: {
  shortTitle: string | null
  kicker: string | null
  place?: string | null
  locations: string[]
  attributedQuote: boolean
  creatorName: string | null
}): { title: string; eyebrow: string | null; kicker: string | null } {
  let shortTitle = input.shortTitle?.trim() || null
  if (shortTitle && genericTitleBan(shortTitle)) shortTitle = null
  const title =
    shortTitle ||
    input.locations[0] ||
    input.place?.trim() ||
    (input.attributedQuote ? "Citation" : "Moment")
  const kicker =
    input.kicker?.trim() ||
    (input.attributedQuote ? input.creatorName : null) ||
    null
  const eyebrow = input.place?.trim() || input.locations[0] || null
  return { title, eyebrow, kicker }
}

function applyDeterministicEditorial(input: {
  sourceText: string
  ctx: PersonalEditorialAudienceContext
  place?: string | null
  titleHint?: string | null
}): {
  displayText: string
  shortTitle: string | null
  kicker: string | null
  perspective: PersonalFactPerspective
  attributedQuote: boolean
  semantics: ReturnType<typeof classifyPersonalSemantics>
} {
  const semantics = classifyPersonalSemantics({
    text: input.sourceText,
    place: input.place,
    title: input.titleHint,
  })
  const rewritten = rewritePerspectiveDeterministic({
    sourceText: input.sourceText,
    ctx: input.ctx,
    place: input.place || semantics.locations[0] || null,
  })
  return {
    displayText: rewritten.displayText,
    shortTitle: rewritten.shortTitle || semantics.locations[0] || null,
    kicker: rewritten.kicker,
    perspective: rewritten.perspective,
    attributedQuote: rewritten.attributedQuote,
    semantics,
  }
}

/**
 * Sync editorialization — always runs perspective layer (never raw dump).
 */
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
  const ed = applyDeterministicEditorial({
    sourceText: source.originalText,
    ctx,
    place: source.place,
    titleHint: source.title,
  })
  const titles = finalizeTitles({
    shortTitle: ed.shortTitle,
    kicker: ed.kicker,
    place: source.place,
    locations: ed.semantics.locations,
    attributedQuote: ed.attributedQuote,
    creatorName: ctx.creatorName,
  })

  return {
    type: "MEMORY",
    sourceMemoryId: source.memoryId,
    originalText: source.originalText,
    title: titles.title,
    body: ed.displayText,
    displayText: ed.displayText,
    density,
    participantIds: [...source.participantIds],
    fullPageRecommended: recommendFullMemoryPage({ density }),
    eyebrow: titles.eyebrow,
    place: source.place?.trim() || ed.semantics.locations[0] || null,
    kicker: titles.kicker,
    shortTitle: ed.shortTitle,
    semanticCategory: ed.semantics.category,
    semanticTags: ed.semantics.semanticTags,
    locations: ed.semantics.locations,
    trips: ed.semantics.trips,
    perspective: ed.perspective,
    attributedQuote: ed.attributedQuote,
    usedAi: false,
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
  const ed = weak
    ? {
        displayText: "",
        shortTitle: null as string | null,
        kicker: null as string | null,
        perspective: "SHARED_FACT" as PersonalFactPerspective,
        attributedQuote: false,
        semantics: classifyPersonalSemantics({ text: "" }),
      }
    : applyDeterministicEditorial({
        sourceText: combined,
        ctx,
        place: null,
        titleHint: source.caption,
      })

  const titles = finalizeTitles({
    shortTitle: ed.shortTitle,
    kicker: ed.kicker,
    place: null,
    locations: ed.semantics.locations,
    attributedQuote: ed.attributedQuote,
    creatorName: ctx.creatorName,
  })

  return {
    type: "PHOTO_MEMORY",
    sourcePhotoId: source.photoId,
    signedUrl: source.signedUrl,
    caption: source.caption,
    anecdote: source.anecdote,
    originalText: combined,
    title: weak ? "Photo" : titles.title,
    body: ed.displayText,
    displayText: ed.displayText,
    density,
    aspectRatio: source.aspectRatio,
    photoLayout: classifyPhotoMemoryLayout(source.aspectRatio),
    participantIds: [...source.participantIds],
    fullPageRecommended: recommendFullPhotoMemoryPage({
      source,
      hasRenderablePhoto: Boolean(source.signedUrl),
    }),
    weakSource: weak,
    eyebrow: titles.eyebrow,
    kicker: titles.kicker,
    shortTitle: ed.shortTitle,
    semanticCategory: ed.semantics.category,
    semanticTags: ed.semantics.semanticTags,
    locations: ed.semantics.locations,
    trips: ed.semantics.trips,
    perspective: ed.perspective,
    attributedQuote: ed.attributedQuote,
    usedAi: false,
  }
}

/**
 * Collect blocks with deterministic editorial layer (sync — Blueprint safe).
 */
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
  const memLimit = input.maxMemories ?? memories.length
  const photoLimit = input.maxPhotos ?? photos.length
  const out: PersonalBlockV1[] = []

  for (const m of memories.slice(0, memLimit)) {
    const block = memoryToBlock(m, input.profile, { ctx })
    if (block) out.push(block)
  }
  for (const p of photos.slice(0, photoLimit)) {
    const block = photoToBlock(
      p,
      input.profile,
      input.photoSignedUrls?.[p.id] ?? null,
      input.aspectRatios?.[p.id],
      { ctx },
    )
    if (block) out.push(block)
  }
  return out
}

/**
 * Optional AI polish for a single block — one source only, no cross-memory context.
 * Falls back to deterministic editorial on any failure.
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
    audience: input.ctx.audience,
    creatorIsParticipant: input.ctx.creatorIsParticipant,
    ...(input.ctx.creatorName ? { creatorName: input.ctx.creatorName } : {}),
    recipientNames: input.ctx.recipientNames,
    addressMode: input.ctx.addressMode,
    density: base.density,
    knownPerspective: base.perspective,
  }

  const rawGuard = JSON.stringify(payload).toLowerCase()
  if (
    rawGuard.includes("personalfacts") ||
    rawGuard.includes("memories") ||
    rawGuard.includes("email")
  ) {
    return base
  }

  const system = [
    "Vous éditorialisez UN seul fragment pour un cahier imprimé.",
    "Vous recevez UNIQUEMENT cette source + le contexte d'audience.",
    "",
    "Mission : adapter la perspective du lecteur, condensé, naturel.",
    "Pour OTHER_PERSON : le destinataire lit le cahier — pas la voix questionnaire du créateur.",
    "Interdit : « Sami et moi… », « J'ai adoré… » non attribué, ton documentaire « Vous êtes allé… » répété.",
    "Si une opinion appartient au créateur, elle reste attribuée au créateur.",
    "Ne jamais transformer l'opinion d'Emma en opinion de Sami.",
    "",
    "INTERDIT : inventer lieu/date/personne/émotion ; enrichir factuellement ; fusionner d'autres souvenirs.",
    "Titres génériques interdits : « Un moment à garder », « Un souvenir partagé ».",
    "perspective doit être CREATOR_PERSPECTIVE_FACT | RECIPIENT_FACT | SHARED_FACT.",
    "sourceId DOIT être exactement celui fourni.",
    "Répondez uniquement via le schéma JSON.",
  ].join("\n")

  const raw = await provider.generateStructured<{
    sourceId: string
    kicker: string | null
    shortTitle: string | null
    displayText: string
    perspective: PersonalFactPerspective
  }>({
    system,
    input: payload,
    schemaName: "personal_editorial_block_v1",
    schema: BLOCK_SCHEMA,
    seed: input.seed,
  })

  if (!raw.ok) return base

  const displayText = clampWords(String(raw.data.displayText ?? "").trim(), 120)
  if (!displayText) return base
  if (String(raw.data.sourceId ?? "").trim() !== sourceId) return base
  if (hasForbiddenCreatorVoice(displayText, input.ctx)) return base
  if (wordCount(displayText) > wordCount(base.originalText) * 1.4 + 12) return base

  const perspective = (raw.data.perspective || base.perspective) as PersonalFactPerspective
  // Never allow flipping creator opinion to recipient
  if (
    base.perspective === "CREATOR_PERSPECTIVE_FACT" &&
    perspective === "RECIPIENT_FACT"
  ) {
    return base
  }

  const shortTitle = raw.data.shortTitle?.trim() || base.shortTitle || null
  const kicker = raw.data.kicker?.trim() || base.kicker || null
  const titles = finalizeTitles({
    shortTitle,
    kicker,
    place: base.type === "MEMORY" ? base.place : null,
    locations: base.locations,
    attributedQuote: false,
    creatorName: input.ctx.creatorName,
  })

  if (base.type === "MEMORY") {
    return {
      ...base,
      title: titles.title,
      body: displayText,
      displayText,
      eyebrow: titles.eyebrow,
      kicker: titles.kicker,
      shortTitle,
      perspective,
      attributedQuote: false,
      usedAi: true,
    }
  }

  return {
    ...base,
    title: titles.title,
    body: displayText,
    displayText,
    eyebrow: titles.eyebrow,
    kicker: titles.kicker,
    shortTitle,
    perspective,
    attributedQuote: false,
    usedAi: true,
  }
}

/**
 * Async pipeline: collect + optional AI polish per block.
 */
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
    const polished = await polishPersonalBlockWithAi({
      block: blocks[i]!,
      ctx,
      seed: `${input.seed}:block:${i}`,
      provider: input.provider,
      forceFallback: input.forceFallback,
    })
    out.push(polished)
  }
  return out
}
