/**
 * Server/admin diagnostic logs for photo pipeline.
 * Never logs file bytes, captions, anecdotes, or other personal content.
 */

export type PhotoPipelineStep =
  | "STORAGE_UPLOAD"
  | "REGISTER_METADATA"
  | "DELETE"
  | "SIGNED_URL"
  | "ENSURE_PROJECT"

export function logPhotoPipelineError(input: {
  step: PhotoPipelineStep
  bookProjectId?: string | null
  photoId?: string | null
  storagePath?: string | null
  code?: string | null
  message?: string | null
}): void {
  // Vercel / server logs only — never sent to the public client.
  console.error(
    JSON.stringify({
      scope: "book-photos",
      step: input.step,
      bookProjectId: input.bookProjectId ?? null,
      photoId: input.photoId ?? null,
      // Path is operational (uid/project/photoId-filename) — no image bytes.
      storagePath: input.storagePath ?? null,
      code: input.code ?? null,
      message: truncate(input.message),
    }),
  )
}

function truncate(message: string | null | undefined): string | null {
  if (!message) return null
  return message.slice(0, 240)
}
