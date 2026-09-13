import type { QuestionnaireV1 } from "./types"

export const QUESTIONNAIRE_STORAGE_KEY = "cahiers.questionnaire.v1"

export function loadQuestionnaireDraft(): QuestionnaireV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(QUESTIONNAIRE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as QuestionnaireV1
    if (parsed?.schemaVersion !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function saveQuestionnaireDraft(q: QuestionnaireV1): void {
  if (typeof window === "undefined") return
  try {
    // Never persist blob:/huge previews as if they were server-backed photos.
    // Keep storagePath + metadata only; local files live in the in-memory registry.
    const slim: QuestionnaireV1 = {
      ...q,
      photos: q.photos.map(({ previewDataUrl: _, uploadError: __, ...rest }) => ({
        ...rest,
        uploadStatus: rest.storagePath
          ? ("persisted" as const)
          : rest.uploadStatus === "error"
            ? ("error" as const)
            : ("local" as const),
      })),
    }
    window.localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(slim))
  } catch {
    /* ignore quota */
  }
}

export function clearQuestionnaireDraft(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(QUESTIONNAIRE_STORAGE_KEY)
}
