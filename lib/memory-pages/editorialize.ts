import type { AudienceType, BookProfileV1 } from "@/lib/questionnaire/types"
import type { ContentGenerationProvider, JsonSchemaObject } from "@/lib/content-generation/types"
import { createDefaultContentGenerationProvider } from "@/lib/content-generation/provider"
import type { MemoryPageEditorial, MemoryPageSource, MemoryPageVariant } from "./types"
import {
  MEMORY_PAGE_FALLBACK_TITLE,
  MEMORY_PAGE_MAX_BODY_WORDS,
} from "./types"
import { validateMemoryEditorial } from "./validate"

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function clampBody(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= MEMORY_PAGE_MAX_BODY_WORDS) return words.join(" ")
  return words.slice(0, MEMORY_PAGE_MAX_BODY_WORDS).join(" ")
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

function fallbackEditorial(input: {
  source: MemoryPageSource
  audience: AudienceType
  variant: MemoryPageVariant
  photoId: string | null
}): MemoryPageEditorial {
  return {
    title: input.source.title?.trim() || MEMORY_PAGE_FALLBACK_TITLE,
    eyebrow: input.source.place?.trim() || null,
    body: clampBody(input.source.originalText),
    sourceMemoryId: input.source.memoryId,
    sourcePhotoIds: input.photoId ? [input.photoId] : [],
    place: input.source.place?.trim() || null,
    variant: input.variant,
    usedAi: false,
    audience: input.audience,
  }
}

const MEMORY_EDITORIAL_SCHEMA: JsonSchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["title", "eyebrow", "body", "sourceMemoryId"],
  properties: {
    title: { type: "string", minLength: 1 },
    eyebrow: { type: ["string", "null"] },
    body: { type: "string", minLength: 1 },
    sourceMemoryId: { type: "string", minLength: 1 },
  },
}

function audiencePrompt(audience: AudienceType): string {
  switch (audience) {
    case "ME":
      return "Le lecteur est la personne concernée. Ton naturel, immersif, sans distanciation."
    case "OTHER_PERSON":
      return "Le cahier est offert à la personne concernée. Évite le ton documentaire (« X a fait… »). Préfère une formulation immersive / directe adaptée au souvenir."
    case "DUO":
      return "Souvenir à deux. Ne mentionne que les prénoms fournis. N'invente pas de dynamique relationnelle."
    case "GROUP":
      return "Souvenir de groupe. N'attribue une action à personne si la source ne le dit pas."
    default:
      return "Ton éditorial sobre et chaleureux."
  }
}

/**
 * Build editorial copy for a MEMORY_PAGE.
 * Uses IA only when provider is configured; otherwise deterministic fallback.
 * Never invents facts beyond the selected memory.
 */
export async function editorializeMemoryPage(input: {
  source: MemoryPageSource
  profile: BookProfileV1
  seed: string
  /** Primary photo id already chosen (or null). */
  photoId?: string | null
  provider?: ContentGenerationProvider
  /** Force fallback even if AI is configured. */
  forceFallback?: boolean
}): Promise<MemoryPageEditorial> {
  const audience = input.profile.audience
  const photoId = input.photoId ?? input.source.linkedPhotoIds[0] ?? null
  const variant: MemoryPageVariant = photoId ? "PHOTO" : "TEXT_ONLY"

  const base = fallbackEditorial({
    source: input.source,
    audience,
    variant,
    photoId,
  })

  if (input.forceFallback) return base

  const provider = input.provider ?? createDefaultContentGenerationProvider()
  if (!provider.configured) return base

  const names = participantFirstNames(input.profile, input.source.participantIds)
  const payload = {
    sourceMemoryId: input.source.memoryId,
    originalText: input.source.originalText,
    ...(input.source.title ? { title: input.source.title } : {}),
    ...(input.source.place ? { place: input.source.place } : {}),
    ...(names.length ? { participantFirstNames: names } : {}),
    audience,
  }

  // Guard: payload must not look like a full profile dump
  const rawGuard = JSON.stringify(payload).toLowerCase()
  if (
    rawGuard.includes("personalfacts") ||
    rawGuard.includes("memories") ||
    rawGuard.includes("user_id") ||
    rawGuard.includes("email")
  ) {
    return base
  }

  const system = [
    "Vous éditorialisez un souvenir RÉEL pour une page de cahier de vacances imprimé.",
    "Vous recevez UNIQUEMENT ce souvenir et éventuellement des prénoms.",
    "",
    "Autorisé :",
    "- proposer un petit titre élégant",
    "- fluidifier légèrement le texte",
    "- proposer une courte accroche (eyebrow) si utile",
    "",
    "INTERDIT :",
    "- ajouter un lieu absent de la source",
    "- ajouter une date",
    "- ajouter des personnes non fournies",
    "- ajouter une émotion non exprimée",
    "- inventer ce qui s'est passé avant/après",
    "- créer du dialogue",
    "- enrichir factuellement l'histoire",
    "",
    `Audience : ${audience}. ${audiencePrompt(audience)}`,
    `Le body doit rester court (environ ${MEMORY_PAGE_MAX_BODY_WORDS} mots max).`,
    "sourceMemoryId dans la réponse DOIT être exactement celui fourni.",
    "Répondez uniquement via le schéma JSON.",
  ].join("\n")

  const raw = await provider.generateStructured<{
    title: string
    eyebrow: string | null
    body: string
    sourceMemoryId: string
  }>({
    system,
    input: payload,
    schemaName: "memory_page_v1",
    schema: MEMORY_EDITORIAL_SCHEMA,
    seed: input.seed,
  })

  if (!raw.ok) return base

  const draft: MemoryPageEditorial = {
    title: String(raw.data.title ?? "").trim() || base.title,
    eyebrow:
      raw.data.eyebrow === null || raw.data.eyebrow === undefined
        ? null
        : String(raw.data.eyebrow).trim() || null,
    body: clampBody(String(raw.data.body ?? "").trim() || base.body),
    sourceMemoryId: String(raw.data.sourceMemoryId ?? "").trim(),
    sourcePhotoIds: photoId ? [photoId] : [],
    place: input.source.place?.trim() || null,
    variant,
    usedAi: true,
    audience,
  }

  const validation = validateMemoryEditorial({
    editorial: draft,
    source: input.source,
    profile: input.profile,
  })

  if (!validation.ok) return base

  // If AI invented a place in eyebrow that isn't in source, strip place-like eyebrow only when source has no place
  if (!input.source.place && draft.eyebrow) {
    // keep eyebrow as creative hook — validator already blocks place field invention
  }

  void wordCount
  return draft
}

/** Sync fallback helper for tests / non-async call sites. */
export function editorializeMemoryPageFallback(input: {
  source: MemoryPageSource
  audience: AudienceType
  photoId?: string | null
}): MemoryPageEditorial {
  const photoId = input.photoId ?? input.source.linkedPhotoIds[0] ?? null
  return fallbackEditorial({
    source: input.source,
    audience: input.audience,
    variant: photoId ? "PHOTO" : "TEXT_ONLY",
    photoId,
  })
}
