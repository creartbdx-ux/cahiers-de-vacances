import type { AudienceType, BookProfileV1 } from "@/lib/questionnaire/types"
import { normalizeBookProfileCreator } from "@/lib/questionnaire/creator"

export type PersonalAddressMode =
  | "SECOND_PERSON" // s'adresser au lecteur (ME / OTHER)
  | "PLURAL_YOU" // vous (duo/groupe participants)
  | "THIRD_NEUTRAL" // formulations neutres

/**
 * Explicit editorial audience for personal pages.
 * Derived only from BookProfile — never invented.
 */
export interface PersonalEditorialAudienceContext {
  audience: AudienceType
  creatorIsParticipant: boolean
  /** Creator first name when known from profile.creator — never from email. */
  creatorName: string | null
  /** Stable participant id when creator is a participant. */
  creatorParticipantId: string | null
  recipientNames: string[]
  participantNames: string[]
  addressMode: PersonalAddressMode
}

/**
 * Resolve creator display name from BookProfile.creator (or legacy ME participant).
 * Never invents; never uses email / auth metadata.
 */
function resolveCreatorName(profile: BookProfileV1): string | null {
  return normalizeBookProfileCreator(profile).firstName
}

export function buildPersonalEditorialAudienceContext(
  profile: BookProfileV1,
  options?: { creatorName?: string | null },
): PersonalEditorialAudienceContext {
  const participantNames = profile.participants
    .map((p) => p.firstName.trim())
    .filter(Boolean)
  const recipientNames = [...participantNames]
  const normalized = normalizeBookProfileCreator(profile)
  // Explicit override only for tests / lab — never invent from auth in callers.
  const creatorName =
    options?.creatorName !== undefined
      ? options.creatorName?.trim() || null
      : resolveCreatorName(profile)

  let addressMode: PersonalAddressMode = "SECOND_PERSON"
  if (profile.audience === "DUO" || profile.audience === "GROUP") {
    addressMode = profile.creatorIsParticipant ? "PLURAL_YOU" : "THIRD_NEUTRAL"
  }

  return {
    audience: profile.audience,
    creatorIsParticipant: profile.creatorIsParticipant,
    creatorName,
    creatorParticipantId: normalized.participantId,
    recipientNames,
    participantNames,
    addressMode,
  }
}
