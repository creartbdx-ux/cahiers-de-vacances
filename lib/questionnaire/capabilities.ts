/**
 * Central personalization capabilities for Blueprint / editorial selection.
 * Prefer this over ad-hoc profile.memories.length checks.
 */

import type {
  BookProfileV1,
  PersonalizationDepth,
  QuestionnaireV1,
  RichnessLevel,
} from "./types"

export type { PersonalizationDepth }

export interface PersonalizationCapabilities {
  hasRecipientName: boolean
  hasAge: boolean
  hasBirthDate: boolean
  hasTraits: boolean
  hasInterests: boolean
  hasClosePeople: boolean
  hasFamilyContext: boolean
  hasPersonalFacts: boolean
  hasMemories: boolean
  hasInsideJokes: boolean
  hasPhotos: boolean
  depth: PersonalizationDepth
}

/** Map legacy stored levels onto the product depth model. */
export function normalizePersonalizationDepth(
  level: RichnessLevel | string | null | undefined,
): PersonalizationDepth {
  if (level === "RICH") return "RICH"
  if (level === "PERSONALIZED" || level === "ENOUGH") return "PERSONALIZED"
  // LIGHT, INSUFFICIENT, unknown → LIGHT (never "bad quality")
  return "LIGHT"
}

function participantHasAge(p: {
  ageBracket?: string
  approximateAge?: number
  birthDate?: string
}): boolean {
  if (p.birthDate?.trim()) return true
  if (typeof p.approximateAge === "number" && p.approximateAge > 0) return true
  return Boolean(p.ageBracket)
}

function countTraits(profile: BookProfileV1): number {
  const fromIndividual = profile.individualProfiles.reduce(
    (n, ip) => n + (ip.traits?.length ?? 0),
    0,
  )
  if (fromIndividual > 0) return fromIndividual
  return (
    (profile.sharedProfile.groupTraits?.length ?? 0) +
    (profile.sharedProfile.duoDynamics?.length ?? 0)
  )
}

function hasLifeContext(ctx: BookProfileV1["lifeContext"] | QuestionnaireV1["lifeContext"]): boolean {
  if (!ctx) return false
  return (
    ctx.hasChildren === true ||
    ctx.inCouple === true ||
    ctx.hasFamilyNearby === true ||
    ctx.hasPet === true ||
    (ctx.livingSituation != null && ctx.livingSituation !== "UNKNOWN") ||
    Boolean(ctx.notes?.trim()) ||
    (ctx.childrenNames?.some((n) => n.trim()) ?? false) ||
    (ctx.petNames?.some((n) => n.trim()) ?? false)
  )
}

function usablePhotos(
  photos: Array<{ useAuthorized?: boolean; storagePath?: string; uploadStatus?: string }>,
): number {
  return photos.filter((p) => {
    if (p.uploadStatus === "error") return false
    if (p.useAuthorized === false) return false
    return true
  }).length
}

export function computePersonalizationCapabilities(
  profile: BookProfileV1,
): PersonalizationCapabilities {
  const primary = profile.participants[0]
  const hasRecipientName = Boolean(primary?.firstName?.trim())
  const hasAge = profile.participants.some(participantHasAge)
  const hasBirthDate = profile.participants.some((p) => Boolean(p.birthDate?.trim()))
  const hasTraits = countTraits(profile) > 0
  const hasInterests =
    (profile.sharedProfile.interestUniverseIds?.length ?? 0) > 0 ||
    Boolean(profile.sharedProfile.interestFreeText?.trim())
  const hasClosePeople = (profile.closePeople ?? []).some((c) => c.firstName.trim())
  const hasFamilyContext = hasLifeContext(profile.lifeContext)
  const hasPersonalFacts = (profile.personalFacts ?? []).some((f) => f.value.trim())
  const hasMemories = (profile.memories ?? []).some((m) => m.text.trim())
  const hasInsideJokes = (profile.insideJokes ?? []).some((j) => j.text.trim())
  const hasPhotos = usablePhotos(profile.photos ?? []) > 0

  let depth: PersonalizationDepth = "LIGHT"
  if (hasMemories || hasInsideJokes || hasPhotos) {
    depth = "RICH"
  } else if (hasClosePeople || hasFamilyContext || hasPersonalFacts) {
    depth = "PERSONALIZED"
  }

  return {
    hasRecipientName,
    hasAge,
    hasBirthDate,
    hasTraits,
    hasInterests,
    hasClosePeople,
    hasFamilyContext,
    hasPersonalFacts,
    hasMemories,
    hasInsideJokes,
    hasPhotos,
    depth,
  }
}

