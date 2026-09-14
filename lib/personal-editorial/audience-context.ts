import type { AudienceType, BookProfileV1 } from "@/lib/questionnaire/types"

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
  /** Creator first name when known from profile (often absent for OTHER_PERSON). */
  creatorName: string | null
  recipientNames: string[]
  participantNames: string[]
  addressMode: PersonalAddressMode
}

/**
 * Resolve creator display name if present in participants or questionnaire meta.
 * OTHER_PERSON: creator is typically NOT in participants — may be null.
 */
function resolveCreatorName(profile: BookProfileV1): string | null {
  // Optional convention: some profiles store creator as non-participant metadata — none in V1.
  // When creatorIsParticipant, first participant is often the creator for ME.
  if (profile.audience === "ME" && profile.participants[0]?.firstName.trim()) {
    return profile.participants[0]!.firstName.trim()
  }
  return null
}

export function buildPersonalEditorialAudienceContext(
  profile: BookProfileV1,
  options?: { creatorName?: string | null },
): PersonalEditorialAudienceContext {
  const participantNames = profile.participants
    .map((p) => p.firstName.trim())
    .filter(Boolean)
  const recipientNames = [...participantNames]
  const creatorName =
    options?.creatorName?.trim() || resolveCreatorName(profile)

  let addressMode: PersonalAddressMode = "SECOND_PERSON"
  if (profile.audience === "DUO" || profile.audience === "GROUP") {
    addressMode = profile.creatorIsParticipant ? "PLURAL_YOU" : "THIRD_NEUTRAL"
  }

  return {
    audience: profile.audience,
    creatorIsParticipant: profile.creatorIsParticipant,
    creatorName,
    recipientNames,
    participantNames,
    addressMode,
  }
}
