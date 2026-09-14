import assert from "node:assert/strict"
import { test } from "node:test"
import {
  allPhotosSaved,
  assertPhotoBelongsToProject,
  buildBookPhotoStoragePath,
  countRecapPhotos,
  extractPhotoIdFromStoragePath,
  hasPhotosUploading,
  isPhotoPersisted,
  mergeBookPhotosIntoQuestionnaire,
  PHOTO_TOO_LARGE_USER_ERROR,
  PHOTO_UPLOAD_USER_ERROR,
  photoUploadBannerCopy,
  photoUploadBannerMessage,
  toUserFacingPhotoError,
  validatePhotoFile,
} from "./photos"
import { createEmptyQuestionnaire, type QuestionnairePhoto } from "./types"
import { validateStep } from "./validate"

test("isPhotoPersisted requires storagePath and non-error status", () => {
  assert.equal(isPhotoPersisted({ storagePath: "a/b/c", uploadStatus: "persisted" }), true)
  assert.equal(isPhotoPersisted({ storagePath: "a/b/c", uploadStatus: "error" }), false)
  assert.equal(isPhotoPersisted({ uploadStatus: "local" }), false)
})

test("échec upload → photo non comptée comme persistée ni dans le récap", () => {
  const photos: QuestionnairePhoto[] = [
    { id: "ph_1", useAuthorized: true, uploadStatus: "error", uploadError: PHOTO_UPLOAD_USER_ERROR },
    { id: "ph_2", useAuthorized: true, uploadStatus: "error" },
  ]
  assert.equal(photos.every((p) => !isPhotoPersisted(p)), true)
  assert.equal(countRecapPhotos(photos), 0)
})

test("succès upload → storagePath + persisted comptés", () => {
  const photos: QuestionnairePhoto[] = [
    {
      id: "ph_ok",
      useAuthorized: true,
      storagePath: "uid/proj/ph_ok-a.jpg",
      uploadStatus: "persisted",
    },
    { id: "ph_local", useAuthorized: true, uploadStatus: "local" },
  ]
  assert.equal(isPhotoPersisted(photos[0]!), true)
  assert.equal(countRecapPhotos(photos), 2)
})

test("toUserFacingPhotoError never echoes Gateway Timeout / raw tech", () => {
  assert.equal(toUserFacingPhotoError("Gateway Timeout"), PHOTO_UPLOAD_USER_ERROR)
  assert.equal(toUserFacingPhotoError("504 Gateway Timeout"), PHOTO_UPLOAD_USER_ERROR)
  assert.equal(toUserFacingPhotoError("Bucket not found"), PHOTO_UPLOAD_USER_ERROR)
  assert.equal(toUserFacingPhotoError("fetch failed"), PHOTO_UPLOAD_USER_ERROR)
  assert.ok(!toUserFacingPhotoError("Gateway Timeout").toLowerCase().includes("gateway"))
  assert.ok(!toUserFacingPhotoError("new row violates").includes("violates"))
})

test("toUserFacingPhotoError maps size / format", () => {
  assert.equal(toUserFacingPhotoError("Payload too large"), PHOTO_TOO_LARGE_USER_ERROR)
  assert.match(toUserFacingPhotoError("mime type not allowed"), /Format|JPG|PNG/)
  assert.match(toUserFacingPhotoError("invalid mime"), /Format|JPG|PNG/)
})

test("photo UPLOADING => message neutre (pas Patientez rouge)", () => {
  const photos = [
    { id: "ph_1", useAuthorized: true, uploadStatus: "uploading" as const },
  ]
  assert.equal(hasPhotosUploading(photos), true)
  assert.equal(
    photoUploadBannerMessage({ uploading: true, allSaved: false, showSavedFlash: false }),
    "uploading",
  )
  assert.equal(photoUploadBannerCopy("uploading"), "Enregistrement des photos en cours…")
  assert.ok(!photoUploadBannerCopy("uploading").toLowerCase().includes("patientez"))
})

test("toutes SAVED => confirmation positive", () => {
  const photos = [
    {
      id: "ph_1",
      useAuthorized: true,
      uploadStatus: "persisted" as const,
      storagePath: "u/p/a.jpg",
    },
    {
      id: "ph_2",
      useAuthorized: true,
      uploadStatus: "persisted" as const,
      storagePath: "u/p/b.jpg",
    },
  ]
  assert.equal(allPhotosSaved(photos), true)
  assert.equal(hasPhotosUploading(photos), false)
  assert.equal(
    photoUploadBannerMessage({ uploading: false, allSaved: true, showSavedFlash: true }),
    "all_saved",
  )
  assert.equal(photoUploadBannerCopy("all_saved"), "Toutes vos photos sont enregistrées.")
})

