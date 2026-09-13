/**
 * In-memory File registry for questionnaire photos.
 * Files cannot live in React state / localStorage; kept here for upload + retry
 * until the tab is closed. Persisted photos use Storage + storagePath instead.
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
