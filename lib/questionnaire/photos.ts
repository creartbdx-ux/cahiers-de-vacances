import type { QuestionnairePhoto, QuestionnaireV1 } from "./types"

export const BOOK_PHOTOS_BUCKET = "book-photos"

/** Hard limit for user photos (bytes). Keep below typical edge body limits. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export const ACCEPTED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

export const PHOTO_UPLOAD_USER_ERROR =
  "Une photo n'a pas pu être enregistrée. Réessayez ou supprimez-la pour continuer."

export const PHOTO_TOO_LARGE_USER_ERROR =
  "Cette photo est trop lourde. Choisissez une image de moins de 10 Mo."

export const PHOTO_FORMAT_USER_ERROR =
  "Format non supporté. Utilisez JPG, PNG, WebP ou GIF."

/** Photos currently mid-upload (blocks Next with a neutral banner, not a red error). */
export function hasPhotosUploading(photos: QuestionnairePhoto[]): boolean {
  return photos.some((p) => p.uploadStatus === "uploading")
}

/** True when there is at least one photo and every photo is persisted/saved. */
export function allPhotosSaved(photos: QuestionnairePhoto[]): boolean {
  return photos.length > 0 && photos.every((p) => p.uploadStatus === "persisted" || isPhotoPersisted(p))
}

export function hasPhotoUploadErrors(photos: QuestionnairePhoto[]): boolean {
  return photos.some((p) => p.uploadStatus === "error")
}

/** User-facing copy for photo upload status banners (testable). */
export function photoUploadBannerMessage(input: {
  uploading: boolean
  allSaved: boolean
  showSavedFlash: boolean
}): "uploading" | "all_saved" | null {
  if (input.uploading) return "uploading"
  if (input.showSavedFlash && input.allSaved) return "all_saved"
  return null
}

export function photoUploadBannerCopy(
  kind: "uploading" | "all_saved",
): string {
  if (kind === "uploading") return "Enregistrement des photos en cours…"
  return "Toutes vos photos sont enregistrées."
}

/** True when the photo exists in Storage + is linked via storagePath. */
export function isPhotoPersisted(photo: Pick<QuestionnairePhoto, "storagePath" | "uploadStatus">): boolean {
  return Boolean(photo.storagePath) && photo.uploadStatus !== "error"
}

/** Photos that may appear in the recap (excludes failed uploads). */
export function countRecapPhotos(photos: QuestionnairePhoto[]): number {
  return photos.filter((p) => p.uploadStatus !== "error").length
}

export function sanitizeFileName(fileName: string): string {
  const base = fileName.trim() || "photo.jpg"
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
}

export function buildBookPhotoStoragePath(input: {
  userId: string
  projectId: string
  photoId: string
  fileName: string
}): string {
  return `${input.userId}/${input.projectId}/${input.photoId}-${sanitizeFileName(input.fileName)}`
}

export function extractPhotoIdFromStoragePath(storagePath: string): string | null {
  const file = storagePath.split("/").pop() ?? ""
  const match = file.match(/^(ph_[a-z0-9]+)-/i)
  return match?.[1] ?? null
}

export function isAcceptedPhotoMimeType(mime: string): boolean {
  return (ACCEPTED_PHOTO_MIME_TYPES as readonly string[]).includes(mime)
}

export function validatePhotoFile(file: Pick<File, "size" | "type" | "name">): string | null {
  if (!file || typeof file.size !== "number") {
    return PHOTO_UPLOAD_USER_ERROR
  }
  if (file.size <= 0) {
    return PHOTO_UPLOAD_USER_ERROR
  }
  if (!file.type.startsWith("image/") || !isAcceptedPhotoMimeType(file.type)) {
    return PHOTO_FORMAT_USER_ERROR
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return PHOTO_TOO_LARGE_USER_ERROR
  }
  return null
}

/**
 * Never expose raw Supabase / Vercel / gateway messages to the client UI.
 */
export function toUserFacingPhotoError(raw: string | null | undefined): string {
  if (!raw) return PHOTO_UPLOAD_USER_ERROR
  const lower = raw.toLowerCase()
  if (
    lower.includes("too large") ||
    lower.includes("maximum") ||
    lower.includes("payload") ||
    lower.includes("file size") ||
    lower.includes("exceeded") ||
    lower.includes("10 mo") ||
    lower.includes("10 mb")
  ) {
    return PHOTO_TOO_LARGE_USER_ERROR
  }
  if (
    lower.includes("mime") ||
    lower.includes("not allowed") ||
    lower.includes("invalid type") ||
    lower.includes("format")
  ) {
    return PHOTO_FORMAT_USER_ERROR
  }
  // Gateway Timeout, 504, fetch failed, JWT, bucket missing, etc. → generic
  return PHOTO_UPLOAD_USER_ERROR
}

export function stripPhotoClientFields(photo: QuestionnairePhoto): QuestionnairePhoto {
  const { previewDataUrl: _, uploadError: __, ...rest } = photo
  return {
    ...rest,
    uploadStatus: photo.storagePath ? "persisted" : photo.uploadStatus === "error" ? "error" : "local",
  }
}

export type BookPhotoRowLike = {
  storage_path: string
  caption: string | null
  anecdote: string | null
  use_authorized: boolean
}

/**
 * Merge DB book_photos rows into questionnaire photos for draft resume.
 * Prefers existing questionnaire metadata; fills gaps from rows; marks persisted.
 */
export function mergeBookPhotosIntoQuestionnaire(
  q: QuestionnaireV1,
  rows: BookPhotoRowLike[],
  signedUrls: Record<string, string | undefined> = {},
): QuestionnaireV1 {
  if (rows.length === 0) {
    return {
      ...q,
      photos: q.photos.map((p) =>
        p.storagePath
          ? {
              ...p,
              uploadStatus: "persisted" as const,
              previewDataUrl: signedUrls[p.storagePath] ?? p.previewDataUrl,
              uploadError: undefined,
            }
          : p,
      ),
    }
  }

  const byId = new Map(q.photos.map((p) => [p.id, { ...p }]))
  const byPath = new Map(
    q.photos.filter((p) => p.storagePath).map((p) => [p.storagePath!, { ...p }]),
  )
  const merged: QuestionnairePhoto[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const photoId = extractPhotoIdFromStoragePath(row.storage_path)
    const existing =
      byPath.get(row.storage_path) ?? (photoId ? byId.get(photoId) : undefined)
    const id = existing?.id ?? photoId ?? `ph_${row.storage_path.slice(-8)}`
    const next: QuestionnairePhoto = {
      id,
      storagePath: row.storage_path,
      caption: existing?.caption ?? row.caption ?? undefined,
      anecdote: existing?.anecdote ?? row.anecdote ?? undefined,
      participantIds: existing?.participantIds,
      fileName: existing?.fileName,
      useAuthorized: existing?.useAuthorized ?? row.use_authorized,
      uploadStatus: "persisted",
      previewDataUrl: signedUrls[row.storage_path] ?? existing?.previewDataUrl,
      uploadError: undefined,
    }
    merged.push(next)
    seen.add(id)
  }

  for (const photo of q.photos) {
    if (seen.has(photo.id)) continue
    // Keep local / failed entries that were never persisted
    if (!photo.storagePath) {
      merged.push({
        ...photo,
        uploadStatus: photo.uploadStatus === "error" ? "error" : "local",
      })
    }
  }

  return { ...q, photos: merged }
}

export function assertPhotoBelongsToProject(input: {
  storagePath: string
  userId: string
  projectId: string
}): boolean {
  return input.storagePath.startsWith(`${input.userId}/${input.projectId}/`)
}
