import assert from "node:assert/strict"
import { test } from "node:test"
import {
  clearAllPhotoFiles,
  clearPhotoFile,
  countStoredPhotoFiles,
  ensurePhotoObjectUrl,
  getPhotoFile,
  getPhotoObjectUrl,
  hasPhotoFile,
  setPhotoFile,
  snapshotPhotoFile,
  validateUploadableFile,
} from "./photo-files"
import { decidePhotoUploadAction, sameStoragePathOnRetry } from "./photo-pipeline"
import {
  buildBookPhotoStoragePath,
  isPhotoPersisted,
  PHOTO_UPLOAD_USER_ERROR,
  toUserFacingPhotoError,
  validatePhotoFile,
} from "./photos"
import { buildBookProfile } from "./build-profile"
import { createEmptyQuestionnaire } from "./types"

function jpegFile(bytes: number, name = "a.jpg"): File {
  return new File([new Uint8Array(bytes).fill(7)], name, { type: "image/jpeg" })
}

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

test("vrai File non vide passe validateUploadableFile", () => {
  const file = jpegFile(1200)
  const v = validateUploadableFile(file)
  assert.equal(v.ok, true)
  if (v.ok) {
    assert.equal(v.size, 1200)
    assert.equal(v.mime, "image/jpeg")
  }
})

test("undefined File => PHOTO_FILE_MISSING (pas d'upload)", () => {
  const v = validateUploadableFile(undefined)
  assert.equal(v.ok, false)
  if (!v.ok) assert.equal(v.code, "PHOTO_FILE_MISSING")
})

test("Blob size=0 => PHOTO_FILE_EMPTY", () => {
  const empty = new File([], "empty.jpg", { type: "image/jpeg" })
  const v = validateUploadableFile(empty)
  assert.equal(v.ok, false)
  if (!v.ok) assert.equal(v.code, "PHOTO_FILE_EMPTY")
  assert.ok(validatePhotoFile(empty))
})

test("preview URL n'est pas considérée comme File", () => {
  clearAllPhotoFiles()
  const file = jpegFile(40)
  const url = setPhotoFile("ph_p", file)
  assert.ok(url.startsWith("blob:"))
  assert.equal(validateUploadableFile(url).ok, false)
  assert.equal(hasPhotoFile("ph_p"), true)
  clearAllPhotoFiles()
})

test("3 photos => 3 photoIds / 3 File distincts", async () => {
  clearAllPhotoFiles()
  const files = [jpegFile(10, "1.jpg"), jpegFile(20, "2.jpg"), jpegFile(30, "3.jpg")]
  const ids = ["ph_a", "ph_b", "ph_c"]
  for (let i = 0; i < 3; i++) {
    const snap = await snapshotPhotoFile(files[i]!)
    assert.ok(snap)
    setPhotoFile(ids[i]!, snap!)
  }
  assert.equal(countStoredPhotoFiles(), 3)
  assert.equal(getPhotoFile("ph_a")!.size, 10)
  assert.equal(getPhotoFile("ph_b")!.size, 20)
  assert.equal(getPhotoFile("ph_c")!.size, 30)
  assert.notEqual(getPhotoFile("ph_a"), getPhotoFile("ph_b"))
  clearAllPhotoFiles()
})

test("retry récupère le même File depuis le store", async () => {
  clearAllPhotoFiles()
  const original = jpegFile(500, "retry.jpg")
  const snap = await snapshotPhotoFile(original)
  assert.ok(snap)
  setPhotoFile("ph_retry", snap!)
  const again = getPhotoFile("ph_retry")
  assert.ok(again)
  assert.equal(again!.size, 500)
  assert.equal(again!.name, "retry.jpg")
  assert.equal(
    decidePhotoUploadAction({
      uploadStatus: "error",
      hasLocalFile: hasPhotoFile("ph_retry"),
    }).action,
    "upload_and_register",
  )
  clearAllPhotoFiles()
})

test("retry sans File ne déclenche pas d'upload vide", () => {
  clearAllPhotoFiles()
  assert.equal(hasPhotoFile("ph_gone"), false)
  assert.equal(
    decidePhotoUploadAction({
      uploadStatus: "error",
      hasLocalFile: false,
    }).action,
    "error_missing_file",
  )
})

test("snapshotPhotoFile copie les bytes (File autonome)", async () => {
  const original = jpegFile(64, "snap.jpg")
  const snap = await snapshotPhotoFile(original)
  assert.ok(snap)
  assert.equal(snap!.size, 64)
  assert.notEqual(snap, original)
})

test("metadata / draft slim ne sérialise jamais le File ni le blob preview", () => {
  clearAllPhotoFiles()
  const file = jpegFile(80)
  setPhotoFile("ph_ls", file)
  const photo = {
    id: "ph_ls",
    previewDataUrl: getPhotoObjectUrl("ph_ls"),
    fileName: "ls.jpg",
    useAuthorized: true,
    uploadStatus: "local" as const,
    uploadError: "x",
  }
  // Same stripping as saveQuestionnaireDraft / stripPhotoClientFields
  const { previewDataUrl: _, uploadError: __, ...rest } = photo
  const raw = JSON.stringify({ photos: [rest] })
  assert.ok(!raw.includes("blob:"))
  assert.ok(!raw.includes("uploadError"))
  assert.ok(!("file" in (JSON.parse(raw).photos[0] ?? {})))
  assert.equal(hasPhotoFile("ph_ls"), true) // File remains only in memory map
  clearAllPhotoFiles()
})

test("aucun impact sur upload déjà SAVED", () => {
  assert.equal(
    decidePhotoUploadAction({
      uploadStatus: "persisted",
      storagePath: "u/p/ph_ok-a.jpg",
      hasLocalFile: false,
    }).action,
    "noop_saved",
  )
})

test("preview locale survit : object URL non révoquée tant que File présent", () => {
  clearAllPhotoFiles()
  const file = jpegFile(3, "x.jpg")
  const url1 = setPhotoFile("ph_prev", file)
  assert.ok(url1.startsWith("blob:"))
  assert.equal(getPhotoFile("ph_prev"), file)
  assert.equal(getPhotoObjectUrl("ph_prev"), url1)
  clearPhotoFile("ph_other")
  const ensured = ensurePhotoObjectUrl("ph_prev")
  assert.equal(ensured, url1)
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
