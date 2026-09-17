/**
 * Book project lifecycle helpers (pure — no DB I/O).
 */

import { buildJourneySteps } from "@/lib/questionnaire/journey"
import type { BookProfileV1, QuestionnaireV1, RichnessLevel } from "@/lib/questionnaire/types"

export const BOOK_STATUS = {
  DRAFT: "DRAFT",
  QUESTIONNAIRE_IN_PROGRESS: "QUESTIONNAIRE_IN_PROGRESS",
  QUESTIONNAIRE_COMPLETED: "QUESTIONNAIRE_COMPLETED",
} as const

export type BookProjectStatus = (typeof BOOK_STATUS)[keyof typeof BOOK_STATUS]

/** Days without update before admin marks a project inactive (display-only). */
export const INACTIVE_AFTER_DAYS = 14

export type AdminProjectFilter = "all" | "in_progress" | "completed" | "inactive"

export function isBookProjectStatus(value: string): value is BookProjectStatus {
  return (
    value === BOOK_STATUS.DRAFT ||
    value === BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS ||
    value === BOOK_STATUS.QUESTIONNAIRE_COMPLETED
  )
}

export function isQuestionnaireInProgress(status: string): boolean {
  return status === BOOK_STATUS.DRAFT || status === BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS
}

export function isQuestionnaireCompleted(status: string): boolean {
  return status === BOOK_STATUS.QUESTIONNAIRE_COMPLETED
}

export function isInactiveByUpdatedAt(
  updatedAt: string,
  nowMs: number = Date.now(),
  afterDays: number = INACTIVE_AFTER_DAYS,
): boolean {
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return false
  return nowMs - t >= afterDays * 24 * 60 * 60 * 1000
}

export function statusLabelFr(status: string): string {
  switch (status) {
    case BOOK_STATUS.DRAFT:
      return "Brouillon"
    case BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS:
      return "Questionnaire en cours"
    case BOOK_STATUS.QUESTIONNAIRE_COMPLETED:
      return "Questionnaire terminé"
    default:
      return status
  }
}

export function questionnaireProgressPercent(q: QuestionnaireV1 | null): number {
  if (!q?.audience) return 0
  const steps = buildJourneySteps(q.audience, q.creatorIsParticipant).filter((s) => s !== "recap")
  if (!steps.length) return 0
  // Approximate: count answered structural steps
  let done = 0
  for (const step of steps) {
    if (step === "audience" && q.audience) done += 1
    else if (step === "participants" && q.participants.some((p) => p.firstName.trim())) done += 1
    else if (
      step === "personality" &&
      (Object.values(q.personality.traitsByParticipantId).some((t) => t.length > 0) ||
        Boolean(q.personality.duoDescription?.trim()) ||
        (q.personality.groupTraits?.length ?? 0) > 0)
    ) {
      done += 1
    } else if (step === "interests" && q.interestUniverseIds.length >= 1) done += 1
    else if (step === "deepIntro") done += 0.5
    else if (step === "closePeople") done += 0.25
    else if (step === "lifeContext") done += 0.25
    else if (step === "personalFacts" && q.personalFacts.filter((f) => f.value.trim()).length >= 1) {
      done += 0.5
    } else if (step === "game" && q.gamePreferences.likedTypes?.length && q.gamePreferences.difficulty) {
      done += 1
    } else if (step === "forbidden" && q.forbiddenTopics?.answered) done += 1
    else if (
      step === "color" &&
      q.visualPreferences.paletteId
    ) {
      done += 1
    } else if (step === "style" && q.visualPreferences.styleId) done += 1
    else if (step === "memories") done += 0.5
    else if (step === "photos") done += 0.5
    else if (step === "insideJokes") done += 0.5
    else if (step === "finale") done += 0.5
  }
  return Math.min(100, Math.round((done / steps.length) * 100))
}

export function projectDisplayTitle(
  q: QuestionnaireV1 | null,
  profile: BookProfileV1 | null,
  recipientFirstName: string | null,
): string {
  if (q?.audience === "GROUP" && q.groupName?.trim()) return q.groupName.trim()
  if (profile?.audience === "GROUP" && profile.groupName?.trim()) return profile.groupName.trim()
  const names =
    (q?.participants ?? profile?.participants ?? [])
      .map((p) => p.firstName)
      .filter(Boolean)
      .join(" & ") || recipientFirstName
  return names?.trim() || "Cahier sans titre"
}

export function canUseInEditorialLab(input: {
  status: string
  profile: BookProfileV1 | null
  richnessLevel?: RichnessLevel | null
}): boolean {
  if (!isQuestionnaireCompleted(input.status)) return false
  if (!input.profile) return false
  // Legacy INSUFFICIENT no longer blocks — CORE-complete profiles are lab-ready
  return true
}

export function matchesAdminFilter(
  filter: AdminProjectFilter,
  status: string,
  updatedAt: string,
  nowMs: number = Date.now(),
): boolean {
  const inactive = isInactiveByUpdatedAt(updatedAt, nowMs)
  switch (filter) {
    case "all":
      return true
    case "in_progress":
      return isQuestionnaireInProgress(status) && !inactive
    case "completed":
      return isQuestionnaireCompleted(status)
    case "inactive":
      return inactive && !isQuestionnaireCompleted(status)
    default:
      return true
  }
}

export function parseQuestionnairePayload(data: Record<string, unknown>): {
  questionnaire: QuestionnaireV1 | null
  profile: BookProfileV1 | null
  richnessLevel: RichnessLevel | null
  ownerEmail: string | null
} {
  const questionnaire =
    data.questionnaire && typeof data.questionnaire === "object"
      ? (data.questionnaire as QuestionnaireV1)
      : data.schemaVersion === 1
        ? (data as unknown as QuestionnaireV1)
        : null
  const profile =
    data.bookProfile && typeof data.bookProfile === "object"
      ? (data.bookProfile as BookProfileV1)
      : null
  const richness =
    data.richness && typeof data.richness === "object"
      ? (data.richness as { level?: RichnessLevel })
      : null
  const ownerEmail = typeof data.ownerEmail === "string" ? data.ownerEmail : null
  return {
    questionnaire,
    profile,
    richnessLevel: richness?.level ?? null,
    ownerEmail,
  }
}

/**
 * Build questionnaire_data for DRAFT / IN_PROGRESS saves.
 * Does not invent a BookProfile until completion.
 */
export function buildInProgressPayload(
  q: QuestionnaireV1,
  ownerEmail: string | null,
): Record<string, unknown> {
  return {
    questionnaire: {
      ...q,
      photos: q.photos.map(({ previewDataUrl: _, ...rest }) => rest),
    },
    ownerEmail,
    savedAt: new Date().toISOString(),
  }
}
