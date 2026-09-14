/**
 * In-memory File registry for questionnaire photos.
 * Files cannot live in React state / localStorage; kept here for upload + retry
 * until the tab is closed. Persisted photos use Storage + storagePath instead.
 *
 * Object URLs are revoked ONLY on replace / explicit clear / unmount cleanup —
 * never because an upload failed (preview must survive ERROR state).
 *
 * IMPORTANT: Files from <input> / FileList can become empty after the input is
 * cleared on some browsers. Always snapshot bytes into a fresh File via
 * snapshotPhotoFile() before storing.
 */

const files = new Map<string, File>()
const objectUrls = new Map<string, string>()

export type PhotoFileValidationCode = "PHOTO_FILE_MISSING" | "PHOTO_FILE_EMPTY" | "PHOTO_FILE_INVALID"

export type PhotoFileValidation =
  | {
      ok: true
      file: File
      size: number
      mime: string
      fileName: string
    }
  | {
      ok: false
      code: PhotoFileValidationCode
      hasFile: boolean
      isBlob: boolean
      size: number
      mime: string | null
      fileName: string | null
    }

/** Inspect a candidate body before any Supabase Storage call. */
export function validateUploadableFile(file: unknown): PhotoFileValidation {
  const hasFile = file != null
  const isBlob = typeof Blob !== "undefined" && file instanceof Blob
  const isFile = typeof File !== "undefined" && file instanceof File
  const size = isBlob ? (file as Blob).size : 0
  const mime = isFile
    ? (file as File).type || null
    : isBlob
      ? (file as Blob).type || null
      : null
  const fileName = isFile ? (file as File).name || null : null

  if (!hasFile || !isBlob) {
    return {
      ok: false,
      code: "PHOTO_FILE_MISSING",
      hasFile,
      isBlob,
      size: 0,
      mime,
      fileName,
    }
  }
  if (size <= 0) {
    return {
      ok: false,
      code: "PHOTO_FILE_EMPTY",
      hasFile: true,
      isBlob: true,
      size,
      mime,
      fileName,
    }
  }

  const asFile =
    isFile
      ? (file as File)
      : new File([file as Blob], fileName || "photo.jpg", {
          type: mime || "application/octet-stream",
        })

  return {
    ok: true,
    file: asFile,
    size: asFile.size,
    mime: asFile.type || "application/octet-stream",
    fileName: asFile.name || "photo.jpg",
  }
}

/**
 * Copy bytes out of an input FileList File into a standalone File.
 * Prevents "No content provided" when the browser detaches the original after
 * clearing <input type="file">.
 */
export async function snapshotPhotoFile(file: File): Promise<File | null> {
  const pre = validateUploadableFile(file)
  if (!pre.ok) return null
  try {
    const buffer = await file.arrayBuffer()
    if (buffer.byteLength <= 0) return null
    return new File([buffer], file.name || "photo.jpg", {
      type: file.type || "image/jpeg",
      lastModified: file.lastModified,
    })
  } catch {
    return null
  }
}

export function setPhotoFile(photoId: string, file: File): string {
  const checked = validateUploadableFile(file)
  if (!checked.ok) {
    throw new Error(checked.code)
  }
  revokePhotoObjectUrl(photoId)
  files.set(photoId, checked.file)
  const url = URL.createObjectURL(checked.file)
  objectUrls.set(photoId, url)
  return url
}

export function getPhotoFile(photoId: string): File | undefined {
  return files.get(photoId)
}

export function hasPhotoFile(photoId: string): boolean {
  const f = files.get(photoId)
  return Boolean(f && f.size > 0)
}

export function getPhotoObjectUrl(photoId: string): string | undefined {
  return objectUrls.get(photoId)
}

/**
 * Ensure a usable object URL exists while the File is still registered.
 * Recreates the URL if it was lost without deleting the File.
 * Preview URL ≠ File availability — callers must check hasPhotoFile separately.
 */
export function ensurePhotoObjectUrl(photoId: string): string | undefined {
  const existing = objectUrls.get(photoId)
  if (existing) return existing
  const file = files.get(photoId)
  if (!file || file.size <= 0) return undefined
  const url = URL.createObjectURL(file)
  objectUrls.set(photoId, url)
  return url
}

export function clearPhotoFile(photoId: string): void {
  revokePhotoObjectUrl(photoId)
  files.delete(photoId)
}

export function clearAllPhotoFiles(): void {
  for (const id of [...objectUrls.keys()]) {
    revokePhotoObjectUrl(id)
  }
  files.clear()
}

/** Test helper — how many Files are currently retained. */
export function countStoredPhotoFiles(): number {
  return files.size
}

function revokePhotoObjectUrl(photoId: string): void {
  const url = objectUrls.get(photoId)
  if (url) {
    URL.revokeObjectURL(url)
    objectUrls.delete(photoId)
  }
}
