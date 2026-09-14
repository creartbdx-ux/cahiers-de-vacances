import type { AudienceType, BookProfileV1 } from "@/lib/questionnaire/types"
import type { ContentGenerationProvider, JsonSchemaObject } from "@/lib/content-generation/types"
import { createDefaultContentGenerationProvider } from "@/lib/content-generation/provider"
import type {
  MemoryDensity,
  PhotoMemoryEditorial,
  PhotoMemoryLayout,
  PhotoMemorySourceV1,
} from "./types"
import { PHOTO_MEMORY_FALLBACK_TITLE } from "./types"
import {
  classifyPhotoMemoryDensity,
  classifyPhotoMemoryLayout,
  maxPhotoMemoryBodyWords,
  photoMemoryCombinedText,
  photoMemoryHasText,
  recommendFullPhotoMemoryPage,
} from "./photo-layout"
import { validatePhotoMemoryEditorial } from "./validate-photo"

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function clampBody(text: string, maxWords: number): string {
  if (maxWords <= 0) return ""
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(" ")
  return words.slice(0, maxWords).join(" ")
}

function participantFirstNames(
  profile: BookProfileV1,
  participantIds: string[],
): string[] {
  const byId = new Map(profile.participants.map((p) => [p.id, p.firstName.trim()]))
  return participantIds
    .map((id) => byId.get(id))
    .filter((n): n is string => Boolean(n))
}

/** Caption short enough to serve as title without cutting mid-sentence awkwardly. */
function captionAsTitle(caption: string | null): string | null {
  const c = caption?.trim()
  if (!c) return null
  const words = c.split(/\s+/).filter(Boolean)
  if (words.length <= 8) return c
  return null
}

function fallbackPhotoEditorial(input: {
  source: PhotoMemorySourceV1
  audience: AudienceType
  density: MemoryDensity
  layout: PhotoMemoryLayout
  fullPageRecommended: boolean
}): PhotoMemoryEditorial {
  const combined = photoMemoryCombinedText(input.source)
  const weak = !photoMemoryHasText(input.source)
  const maxWords = maxPhotoMemoryBodyWords(combined, input.density)
  return {
    title: captionAsTitle(input.source.caption) || PHOTO_MEMORY_FALLBACK_TITLE,
    eyebrow: null,
    body: weak ? "" : clampBody(combined, maxWords),
    sourcePhotoId: input.source.photoId,
    density: input.density,
    layout: input.layout,
    fullPageRecommended: input.fullPageRecommended,
    usedAi: false,
    audience: input.audience,
    weakSource: weak,
  }
}

const PHOTO_MEMORY_SCHEMA: JsonSchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["title", "eyebrow", "body", "sourcePhotoId"],
  properties: {
    title: { type: "string", minLength: 1 },
    eyebrow: { type: ["string", "null"] },
    body: { type: "string" },
    sourcePhotoId: { type: "string", minLength: 1 },
  },
}

/**
 * Editorial for PHOTO_MEMORY_PAGE from photo caption + anecdote only.
 * No memory attachment. No vision / image description.
 */
