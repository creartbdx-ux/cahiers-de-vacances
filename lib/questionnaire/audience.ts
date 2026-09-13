import type { AudienceType, QuestionnaireV1 } from "./types"

/** Derive creatorIsParticipant from audience when not explicitly set. */
export function deriveCreatorIsParticipant(
  audience: AudienceType,
  explicit: boolean | null | undefined,
): boolean {
  if (audience === "ME") return true
  if (audience === "OTHER_PERSON") return false
  if (explicit === true || explicit === false) return explicit
  return false
}

export function applyAudienceDefaults(q: QuestionnaireV1): QuestionnaireV1 {
  if (!q.audience) return q
  if (q.audience === "ME") {
    return { ...q, creatorIsParticipant: true }
  }
  if (q.audience === "OTHER_PERSON") {
    return { ...q, creatorIsParticipant: false }
  }
  return q
}
