/**
 * Pure helpers for photo upload retry / stage decisions (testable without network).
 */

export type PhotoUploadStageDecision =
  | { action: "noop_saved"; storagePath: string }
  | { action: "register_only"; storagePath: string }
  | { action: "upload_and_register" }
  | { action: "error_missing_file" }

export function decidePhotoUploadAction(input: {
  uploadStatus?: string
  storagePath?: string
  hasLocalFile: boolean
}): PhotoUploadStageDecision {
  if (input.storagePath && input.uploadStatus === "persisted") {
    return { action: "noop_saved", storagePath: input.storagePath }
  }
  // Storage succeeded earlier but DB register failed — retry must not re-upload.
  if (input.storagePath && input.uploadStatus === "error") {
    return { action: "register_only", storagePath: input.storagePath }
  }
  if (input.storagePath && input.uploadStatus === "uploading") {
    return { action: "register_only", storagePath: input.storagePath }
  }
  if (!input.hasLocalFile) {
    return { action: "error_missing_file" }
  }
  return { action: "upload_and_register" }
}

/** Same storage path on retry → no duplicate objects when upsert is used. */
export function sameStoragePathOnRetry(a: string, b: string): boolean {
  return a === b
}
