import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { MemoryPageEditorial, MemoryPageSource } from "./types"
import { MEMORY_PAGE_MAX_BODY_WORDS, MEMORY_PAGE_MIN_BODY_WORDS } from "./types"

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
    if (words > MEMORY_PAGE_MAX_BODY_WORDS + 20) {
      errors.push(`Body trop long (${words} mots).`)
    }
    if (words < MEMORY_PAGE_MIN_BODY_WORDS && wordCount(source.originalText) >= MEMORY_PAGE_MIN_BODY_WORDS) {
      errors.push("Body trop court par rapport à la source.")
    }
  }

  // Place: editorial.place must match source or be null
  if (editorial.place) {
    if (!source.place) {
      errors.push("Lieu inventé : la source n'en contient pas.")
    } else if (normalize(editorial.place) !== normalize(source.place)) {
      errors.push("Lieu modifié par rapport à la source.")
    }
  }

  // Photos must be subset of linked candidates (or empty)
  for (const id of editorial.sourcePhotoIds) {
    if (!source.linkedPhotoIds.includes(id)) {
      // Allow if photo exists on profile authorized — soft check
      const photo = profile.photos.find((p) => p.id === id && p.useAuthorized)
      if (!photo) {
        errors.push(`Photo ${id} non autorisée / absente.`)
      }
    }
  }

  // Participant names in body that aren't in allowed first names — soft heuristic
  const allowedNames = new Set(
    profile.participants
      .filter((p) => (source.participantIds.length ? source.participantIds.includes(p.id) : true))
      .map((p) => normalize(p.firstName))
      .filter(Boolean),
  )
  // Also allow all participant names of the book for group storytelling when memory has no tags
  if (!source.participantIds.length) {
    for (const p of profile.participants) {
      if (p.firstName.trim()) allowedNames.add(normalize(p.firstName))
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
