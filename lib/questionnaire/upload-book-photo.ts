"use client"

import { createClient } from "@/lib/supabase/client"
import {
  BOOK_PHOTOS_BUCKET,
  buildBookPhotoStoragePath,
  extractPhotoIdFromStoragePath,
  toUserFacingPhotoError,
  validatePhotoFile,
} from "@/lib/questionnaire/photos"

export type UploadBookPhotoResult =
  | { ok: true; storagePath: string; photoId: string }
  | { ok: false; error: string; step: "STORAGE_UPLOAD"; code?: string; message?: string }

/**
 * Upload a photo file directly from the browser to private Supabase Storage.
 * Path ALWAYS uses auth.uid() from the browser session (never a caller-supplied uid).
 * Does not go through a Next.js Server Action (avoids Vercel body/timeout limits).
 */
export async function uploadBookPhotoFile(input: {
  projectId: string
  photoId: string
  file: File
  /** @deprecated Ignored — session uid is authoritative for RLS path. */
  userId?: string
}): Promise<UploadBookPhotoResult> {
  const validationError = validatePhotoFile(input.file)
  if (validationError) {
    return {
      ok: false,
      error: validationError,
      step: "STORAGE_UPLOAD",
      message: validationError,
    }
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        ok: false,
        error: toUserFacingPhotoError(authError?.message ?? "Non authentifié"),
        step: "STORAGE_UPLOAD",
        code: authError?.name ?? "NO_SESSION",
        message: authError?.message ?? "No browser session for storage upload",
      }
    }

    const storagePath = buildBookPhotoStoragePath({
      userId: user.id,
      projectId: input.projectId,
      photoId: input.photoId,
      fileName: input.file.name,
    })

    const { error } = await supabase.storage.from(BOOK_PHOTOS_BUCKET).upload(storagePath, input.file, {
      contentType: input.file.type || "image/jpeg",
      upsert: true,
    })

    if (error) {
      return {
        ok: false,
        error: toUserFacingPhotoError(error.message),
        step: "STORAGE_UPLOAD",
        code: (error as { statusCode?: string }).statusCode ?? error.name,
        message: error.message,
      }
    }

    return {
      ok: true,
      storagePath,
      photoId: extractPhotoIdFromStoragePath(storagePath) ?? input.photoId,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: toUserFacingPhotoError(message),
      step: "STORAGE_UPLOAD",
      message,
    }
  }
}
