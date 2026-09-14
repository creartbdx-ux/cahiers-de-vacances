"use client"

import { createClient } from "@/lib/supabase/client"
import {
  BOOK_PHOTOS_BUCKET,
  buildBookPhotoStoragePath,
  extractPhotoIdFromStoragePath,
  PHOTO_UPLOAD_USER_ERROR,
  toUserFacingPhotoError,
  validatePhotoFile,
} from "@/lib/questionnaire/photos"
import { validateUploadableFile } from "@/lib/questionnaire/photo-files"

export type UploadBookPhotoResult =
  | { ok: true; storagePath: string; photoId: string }
  | {
      ok: false
      error: string
      step: "FILE_VALIDATION" | "STORAGE_UPLOAD"
      code?: string
      message?: string
    }

function logFileValidation(input: {
  photoId: string
  hasFile: boolean
  isBlob: boolean
  size: number
  mime: string | null
  fileName?: string | null
  code?: string
}) {
  console.error(
    JSON.stringify({
      scope: "book-photos",
      step: "FILE_VALIDATION",
      photoId: input.photoId,
      hasFile: input.hasFile,
      isBlob: input.isBlob,
      size: input.size,
      mime: input.mime,
      fileName: input.fileName ?? null,
      code: input.code ?? null,
    }),
  )
}

/**
 * Upload a photo file directly from the browser to private Supabase Storage.
 * Path ALWAYS uses auth.uid() from the browser session.
 * Never calls Storage with an empty / missing body ("No content provided").
 */
export async function uploadBookPhotoFile(input: {
  projectId: string
  photoId: string
  file: File
  /** @deprecated Ignored — session uid is authoritative for RLS path. */
  userId?: string
}): Promise<UploadBookPhotoResult> {
  const bodyCheck = validateUploadableFile(input.file)
  logFileValidation({
    photoId: input.photoId,
    hasFile: bodyCheck.ok ? true : bodyCheck.hasFile,
    isBlob: bodyCheck.ok ? true : bodyCheck.isBlob,
    size: bodyCheck.ok ? bodyCheck.size : bodyCheck.size,
    mime: bodyCheck.ok ? bodyCheck.mime : bodyCheck.mime,
    fileName: bodyCheck.ok ? bodyCheck.fileName : bodyCheck.fileName,
    code: bodyCheck.ok ? undefined : bodyCheck.code,
  })

  if (!bodyCheck.ok) {
    return {
      ok: false,
      error: PHOTO_UPLOAD_USER_ERROR,
      step: "FILE_VALIDATION",
      code: bodyCheck.code,
      message: bodyCheck.code,
    }
  }

  const metaError = validatePhotoFile(bodyCheck.file)
  if (metaError) {
    return {
      ok: false,
      error: metaError,
      step: "FILE_VALIDATION",
      message: metaError,
    }
  }

  // Re-materialize bytes so the upload body cannot be an emptied input File.
  let uploadBody: Blob
  try {
    const buffer = await bodyCheck.file.arrayBuffer()
    if (buffer.byteLength <= 0) {
      logFileValidation({
        photoId: input.photoId,
        hasFile: true,
        isBlob: true,
        size: 0,
        mime: bodyCheck.mime,
        fileName: bodyCheck.fileName,
        code: "PHOTO_FILE_EMPTY",
      })
      return {
        ok: false,
        error: PHOTO_UPLOAD_USER_ERROR,
        step: "FILE_VALIDATION",
        code: "PHOTO_FILE_EMPTY",
        message: "arrayBuffer byteLength is 0",
      }
    }
    uploadBody = new Blob([buffer], { type: bodyCheck.mime || "image/jpeg" })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: PHOTO_UPLOAD_USER_ERROR,
      step: "FILE_VALIDATION",
      code: "PHOTO_FILE_MISSING",
      message,
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
      fileName: bodyCheck.fileName,
    })

    const { error } = await supabase.storage.from(BOOK_PHOTOS_BUCKET).upload(storagePath, uploadBody, {
      contentType: bodyCheck.mime || "image/jpeg",
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
