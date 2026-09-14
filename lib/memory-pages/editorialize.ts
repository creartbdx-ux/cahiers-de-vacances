import type { AudienceType, BookProfileV1 } from "@/lib/questionnaire/types"
import type { ContentGenerationProvider, JsonSchemaObject } from "@/lib/content-generation/types"
import { createDefaultContentGenerationProvider } from "@/lib/content-generation/provider"
import type { MemoryDensity, MemoryPageEditorial, MemoryPageSource } from "./types"
import { MEMORY_PAGE_FALLBACK_TITLE } from "./types"
import {
  classifyMemoryDensity,
  maxBodyWordsForSource,
  recommendFullMemoryPage,
} from "./density"
import { validateMemoryEditorial } from "./validate"

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function clampBody(text: string, maxWords: number): string {
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

function fallbackEditorial(input: {
  source: MemoryPageSource
  audience: AudienceType
  density: MemoryDensity
  fullPageRecommended: boolean
}): MemoryPageEditorial {
  const maxWords = maxBodyWordsForSource(input.source.originalText, input.density)
  return {
    title: input.source.title?.trim() || MEMORY_PAGE_FALLBACK_TITLE,
    eyebrow: input.source.place?.trim() || null,
    body: clampBody(input.source.originalText, maxWords),
    sourceMemoryId: input.source.memoryId,
    sourcePhotoIds: [],
    place: input.source.place?.trim() || null,
    variant: "TEXT_ONLY",
    density: input.density,
    fullPageRecommended: input.fullPageRecommended,
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

function densityBodyGuidance(density: MemoryDensity, sourceWords: number, maxWords: number): string {
  if (density === "SHORT") {
    return [
      `Densité SHORT (${sourceWords} mots source) : le body doit rester très court.`,
      "Ne jamais allonger artificiellement. Une phrase source peut rester une ou deux phrases.",
      `Maximum strict : ${maxWords} mots. Pas de dissertation.`,
    ].join(" ")
  }
  if (density === "MEDIUM") {
    return `Densité MEDIUM : body fluide, proportionnel à la source (max ${maxWords} mots).`
  }
  return `Densité RICH : body peut être un peu plus développé, éventuellement 2 paragraphes si la source le justifie (max ${maxWords} mots). Ne pas inventer.`
}

/**
 * Build editorial copy for MEMORY_TEXT_PAGE.
 * Uses IA only when provider is configured; otherwise deterministic fallback.
 * Never invents facts beyond the selected memory. Never attaches photos.
 */
export async function editorializeMemoryPage(input: {
  source: MemoryPageSource
  profile: BookProfileV1
  seed: string
  provider?: ContentGenerationProvider
  /** Force fallback even if AI is configured. */
  forceFallback?: boolean
}): Promise<MemoryPageEditorial> {
  const audience = input.profile.audience
  const density = classifyMemoryDensity({ source: input.source })
  const fullPageRecommended = recommendFullMemoryPage({ density })
  const maxWords = maxBodyWordsForSource(input.source.originalText, density)
  const sourceWords = wordCount(input.source.originalText)

  const base = fallbackEditorial({
    source: input.source,
    audience,
    density,
    fullPageRecommended,
  })

  if (input.forceFallback) return base

  const provider = input.provider ?? createDefaultContentGenerationProvider()
  if (!provider.configured) return base

  const names = participantFirstNames(input.profile, input.source.participantIds)
  const payload = {
    sourceMemoryId: input.source.memoryId,
    originalText: input.source.originalText,
    density,
    ...(input.source.title ? { title: input.source.title } : {}),
    ...(input.source.place ? { place: input.source.place } : {}),
    ...(names.length ? { participantFirstNames: names } : {}),
    audience,
  }

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
    "- proposer un petit titre élégant et NATUREL en français",
    "- fluidifier légèrement le texte (sans l'allonger)",
    "- proposer une courte accroche (eyebrow) uniquement si elle repose sur des éléments déjà présents",
    "",
    "TITRE — règles strictes :",
    "- naturel et idiomatique en français",
    "- utiliser uniquement les éléments présents dans la source",
    "- ne jamais inventer un lieu, une date, une émotion ou un fait",
    "",
    "EYEBROW :",
    "- strictement fondé sur la source",
    "- null si rien de pertinent",
    "",
    "INTERDIT :",
    "- ajouter un lieu absent de la source",
    "- ajouter une date",
    "- ajouter des personnes non fournies",
    "- ajouter une émotion non exprimée",
    "- inventer ce qui s'est passé avant/après",
    "- créer du dialogue",
    "- enrichir factuellement l'histoire",
    "- allonger artificiellement le body pour remplir la page",
    "- utiliser une photo ou décrire une image",
    "",
    `Audience : ${audience}. ${audiencePrompt(audience)}`,
    densityBodyGuidance(density, sourceWords, maxWords),
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
    schemaName: "memory_text_page_v1",
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
    body: clampBody(String(raw.data.body ?? "").trim() || base.body, maxWords),
    sourceMemoryId: String(raw.data.sourceMemoryId ?? "").trim(),
    sourcePhotoIds: [],
    place: input.source.place?.trim() || null,
    variant: "TEXT_ONLY",
    density,
    fullPageRecommended,
    usedAi: true,
    audience,
  }

  if (wordCount(draft.body) > maxWords) return base
  if (density === "SHORT" && wordCount(draft.body) > sourceWords * 1.5 + 6) {
    return base
  }

  const validation = validateMemoryEditorial({
    editorial: draft,
    source: input.source,
    profile: input.profile,
  })

  if (!validation.ok) return base

  return draft
}

/** Sync fallback helper for tests / non-async call sites. */
export function editorializeMemoryPageFallback(input: {
  source: MemoryPageSource
  audience: AudienceType
}): MemoryPageEditorial {
  const density = classifyMemoryDensity({ source: input.source })
  return fallbackEditorial({
    source: input.source,
    audience: input.audience,
    density,
    fullPageRecommended: recommendFullMemoryPage({ density }),
  })
}
