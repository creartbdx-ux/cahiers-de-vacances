/**
 * In-memory File registry for questionnaire photos.
 * Files cannot live in React state / localStorage; kept here for upload + retry
 * until the tab is closed. Persisted photos use Storage + storagePath instead.
 *
 * Object URLs are revoked ONLY on replace / explicit clear / unmount cleanup —
 * never because an upload failed (preview must survive ERROR state).
 */

const files = new Map<string, File>()
const objectUrls = new Map<string, string>()

export function setPhotoFile(photoId: string, file: File): string {
  revokePhotoObjectUrl(photoId)
  files.set(photoId, file)
  const url = URL.createObjectURL(file)
  objectUrls.set(photoId, url)
  return url
}

export function getPhotoFile(photoId: string): File | undefined {
  return files.get(photoId)
}

export function getPhotoObjectUrl(photoId: string): string | undefined {
  return objectUrls.get(photoId)
}

/**
 * Ensure a usable object URL exists while the File is still registered.
 * Recreates the URL if it was lost without deleting the File (e.g. after a
 * spurious revoke) — keeps ERROR-state previews alive.
 */
export function ensurePhotoObjectUrl(photoId: string): string | undefined {
  const existing = objectUrls.get(photoId)
  if (existing) return existing
  const file = files.get(photoId)
  if (!file) return undefined
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

function revokePhotoObjectUrl(photoId: string): void {
  const url = objectUrls.get(photoId)
  if (url) {
    URL.revokeObjectURL(url)
    objectUrls.delete(photoId)
  }
}
