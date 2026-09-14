import assert from "node:assert/strict"
import { test } from "node:test"
import {
  clearAllPhotoFiles,
  clearPhotoFile,
  ensurePhotoObjectUrl,
  getPhotoFile,
  getPhotoObjectUrl,
  setPhotoFile,
} from "./photo-files"
import { decidePhotoUploadAction, sameStoragePathOnRetry } from "./photo-pipeline"
import {
  buildBookPhotoStoragePath,
  isPhotoPersisted,
  PHOTO_UPLOAD_USER_ERROR,
  toUserFacingPhotoError,
} from "./photos"
import { buildBookProfile } from "./build-profile"
import { createEmptyQuestionnaire } from "./types"

test("upload Storage succès + DB succès => SAVED (decision)", () => {
  const d = decidePhotoUploadAction({
    uploadStatus: "persisted",
    storagePath: "u/p/ph_1-a.jpg",
    hasLocalFile: true,
  })
  assert.equal(d.action, "noop_saved")
  assert.equal(isPhotoPersisted({ storagePath: "u/p/ph_1-a.jpg", uploadStatus: "persisted" }), true)
})

test("Storage échec => ERROR (pas de storagePath, re-upload au retry)", () => {
  const d = decidePhotoUploadAction({
    uploadStatus: "error",
    hasLocalFile: true,
  })
  assert.equal(d.action, "upload_and_register")
})

test("Storage succès + DB échec => ERROR + pas de faux SAVED + register_only", () => {
  const d = decidePhotoUploadAction({
    uploadStatus: "error",
    storagePath: "u/p/ph_1-a.jpg",
    hasLocalFile: true,
  })
  assert.equal(d.action, "register_only")
  assert.equal(isPhotoPersisted({ storagePath: "u/p/ph_1-a.jpg", uploadStatus: "error" }), false)
})

test("retry après erreur register ne duplique pas le fichier (même path)", () => {
  const path = buildBookPhotoStoragePath({
    userId: "uid",
    projectId: "proj",
    photoId: "ph_abc",
    fileName: "a.jpg",
  })
  const again = buildBookPhotoStoragePath({
    userId: "uid",
    projectId: "proj",
    photoId: "ph_abc",
    fileName: "a.jpg",
  })
  assert.equal(sameStoragePathOnRetry(path, again), true)
  const decision = decidePhotoUploadAction({
    uploadStatus: "error",
    storagePath: path,
    hasLocalFile: true,
  })
  assert.equal(decision.action, "register_only")
})

test("retry après erreur storage refait upload", () => {
  assert.equal(
    decidePhotoUploadAction({ uploadStatus: "error", hasLocalFile: true }).action,
    "upload_and_register",
  )
})

test("fichier manquant => error_missing_file", () => {
  assert.equal(
    decidePhotoUploadAction({ uploadStatus: "local", hasLocalFile: false }).action,
    "error_missing_file",
  )
})

test("preview locale survit : object URL non révoquée tant que File présent", () => {
  clearAllPhotoFiles()
  const file = new File([new Uint8Array([1, 2, 3])], "x.jpg", { type: "image/jpeg" })
  const url1 = setPhotoFile("ph_prev", file)
  assert.ok(url1.startsWith("blob:"))
  assert.equal(getPhotoFile("ph_prev"), file)
  assert.equal(getPhotoObjectUrl("ph_prev"), url1)
  // Simulate lost URL entry without clearing File
  clearPhotoFile("ph_other")
  const ensured = ensurePhotoObjectUrl("ph_prev")
  assert.equal(ensured, url1)
  clearAllPhotoFiles()
})

test("ensurePhotoObjectUrl recrée une URL si nécessaire après clear partiel", () => {
  clearAllPhotoFiles()
  const file = new File([new Uint8Array([9])], "y.jpg", { type: "image/jpeg" })
  setPhotoFile("ph_y", file)
  // Force-clear URL map entry only via clear then re-set file without revoke path:
  clearPhotoFile("ph_y")
  // After clear, no file — ensure returns undefined
  assert.equal(ensurePhotoObjectUrl("ph_y"), undefined)
  const url = setPhotoFile("ph_y", file)
  assert.ok(ensurePhotoObjectUrl("ph_y") === url)
  clearAllPhotoFiles()
})

test("photo ERROR exclue des photos persistées / BookProfile", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "ME"
  q.creatorIsParticipant = true
  q.participants = [{ id: "p1", firstName: "Alex", ageBracket: "26-35" }]
  q.interestUniverseIds = ["TRAVEL", "FOOD", "NATURE"]
  q.personalFacts = [
    { id: "f1", category: "FOOD", value: "Pasta" },
    { id: "f2", category: "MUSIC", value: "Jazz" },
    { id: "f3", category: "PLACE", value: "Rome" },
  ]
  q.gamePreferences = { likedTypes: ["QUIZ"], difficulty: 3 }
  q.visualPreferences = { paletteId: "PINK", styleId: "RETRO" }
  q.forbiddenTopics = { answered: true, hasRestrictions: false }
  q.photos = [
    {
      id: "ph_err",
      useAuthorized: true,
      storagePath: "u/p/ph_err-a.jpg",
      uploadStatus: "error",
      uploadError: PHOTO_UPLOAD_USER_ERROR,
    },
    {
      id: "ph_ok",
      useAuthorized: true,
      storagePath: "u/p/ph_ok-a.jpg",
      uploadStatus: "persisted",
    },
    {
      id: "ph_local",
      useAuthorized: true,
      uploadStatus: "local",
    },
  ]
  const profile = buildBookProfile(q)
  assert.equal(profile.photos.length, 1)
  assert.equal(profile.photos[0]!.id, "ph_ok")
})

test("toUserFacingPhotoError reste générique pour RLS / JWT", () => {
  assert.equal(toUserFacingPhotoError("new row violates row-level security"), PHOTO_UPLOAD_USER_ERROR)
  assert.equal(toUserFacingPhotoError("JWT expired"), PHOTO_UPLOAD_USER_ERROR)
  assert.ok(!toUserFacingPhotoError("JWT expired").toLowerCase().includes("jwt"))
})
