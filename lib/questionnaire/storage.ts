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
    // Drop heavy data URLs if quota risks — keep metadata.
    const slim: QuestionnaireV1 = {
      ...q,
      photos: q.photos.map((p) => ({
        ...p,
        previewDataUrl:
          p.previewDataUrl && p.previewDataUrl.length < 200_000 ? p.previewDataUrl : undefined,
      })),
    }
    window.localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(slim))
  } catch {
    // Quota exceeded: retry without previews.
    try {
      const slim: QuestionnaireV1 = {
        ...q,
        photos: q.photos.map(({ previewDataUrl: _, ...rest }) => rest),
      }
      window.localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(slim))
    } catch {
      /* ignore */
    }
  }
}

export function clearQuestionnaireDraft(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(QUESTIONNAIRE_STORAGE_KEY)
}