/** Capabilities from raw questionnaire (before profile build). */
export function computeQuestionnaireCapabilities(
  q: QuestionnaireV1,
): PersonalizationCapabilities {
  const primary = q.participants[0]
  const hasRecipientName = Boolean(primary?.firstName?.trim())
  const hasAge = q.participants.some(participantHasAge)
  const hasBirthDate = q.participants.some((p) => Boolean(p.birthDate?.trim()))
  const traitCount = Object.values(q.personality.traitsByParticipantId).reduce(
    (n, t) => n + (t?.length ?? 0),
    0,
  )
  const hasTraits =
    traitCount > 0 ||
    (q.personality.groupTraits?.length ?? 0) > 0 ||
    (q.personality.duoDynamics?.length ?? 0) > 0 ||
    Boolean(q.personality.duoDescription?.trim())
  const hasInterests =
    q.interestUniverseIds.length > 0 || Boolean(q.interestFreeText?.trim())
  const hasClosePeople = (q.closePeople ?? []).some((c) => c.firstName.trim())
  const hasFamilyContext = hasLifeContext(q.lifeContext)
  const hasPersonalFacts = q.personalFacts.some((f) => f.value.trim())
  const hasMemories = q.memories.some((m) => m.text.trim())
  const hasInsideJokes = q.insideJokes.some((j) => j.text.trim())
  const hasPhotos = usablePhotos(q.photos) > 0

  let depth: PersonalizationDepth = "LIGHT"
  if (hasMemories || hasInsideJokes || hasPhotos) {
    depth = "RICH"
  } else if (hasClosePeople || hasFamilyContext || hasPersonalFacts) {
    depth = "PERSONALIZED"
  }

  return {
    hasRecipientName,
    hasAge,
    hasBirthDate,
    hasTraits,
    hasInterests,
    hasClosePeople,
    hasFamilyContext,
    hasPersonalFacts,
    hasMemories,
    hasInsideJokes,
    hasPhotos,
    depth,
  }
}

/**
 * Diffuse personalization touches — enrich pages without changing game engines.
 */
export interface PersonalizationTouches {
  recipientFirstName: string | null
  closePeopleNames: string[]
  traits: string[]
  interestUniverseIds: string[]
  ageBracket: string | null
  approximateAge: number | null
  birthDate: string | null
}

export function buildPersonalizationTouches(profile: BookProfileV1): PersonalizationTouches {
  const primary = profile.participants[0]
  const traits = profile.individualProfiles.flatMap((ip) => ip.traits ?? [])
  if (traits.length === 0 && profile.sharedProfile.groupTraits?.length) {
    traits.push(...profile.sharedProfile.groupTraits)
  }
  return {
    recipientFirstName: primary?.firstName?.trim() || null,
    closePeopleNames: (profile.closePeople ?? [])
      .map((c) => c.firstName.trim())
      .filter(Boolean),
    traits,
    interestUniverseIds: [...(profile.sharedProfile.interestUniverseIds ?? [])],
    ageBracket: primary?.ageBracket ?? null,
    approximateAge:
      typeof primary?.approximateAge === "number" ? primary.approximateAge : null,
    birthDate: primary?.birthDate?.trim() || null,
  }
}

/** Whether an archetype data-need can be satisfied by capabilities. */
export type PageDataNeed =
  | "NEUTRAL"
  | "THEME"
  | "LIGHT_PERSONAL"
  | "DEEP_PERSONAL"
  | "PHOTO"

export function canSatisfyDataNeed(
  need: PageDataNeed,
  caps: PersonalizationCapabilities,
): boolean {
  switch (need) {
    case "NEUTRAL":
      return true
    case "THEME":
      return caps.hasInterests
    case "LIGHT_PERSONAL":
      return (
        caps.hasRecipientName ||
        caps.hasAge ||
        caps.hasBirthDate ||
        caps.hasTraits ||
        caps.hasClosePeople ||
        caps.hasFamilyContext
      )
    case "DEEP_PERSONAL":
      return caps.hasMemories || caps.hasInsideJokes || caps.hasPersonalFacts
    case "PHOTO":
      return caps.hasPhotos
  }
}
