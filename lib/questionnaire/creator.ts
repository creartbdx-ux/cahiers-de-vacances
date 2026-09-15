import type { AudienceType, BookProfileCreator, BookProfileV1, QuestionnaireV1 } from "./types"

export type { BookProfileCreator }

/** Resolve creator identity from questionnaire answers — never invents a name. */
export function resolveCreatorFromQuestionnaire(
  q: Pick<
    QuestionnaireV1,
    | "audience"
    | "creatorIsParticipant"
    | "creatorFirstName"
    | "creatorParticipantId"
    | "participants"
  >,
  creatorIsParticipant: boolean,
): BookProfileCreator {
  const audience = q.audience
  if (!audience) {
    return {
      firstName: null,
      isParticipant: creatorIsParticipant,
      participantId: null,
    }
  }

  if (audience === "ME") {
    const p = q.participants[0]
    const name = p?.firstName.trim() || null
    return {
      firstName: name,
      isParticipant: true,
      participantId: p?.id ?? null,
    }
  }

  if (audience === "OTHER_PERSON") {
    const name = q.creatorFirstName?.trim() || null
    return {
      firstName: name,
      isParticipant: false,
      participantId: null,
    }
  }

  // DUO / GROUP
  if (creatorIsParticipant) {
    const id = q.creatorParticipantId?.trim() || null
    const p = id ? q.participants.find((x) => x.id === id) : undefined
    return {
      firstName: p?.firstName.trim() || null,
      isParticipant: true,
      participantId: p ? p.id : null,
    }
  }

  return {
    firstName: q.creatorFirstName?.trim() || null,
    isParticipant: false,
    participantId: null,
  }
}

/**
 * Normalize creator on a BookProfile that may predate the field.
 * Never invents a firstName from email / auth.
 */
export function normalizeBookProfileCreator(
  profile: BookProfileV1,
): BookProfileCreator {
  if (profile.creator) {
    return {
      firstName: profile.creator.firstName?.trim() || null,
      isParticipant: profile.creator.isParticipant,
      participantId: profile.creator.participantId ?? null,
    }
  }

  // Legacy profiles without creator block
  if (profile.audience === "ME" && profile.participants[0]) {
    const p = profile.participants[0]
    return {
      firstName: p.firstName.trim() || null,
      isParticipant: true,
      participantId: p.id,
    }
  }

  return {
    firstName: null,
    isParticipant: profile.creatorIsParticipant,
    participantId: null,
  }
}

export function creatorDisplayName(
  creator: BookProfileCreator | null | undefined,
): string | null {
  return creator?.firstName?.trim() || null
}

/** Audience types where creator first name is collected as free text. */
export function needsCreatorFirstNameField(
  audience: AudienceType | null,
  creatorIsParticipant: boolean | null | undefined,
): boolean {
  if (audience === "OTHER_PERSON") return true
  if (audience === "DUO" || audience === "GROUP") {
    return creatorIsParticipant === false
  }
  return false
}

/** DUO/GROUP when creator is among participants — need which one. */
export function needsCreatorParticipantChoice(
  audience: AudienceType | null,
  creatorIsParticipant: boolean | null | undefined,
): boolean {
  return (
    (audience === "DUO" || audience === "GROUP") && creatorIsParticipant === true
  )
}
