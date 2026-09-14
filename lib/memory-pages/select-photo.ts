import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { PhotoMemorySourceV1 } from "./types"

type ProfilePhoto = BookProfileV1["photos"][number]

/** Authorized photos with a persisted storage path (usable for PHOTO_MEMORY_PAGE). */
export function usableAuthorizedPhotos(profile: BookProfileV1): ProfilePhoto[] {
  return (profile.photos ?? []).filter((p) => p.useAuthorized && Boolean(p.storagePath))
}

export function photoHasEditorialText(
  photo: Pick<ProfilePhoto, "caption" | "anecdote">,
): boolean {
  return Boolean(photo.caption?.trim() || photo.anecdote?.trim())
}

/**
 * Build a PhotoMemorySourceV1 from a profile photo.
 * Does not attach any memory — caption/anecdote of THIS photo only.
 */
export function toPhotoMemorySource(
  photo: ProfilePhoto,
  signedUrl: string | null = null,
  aspectRatio?: number,
): PhotoMemorySourceV1 | null {
  if (!photo.useAuthorized || !photo.storagePath) return null
  return {
    photoId: photo.id,
    storagePath: photo.storagePath,
    signedUrl,
    participantIds: [...(photo.participantIds ?? [])],
    caption: photo.caption?.trim() || null,
    anecdote: photo.anecdote?.trim() || null,
    authorization: true,
    ...(aspectRatio != null && Number.isFinite(aspectRatio) && aspectRatio > 0
      ? { aspectRatio }
      : {}),
  }
}

export function selectPhotoMemorySource(input: {
  profile: BookProfileV1
  photoId: string
  photoSignedUrls?: Record<string, string>
  aspectRatios?: Record<string, number>
}): PhotoMemorySourceV1 | null {
  const photo = input.profile.photos.find((p) => p.id === input.photoId)
  if (!photo) return null
  return toPhotoMemorySource(
    photo,
    input.photoSignedUrls?.[photo.id] ?? null,
    input.aspectRatios?.[photo.id],
  )
}

/**
 * Deterministic pick among authorized+stored photos (for planning / lab defaults).
 * Prefer photos that have caption or anecdote.
 */
export function selectPhotoForMemoryPage(input: {
  profile: BookProfileV1
  seed: string
  usedPhotoIds?: ReadonlySet<string> | string[]
  photoSignedUrls?: Record<string, string>
  aspectRatios?: Record<string, number>
}): PhotoMemorySourceV1 | null {
  const used = new Set(
    input.usedPhotoIds instanceof Set
      ? [...input.usedPhotoIds]
      : (input.usedPhotoIds ?? []),
  )
  const photos = usableAuthorizedPhotos(input.profile)
  if (!photos.length) return null

  const ranked = [...photos].sort((a, b) => {
    const aUsed = used.has(a.id) ? 1 : 0
    const bUsed = used.has(b.id) ? 1 : 0
    if (aUsed !== bUsed) return aUsed - bUsed
    const aText = photoHasEditorialText(a) ? 1 : 0
    const bText = photoHasEditorialText(b) ? 1 : 0
    if (aText !== bText) return bText - aText
    return a.id.localeCompare(b.id)
  })

  const pick = ranked[0]
  if (!pick) return null
  return toPhotoMemorySource(
    pick,
    input.photoSignedUrls?.[pick.id] ?? null,
    input.aspectRatios?.[pick.id],
  )
}
