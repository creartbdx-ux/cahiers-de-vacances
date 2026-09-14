import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { MemoryDensity, MemoryPageEditorial, MemoryPageSource } from "./types"
import { MEMORY_PAGE_MAX_BODY_WORDS } from "./types"
import { maxBodyWordsForSource } from "./density"

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

/**
 * Validate editorial output against the selected memory source.
 * Blocks factual invention of place / wrong memory id / empty body.
 * Does not require inflating short sources.
 */
export function validateMemoryEditorial(input: {
  editorial: MemoryPageEditorial
  source: MemoryPageSource
  profile: BookProfileV1
}): { ok: true } | { ok: false; errors: string[] } {
  const { editorial, source, profile } = input
  const errors: string[] = []

  const memory = profile.memories.find((m) => m.id === source.memoryId)
  if (!memory || !memory.text?.trim()) {
    errors.push("Le souvenir source est introuvable dans le profil.")
  }

  if (editorial.sourceMemoryId !== source.memoryId) {
    errors.push("sourceMemoryId ne correspond pas au souvenir sélectionné.")
  }

  if (!editorial.title?.trim()) {
    errors.push("Titre manquant.")
  }

  if (!editorial.body?.trim()) {
    errors.push("Corps de texte manquant.")
  } else {
    const words = wordCount(editorial.body)
    const sourceWords = wordCount(source.originalText)
    const density: MemoryDensity = editorial.density
    const maxWords = maxBodyWordsForSource(source.originalText, density)

    if (words > MEMORY_PAGE_MAX_BODY_WORDS + 20) {
      errors.push(`Body trop long (${words} mots).`)
    }
    if (words > maxWords + 8) {
      errors.push(`Body disproportionné par rapport à la source (${words} > ${maxWords}).`)
    }
    // Only require body not to collapse a RICH/MEDIUM source; SHORT may stay short.
    if (
      density !== "SHORT" &&
      sourceWords >= 20 &&
      words < Math.min(12, Math.floor(sourceWords * 0.4))
    ) {
      errors.push("Body trop court par rapport à la source.")
    }
  }

  if (editorial.place) {
    if (!source.place) {
      errors.push("Lieu inventé : la source n'en contient pas.")
    } else if (normalize(editorial.place) !== normalize(source.place)) {
      errors.push("Lieu modifié par rapport à la source.")
    }
  }

  for (const id of editorial.sourcePhotoIds) {
    if (!source.linkedPhotoIds.includes(id)) {
      const photo = profile.photos.find((p) => p.id === id && p.useAuthorized)
      if (!photo) {
        errors.push(`Photo ${id} non autorisée / absente.`)
      }
    }
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true }
}

/** Payload sent to the provider must stay personal-free beyond the selected memory. */
export function memoryPayloadLooksMinimal(payload: unknown): boolean {
  const raw = JSON.stringify(payload).toLowerCase()
  const forbidden = [
    "personalfacts",
    "insidejokes",
    "email",
    "user_id",
    "storage_path",
    "forbiddentopics",
    "questionnaire",
    "memories\":[",
  ]
  return !forbidden.some((k) => raw.includes(k))
}

/**
 * Soft check: title tokens should largely overlap source vocabulary
 * (excluding stopwords). Used in tests / guards — not a hard editorial block.
 */
export function titleLooksGroundedInSource(title: string, sourceText: string): boolean {
  const stop = new Set([
    "un",
    "une",
    "le",
    "la",
    "les",
    "de",
    "des",
    "du",
    "au",
    "aux",
    "en",
    "a",
    "à",
    "et",
    "ou",
    "sur",
    "dans",
    "pour",
    "par",
    "notre",
    "nos",
    "leur",
    "leurs",
    "ce",
    "cette",
    "ces",
  ])
  const sourceTokens = new Set(
    normalize(sourceText)
      .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
      .filter((t) => t.length > 2 && !stop.has(t)),
  )
  const titleTokens = normalize(title)
    .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
    .filter((t) => t.length > 2 && !stop.has(t))
  if (!titleTokens.length) return true
  const grounded = titleTokens.filter((t) =>
    [...sourceTokens].some((s) => s.includes(t) || t.includes(s)),
  )
  return grounded.length / titleTokens.length >= 0.5
}
