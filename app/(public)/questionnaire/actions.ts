"use server"

import { getCurrentUser } from "@/lib/auth"
import {
  BOOK_STATUS,
  buildInProgressPayload,
  isQuestionnaireCompleted,
  isQuestionnaireInProgress,
  parseQuestionnairePayload,
} from "@/lib/books/lifecycle"
import {
  deleteBookPhotoByStoragePath,
  deleteBookProject,
  getBookPhotos,
  getBookProject,
  insertBookPhoto,
  insertBookProject,
  updateBookProject,
  createBookPhotoSignedUrls,
} from "@/lib/data/books"
import { buildBookProfile } from "@/lib/questionnaire/build-profile"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"
import {
  assertPhotoBelongsToProject,
  BOOK_PHOTOS_BUCKET,
  mergeBookPhotosIntoQuestionnaire,
  toUserFacingPhotoError,
} from "@/lib/questionnaire/photos"
import {
  createEmptyQuestionnaire,
  type BookProfileV1,
  type QuestionnaireV1,
} from "@/lib/questionnaire/types"
import { validateQuestionnaireComplete, withDerivedAudienceFields } from "@/lib/questionnaire/validate"
import { createClient } from "@/lib/supabase/server"

function stripPhotoPreviews(q: QuestionnaireV1): QuestionnaireV1 {
  return {
    ...q,
    photos: q.photos.map(({ previewDataUrl: _, uploadError: __, ...rest }) => ({
      ...rest,
      uploadStatus: rest.storagePath ? ("persisted" as const) : rest.uploadStatus,
    })),
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

export type AuthResult = { ok: false; error: string; code: "AUTH_REQUIRED" }

export async function createBookProjectAction(): Promise<
  | { ok: true; projectId: string }
  | AuthResult
  | { ok: false; error: string; code: "SAVE" }
> {
  const { user } = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "Connectez-vous pour créer un cahier.", code: "AUTH_REQUIRED" }
  }

  const empty = createEmptyQuestionnaire()
  const payload = buildInProgressPayload(empty, user.email ?? null)

  const { project, error } = await insertBookProject({
    userId: user.id,
    status: BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS,
    questionnaireData: payload,
    paletteId: null,
    styleId: null,
    recipientFirstName: null,
  })

  if (error || !project) {
    return { ok: false, error: error ?? "Création impossible", code: "SAVE" }
  }

  return { ok: true, projectId: project.id }
}

/**
 * Autosave / explicit draft save. Creates a project if needed.
 * Never marks the questionnaire as completed.
 */
export async function saveQuestionnaireDraftAction(
  questionnaireInput: QuestionnaireV1,
): Promise<
  | { ok: true; projectId: string; status: string }
  | AuthResult
  | { ok: false; error: string; code: "SAVE" | "FORBIDDEN" | "COMPLETED" }
> {
  const { user } = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "Connectez-vous pour enregistrer votre brouillon.", code: "AUTH_REQUIRED" }
  }

  const q = withDerivedAudienceFields(questionnaireInput)
  const slim = stripPhotoPreviews(q)
  const withId = { ...slim }
  const { paletteId, styleId } = resolveDbPaletteStyle(q)
  const payload = buildInProgressPayload(withId, user.email ?? null)

  if (q.draftProjectId) {
    const existing = await getBookProject(q.draftProjectId)
    if (!existing) {
      return { ok: false, error: "Projet introuvable.", code: "SAVE" }
    }
    if (existing.user_id && existing.user_id !== user.id) {
      return { ok: false, error: "Ce projet ne vous appartient pas.", code: "FORBIDDEN" }
    }
    if (isQuestionnaireCompleted(existing.status)) {
      return {
        ok: false,
        error: "Ce questionnaire est déjà terminé.",
        code: "COMPLETED",
      }
    }

    const { project, error } = await updateBookProject(existing.id, {
      status: BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS,
      questionnaireData: {
        ...payload,
        questionnaire: { ...withId, draftProjectId: existing.id },
      },
      paletteId,
      styleId,
      recipientFirstName: recipientFirstName(q),
    })
    if (error || !project) {
      return { ok: false, error: error ?? "Enregistrement impossible", code: "SAVE" }
    }
    return { ok: true, projectId: project.id, status: project.status }
  }

  const { project, error } = await insertBookProject({
    userId: user.id,
    status: BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS,
    questionnaireData: payload,
    paletteId,
    styleId,
    recipientFirstName: recipientFirstName(q),
  })
  if (error || !project) {
    return { ok: false, error: error ?? "Création impossible", code: "SAVE" }
  }

  // Persist draftProjectId into questionnaire_data
  await updateBookProject(project.id, {
    questionnaireData: {
      ...payload,
      questionnaire: { ...withId, draftProjectId: project.id },
    },
  })

  return { ok: true, projectId: project.id, status: BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS }
}

/**
 * After login: attach a localStorage draft to the user account without data loss.
 */
export async function claimLocalDraftAction(
  questionnaireInput: QuestionnaireV1,
): Promise<
  | { ok: true; projectId: string; questionnaire: QuestionnaireV1 }
  | AuthResult
  | { ok: false; error: string; code: "SAVE" }
> {
  const result = await saveQuestionnaireDraftAction(questionnaireInput)
  if (!result.ok) {
    if (result.code === "AUTH_REQUIRED") return result
    return { ok: false, error: result.error, code: "SAVE" }
  }
  const q = {
    ...withDerivedAudienceFields(questionnaireInput),
    draftProjectId: result.projectId,
  }
  return { ok: true, projectId: result.projectId, questionnaire: q }
}

