"use client"

import { createClient } from "@/lib/supabase/client"
import {
  BOOK_PHOTOS_BUCKET,
  buildBookPhotoStoragePath,
  toUserFacingPhotoError,
  validatePhotoFile,
} from "@/lib/questionnaire/photos"

/**
 * Upload a photo file directly from the browser to private Supabase Storage.
 * Does not go through a Next.js Server Action (avoids Vercel body/timeout limits).
 */
export async function uploadBookPhotoFile(input: {
  userId: string
  projectId: string
  photoId: string
  file: File
}): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const validationError = validatePhotoFile(input.file)
  if (validationError) return { ok: false, error: validationError }

  const storagePath = buildBookPhotoStoragePath({
    userId: input.userId,
    projectId: input.projectId,
    photoId: input.photoId,
    fileName: input.file.name,
  })

  try {
    const supabase = createClient()
    const { error } = await supabase.storage
      .from(BOOK_PHOTOS_BUCKET)
      .upload(storagePath, input.file, {
        contentType: input.file.type,
        upsert: true,
      })

    if (error) {
      return { ok: false, error: toUserFacingPhotoError(error.message) }
    }
    return { ok: true, storagePath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: toUserFacingPhotoError(message) }
  }
}
