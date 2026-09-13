"use server"

import { getCurrentUser } from "@/lib/auth"
import { insertBookPhoto, insertBookProject, updateBookProject } from "@/lib/data/books"
import { buildBookProfile } from "@/lib/questionnaire/build-profile"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"
import type { BookProfileV1, QuestionnaireV1 } from "@/lib/questionnaire/types"
import { validateQuestionnaireComplete, withDerivedAudienceFields } from "@/lib/questionnaire/validate"
import { createClient } from "@/lib/supabase/server"

const BOOK_PHOTOS_BUCKET = "book-photos"

function stripPhotoPreviews(q: QuestionnaireV1): QuestionnaireV1 {
  return {
    ...q,
    photos: q.photos.map(({ previewDataUrl: _, ...rest }) => rest),
  }
}

function recipientFirstName(q: QuestionnaireV1): string | null {
  const name = q.participants[0]?.firstName?.trim()
  return name || null
}

function resolveDbPaletteStyle(q: QuestionnaireV1): {
  paletteId: string | null
  styleId: string | null
} {
  const paletteId = q.visualPreferences.paletteId
  const styleId = q.visualPreferences.styleId
  return {
    paletteId: !paletteId || paletteId === "AUTO" ? null : paletteId,
    styleId: !styleId || styleId === "AUTO" ? null : styleId,
  }
}

export type SubmitQuestionnaireResult =
  | {
      ok: true
      projectId: string
      profile: BookProfileV1
      richnessLevel: string
    }
  | { ok: false; error: string; code?: "AUTH_REQUIRED" | "VALIDATION" | "INSUFFICIENT" | "SAVE" }

/**
 * Persist a completed questionnaire. Does NOT generate pages, run engines, or call AI.
 */
export async function submitQuestionnaireAction(
  questionnaireInput: QuestionnaireV1,
): Promise<SubmitQuestionnaireResult> {
  const { user } = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "Connectez-vous pour enregistrer votre questionnaire.", code: "AUTH_REQUIRED" }
  }

  const q = withDerivedAudienceFields(questionnaireInput)
  const errors = validateQuestionnaireComplete(q)
  if (errors.length > 0) {
    return { ok: false, error: errors.join(" "), code: "VALIDATION" }
  }

  const richness = calculateProfileRichness(q)
  if (richness.level === "INSUFFICIENT") {
    return {
      ok: false,
      error: `Profil insuffisant: ${richness.missing.join(", ")}`,
      code: "INSUFFICIENT",
    }
  }

  let profile: BookProfileV1
  try {
    profile = buildBookProfile(q)
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Profil invalide",
      code: "VALIDATION",
    }
  }

  const slim = stripPhotoPreviews(q)
  const { paletteId, styleId } = resolveDbPaletteStyle(q)

  const payload = {
    questionnaire: slim,
    bookProfile: profile,
    richness,
  }

  const existingId = q.draftProjectId
  let projectId: string

  if (existingId) {
    const { project, error } = await updateBookProject(existingId, {
      status: "QUESTIONNAIRE_COMPLETED",
      questionnaireData: payload as unknown as Record<string, unknown>,
      paletteId,
      styleId,
      recipientFirstName: recipientFirstName(q),
    })
    if (error || !project) {
      return { ok: false, error: error ?? "Mise à jour impossible", code: "SAVE" }
    }
    projectId = project.id
  } else {
    const { project, error } = await insertBookProject({
      userId: user.id,
      status: "QUESTIONNAIRE_COMPLETED",
      questionnaireData: payload as unknown as Record<string, unknown>,
      paletteId,
      styleId,
      recipientFirstName: recipientFirstName(q),
    })
    if (error || !project) {
      return { ok: false, error: error ?? "Création impossible", code: "SAVE" }
    }
    projectId = project.id
  }

  return {
    ok: true,
    projectId,
    profile,
    richnessLevel: richness.level,
  }
}

/**
 * Upload one photo to private book-photos bucket and attach a book_photos row.
 * Path: `{userId}/{projectId}/{photoId}-{fileName}`
 */
export async function uploadQuestionnairePhotoAction(input: {
  projectId: string
  photoId: string
  fileName: string
  contentType: string
  base64: string
  caption?: string
  anecdote?: string
  useAuthorized: boolean
}): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const { user } = await getCurrentUser()
  if (!user) return { ok: false, error: "Non authentifié" }

  const supabase = await createClient()
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${user.id}/${input.projectId}/${input.photoId}-${safeName}`

  const binary = Buffer.from(input.base64, "base64")
  const { error: uploadError } = await supabase.storage
    .from(BOOK_PHOTOS_BUCKET)
    .upload(storagePath, binary, { contentType: input.contentType, upsert: true })

  if (uploadError) return { ok: false, error: uploadError.message }

  const { error: rowError } = await insertBookPhoto({
    bookProjectId: input.projectId,
    storagePath,
    caption: input.caption?.trim() || null,
    anecdote: input.anecdote?.trim() || null,
    useAuthorized: input.useAuthorized,
  })

  if (rowError) return { ok: false, error: rowError }

  return { ok: true, storagePath }
}
