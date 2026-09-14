import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { PhotoMemoryEditorial, PhotoMemorySourceV1 } from "./types"
import { PHOTO_MEMORY_MAX_BODY_WORDS } from "./types"
import { maxPhotoMemoryBodyWords, photoMemoryCombinedText } from "./photo-layout"

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
 * Validate PHOTO_MEMORY editorial against the selected photo source only.
 */
export function validatePhotoMemoryEditorial(input: {
  editorial: PhotoMemoryEditorial
  source: PhotoMemorySourceV1
  profile: BookProfileV1
}): { ok: true } | { ok: false; errors: string[] } {
  const { editorial, source, profile } = input
  const errors: string[] = []

  const photo = profile.photos.find((p) => p.id === source.photoId)
  if (!photo || !photo.useAuthorized || !photo.storagePath) {
    errors.push("Photo source introuvable ou non autorisée.")
  }

  if (editorial.sourcePhotoId !== source.photoId) {
    errors.push("sourcePhotoId ne correspond pas à la photo sélectionnée.")
  }

  if (!editorial.title?.trim()) {
    errors.push("Titre manquant.")
  }

  const sourceText = photoMemoryCombinedText(source)
  const weak = !sourceText

  if (!weak && !editorial.body?.trim()) {
    errors.push("Corps de texte manquant alors que la photo a une légende/anecdote.")
  }

  if (editorial.body?.trim()) {
    const words = wordCount(editorial.body)
    const maxWords = maxPhotoMemoryBodyWords(sourceText, editorial.density)
    if (words > PHOTO_MEMORY_MAX_BODY_WORDS + 20) {
      errors.push(`Body trop long (${words} mots).`)
    }
    if (sourceText && words > maxWords + 8) {
      errors.push(`Body disproportionné par rapport à la source (${words} > ${maxWords}).`)
    }
  }

  // Caption/anecdote of another photo must not leak into body grounding check (soft).
  for (const other of profile.photos) {
    if (other.id === source.photoId) continue
    const foreign = [other.caption, other.anecdote]
      .map((s) => s?.trim() ?? "")
      .filter((s): s is string => s.length > 12)
    for (const chunk of foreign) {
      if (
        editorial.body &&
        normalize(editorial.body).includes(normalize(chunk)) &&
        !normalize(sourceText).includes(normalize(chunk))
      ) {
        errors.push("Body contient des métadonnées d'une autre photo.")
      }
    }
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true }
}

/** AI payload for photo memory must not include other memories / photos / profile dumps. */
export function photoMemoryPayloadLooksMinimal(payload: unknown): boolean {
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
    "photos\":[",
    "originaltext",
    "sourcememoryid",
  ]
  return !forbidden.some((k) => raw.includes(k))
}