export async function deleteBookProjectAction(
  projectId: string,
): Promise<{ ok: true } | AuthResult | { ok: false; error: string; code: "SAVE" | "FORBIDDEN" }> {
  const { user } = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "Non authentifié", code: "AUTH_REQUIRED" }
  }
  const existing = await getBookProject(projectId)
  if (!existing) return { ok: false, error: "Projet introuvable", code: "SAVE" }
  if (existing.user_id !== user.id) {
    return { ok: false, error: "Accès refusé", code: "FORBIDDEN" }
  }
  const { ok, error } = await deleteBookProject(projectId)
  if (!ok) return { ok: false, error: error ?? "Suppression impossible", code: "SAVE" }
  return { ok: true }
}

export type SubmitQuestionnaireResult =
  | {
      ok: true
      projectId: string
      profile: BookProfileV1
      richnessLevel: string
    }
  | { ok: false; error: string; code?: "AUTH_REQUIRED" | "VALIDATION" | "INSUFFICIENT" | "SAVE" | "FORBIDDEN" }

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
    questionnaire: { ...slim, draftProjectId: q.draftProjectId },
    bookProfile: profile,
    richness,
    ownerEmail: user.email ?? null,
  }

  const existingId = q.draftProjectId
  let projectId: string

  if (existingId) {
    const existing = await getBookProject(existingId)
    if (existing?.user_id && existing.user_id !== user.id) {
      return { ok: false, error: "Ce projet ne vous appartient pas.", code: "FORBIDDEN" }
    }
    const { project, error } = await updateBookProject(existingId, {
      status: BOOK_STATUS.QUESTIONNAIRE_COMPLETED,
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
      status: BOOK_STATUS.QUESTIONNAIRE_COMPLETED,
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
 * Register a book_photos row after a successful client-side Storage upload.
 * The file itself must already exist in the private book-photos bucket.
 * Payload stays tiny (metadata only) — never accepts file bytes / base64.
 */
export async function registerBookPhotoAction(input: {
  projectId: string
  storagePath: string
  caption?: string
  anecdote?: string
  useAuthorized: boolean
}): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const { user } = await getCurrentUser()
  if (!user) return { ok: false, error: toUserFacingPhotoError("Non authentifié") }

  const existing = await getBookProject(input.projectId)
  if (!existing || existing.user_id !== user.id) {
    return { ok: false, error: toUserFacingPhotoError("Projet inaccessible") }
  }

  if (
    !assertPhotoBelongsToProject({
      storagePath: input.storagePath,
      userId: user.id,
      projectId: input.projectId,
    })
  ) {
    return { ok: false, error: toUserFacingPhotoError("Chemin photo invalide") }
  }

  const supabase = await createClient()
  const { error: missingError } = await supabase.storage
    .from(BOOK_PHOTOS_BUCKET)
    .createSignedUrl(input.storagePath, 60)

  if (missingError) {
    return { ok: false, error: toUserFacingPhotoError(missingError.message) }
  }

  const { error: rowError } = await insertBookPhoto({
    bookProjectId: input.projectId,
    storagePath: input.storagePath,
    caption: input.caption?.trim() || null,
    anecdote: input.anecdote?.trim() || null,
    useAuthorized: input.useAuthorized,
  })

  if (rowError) return { ok: false, error: toUserFacingPhotoError(rowError) }
  return { ok: true, storagePath: input.storagePath }
}

/**
 * Delete Storage object + book_photos row for a photo the user owns.
 */
export async function deleteBookPhotoAction(input: {
  projectId: string
  storagePath: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getCurrentUser()
  if (!user) return { ok: false, error: toUserFacingPhotoError("Non authentifié") }

  const existing = await getBookProject(input.projectId)
  if (!existing || existing.user_id !== user.id) {
    return { ok: false, error: toUserFacingPhotoError("Projet inaccessible") }
  }

  if (
    !assertPhotoBelongsToProject({
      storagePath: input.storagePath,
      userId: user.id,
      projectId: input.projectId,
    })
  ) {
    return { ok: false, error: toUserFacingPhotoError("Chemin photo invalide") }
  }

  const supabase = await createClient()
  await supabase.storage.from(BOOK_PHOTOS_BUCKET).remove([input.storagePath])

  const { error } = await deleteBookPhotoByStoragePath({
    bookProjectId: input.projectId,
    storagePath: input.storagePath,
  })
  if (error) return { ok: false, error: toUserFacingPhotoError(error) }
  return { ok: true }
}

export async function loadProjectQuestionnaireAction(
  projectId: string,
): Promise<
  | { ok: true; questionnaire: QuestionnaireV1; status: string }
  | AuthResult
  | { ok: false; error: string; code: "SAVE" | "FORBIDDEN" }
> {
  const { user } = await getCurrentUser()
  if (!user) return { ok: false, error: "Non authentifié", code: "AUTH_REQUIRED" }
  const project = await getBookProject(projectId)
  if (!project) return { ok: false, error: "Projet introuvable", code: "SAVE" }
  if (project.user_id !== user.id) {
    return { ok: false, error: "Accès refusé", code: "FORBIDDEN" }
  }
  const { questionnaire } = parseQuestionnairePayload(project.questionnaire_data)
  const base = questionnaire
    ? { ...questionnaire, draftProjectId: projectId }
    : { ...createEmptyQuestionnaire(), draftProjectId: projectId }

  const rows = await getBookPhotos(projectId)
  const signedUrls = await createBookPhotoSignedUrls(rows.map((r) => r.storage_path))
  const merged = mergeBookPhotosIntoQuestionnaire(base, rows, signedUrls)

  return {
    ok: true,
    questionnaire: merged,
    status: project.status,
  }
}

export { isQuestionnaireInProgress, isQuestionnaireCompleted }