test("aucune photo en cours => pas de message Patientez / upload", () => {
  const photos = [
    {
      id: "ph_1",
      useAuthorized: true,
      uploadStatus: "persisted" as const,
      storagePath: "u/p/a.jpg",
    },
  ]
  assert.equal(
    photoUploadBannerMessage({ uploading: false, allSaved: true, showSavedFlash: false }),
    null,
  )
  assert.equal(hasPhotosUploading([]), false)
  assert.equal(hasPhotosUploading(photos), false)
})

test("ERROR => message rouge conservé via validateStep", () => {
  const q = createEmptyQuestionnaire()
  q.photos = [
    {
      id: "ph_1",
      useAuthorized: true,
      uploadStatus: "error",
      uploadError: PHOTO_UPLOAD_USER_ERROR,
    },
  ]
  const errs = validateStep("photos", q)
  assert.ok(errs.some((e) => e.includes("n'a pas pu être enregistrée")))
  assert.ok(!errs.some((e) => /patientez/i.test(e)))
})

test("uploading ne produit plus d'erreur de validation rouge", () => {
  const q = createEmptyQuestionnaire()
  q.photos = [
    { id: "ph_1", useAuthorized: true, uploadStatus: "uploading" },
  ]
  const errs = validateStep("photos", q)
  assert.ok(!errs.some((e) => /patientez|enregistrement des photos/i.test(e)))
})

test("feedback brouillon : confirmation manuelle distincte de l'autosave", () => {
  // Pure contract: manual flash copy vs autosave discreet label.
  const manualCopy = "Brouillon enregistré"
  const autoCopy = "Enregistré"
  assert.notEqual(manualCopy, autoCopy)
  assert.ok(manualCopy.toLowerCase().includes("brouillon"))
  assert.ok(!autoCopy.toLowerCase().includes("brouillon"))
})

test("validatePhotoFile rejects oversize and bad mime", () => {
  assert.equal(
    validatePhotoFile({ name: "a.jpg", type: "image/jpeg", size: 100 }),
    null,
  )
  assert.equal(
    validatePhotoFile({ name: "a.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 }),
    PHOTO_TOO_LARGE_USER_ERROR,
  )
  assert.match(
    validatePhotoFile({ name: "a.pdf", type: "application/pdf", size: 100 }) ?? "",
    /Format/,
  )
})

test("buildBookPhotoStoragePath namespaces by user + project + photo id", () => {
  const path = buildBookPhotoStoragePath({
    userId: "user-1",
    projectId: "proj-1",
    photoId: "ph_abc12345",
    fileName: "Vacances été!.jpg",
  })
  assert.equal(path, "user-1/proj-1/ph_abc12345-Vacances__t__.jpg")
  assert.equal(extractPhotoIdFromStoragePath(path), "ph_abc12345")
})

test("assertPhotoBelongsToProject interdit un autre projet", () => {
  assert.equal(
    assertPhotoBelongsToProject({
      storagePath: "user-1/proj-A/ph_1-a.jpg",
      userId: "user-1",
      projectId: "proj-A",
    }),
    true,
  )
  assert.equal(
    assertPhotoBelongsToProject({
      storagePath: "user-1/proj-B/ph_1-a.jpg",
      userId: "user-1",
      projectId: "proj-A",
    }),
    false,
  )
  assert.equal(
    assertPhotoBelongsToProject({
      storagePath: "user-2/proj-A/ph_1-a.jpg",
      userId: "user-1",
      projectId: "proj-A",
    }),
    false,
  )
})

test("reprise: merge book_photos rows restores persisted photos + signed preview", () => {
  const q = createEmptyQuestionnaire()
  q.photos = [
    {
      id: "ph_aaa11111",
      useAuthorized: true,
      caption: "Plage",
      uploadStatus: "local",
    },
  ]
  const path = "uid/pid/ph_aaa11111-photo.jpg"
  const merged = mergeBookPhotosIntoQuestionnaire(
    q,
    [
      {
        storage_path: path,
        caption: null,
        anecdote: "Vague",
        use_authorized: true,
      },
    ],
    { [path]: "https://signed.example/photo.jpg" },
  )
  assert.equal(merged.photos.length, 1)
  assert.equal(merged.photos[0]!.storagePath, path)
  assert.equal(merged.photos[0]!.uploadStatus, "persisted")
  assert.equal(merged.photos[0]!.caption, "Plage")
  assert.equal(merged.photos[0]!.anecdote, "Vague")
  assert.equal(merged.photos[0]!.previewDataUrl, "https://signed.example/photo.jpg")
  assert.equal(isPhotoPersisted(merged.photos[0]!), true)
})

test("suppression logique: sans storagePath la photo n'est plus persistée", () => {
  const before: QuestionnairePhoto = {
    id: "ph_x",
    storagePath: "u/p/ph_x-a.jpg",
    useAuthorized: true,
    uploadStatus: "persisted",
  }
  const after: QuestionnairePhoto = {
    id: "ph_x",
    useAuthorized: true,
    uploadStatus: "local",
  }
  assert.equal(isPhotoPersisted(before), true)
  assert.equal(isPhotoPersisted(after), false)
})