export async function editorializePhotoMemoryPage(input: {
  source: PhotoMemorySourceV1
  profile: BookProfileV1
  seed: string
  provider?: ContentGenerationProvider
  forceFallback?: boolean
}): Promise<PhotoMemoryEditorial> {
  const audience = input.profile.audience
  const density = classifyPhotoMemoryDensity(input.source)
  const layout = classifyPhotoMemoryLayout(input.source.aspectRatio)
  const hasRenderablePhoto = Boolean(input.source.signedUrl)
  const fullPageRecommended = recommendFullPhotoMemoryPage({
    source: input.source,
    hasRenderablePhoto,
  })
  const combined = photoMemoryCombinedText(input.source)
  const maxWords = maxPhotoMemoryBodyWords(combined, density)
  const sourceWords = wordCount(combined)

  const base = fallbackPhotoEditorial({
    source: input.source,
    audience,
    density,
    layout,
    fullPageRecommended,
  })

  // Weak source: never invent; never call AI.
  if (base.weakSource) return base
  if (input.forceFallback) return base

  const provider = input.provider ?? createDefaultContentGenerationProvider()
  if (!provider.configured) return base

  const names = participantFirstNames(input.profile, input.source.participantIds)
  const payload = {
    sourcePhotoId: input.source.photoId,
    ...(input.source.caption ? { caption: input.source.caption } : {}),
    ...(input.source.anecdote ? { anecdote: input.source.anecdote } : {}),
    ...(names.length ? { participantFirstNames: names } : {}),
    density,
    audience,
  }

  const rawGuard = JSON.stringify(payload).toLowerCase()
  if (
    rawGuard.includes("personalfacts") ||
    rawGuard.includes("insidejokes") ||
    rawGuard.includes("user_id") ||
    rawGuard.includes("email") ||
    rawGuard.includes("storage_path") ||
    rawGuard.includes("sourcememoryid")
  ) {
    return base
  }

  const system = [
    "Vous éditorialisez une page PHOTO à partir des métadonnées SAISIES par l'utilisateur.",
    "Vous recevez UNIQUEMENT : légende (caption), anecdote, prénoms éventuels.",
    "Vous ne voyez PAS l'image. Ne décrivez jamais le contenu visuel de la photo.",
    "",
    "Caption = ce que représente la photo / le contexte.",
    "Anecdote = petite histoire liée à CETTE photo.",
    "",
    "Autorisé :",
    "- proposer un titre naturel en français à partir de caption/anecdote",
    "- proposer une eyebrow courte si un élément est déjà présent (ex. lieu nommé dans la légende)",
    "- fusionner proprement caption + anecdote",
    "- fluidifier légèrement sans allonger",
    "",
    "INTERDIT :",
    "- inventer un lieu, une date, une émotion, un événement",
    "- déduire ce qui se passe sur l'image",
    "- utiliser d'autres souvenirs, d'autres photos, ou le BookProfile",
    "- inventer des faits absents de caption/anecdote",
    "",
    `Audience : ${audience}.`,
    `Densité ${density} — body max ${maxWords} mots (source ${sourceWords} mots).`,
    "sourcePhotoId dans la réponse DOIT être exactement celui fourni.",
    "Répondez uniquement via le schéma JSON.",
  ].join("\n")

  const raw = await provider.generateStructured<{
    title: string
    eyebrow: string | null
    body: string
    sourcePhotoId: string
  }>({
    system,
    input: payload,
    schemaName: "photo_memory_page_v1",
    schema: PHOTO_MEMORY_SCHEMA,
    seed: input.seed,
  })

  if (!raw.ok) return base

  const draft: PhotoMemoryEditorial = {
    title: String(raw.data.title ?? "").trim() || base.title,
    eyebrow:
      raw.data.eyebrow === null || raw.data.eyebrow === undefined
        ? null
        : String(raw.data.eyebrow).trim() || null,
    body: clampBody(String(raw.data.body ?? "").trim() || base.body, maxWords),
    sourcePhotoId: String(raw.data.sourcePhotoId ?? "").trim(),
    density,
    layout,
    fullPageRecommended,
    usedAi: true,
    audience,
    weakSource: false,
  }

  if (wordCount(draft.body) > maxWords) return base
  if (density === "SHORT" && sourceWords > 0 && wordCount(draft.body) > sourceWords * 1.5 + 6) {
    return base
  }

  const validation = validatePhotoMemoryEditorial({
    editorial: draft,
    source: input.source,
    profile: input.profile,
  })
  if (!validation.ok) return base

  return draft
}

export function editorializePhotoMemoryPageFallback(input: {
  source: PhotoMemorySourceV1
  audience: AudienceType
}): PhotoMemoryEditorial {
  const density = classifyPhotoMemoryDensity(input.source)
  const layout = classifyPhotoMemoryLayout(input.source.aspectRatio)
  return fallbackPhotoEditorial({
    source: input.source,
    audience: input.audience,
    density,
    layout,
    fullPageRecommended: recommendFullPhotoMemoryPage({
      source: input.source,
      hasRenderablePhoto: Boolean(input.source.signedUrl),
    }),
  })
}
