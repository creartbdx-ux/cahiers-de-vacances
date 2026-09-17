/**
 * Adaptive questionnaire journey: CORE first, then optional personalization.
 * Pure presentation helpers — does not invent profile data.
 */

import { deriveCreatorIsParticipant } from "./audience"
import {
  buildAudienceCopyContext,
  buildStepCopy,
  type StepCopy,
  type StepId,
} from "./audience-copy"
import type { AudienceType, PersonalizationDepth, QuestionnaireV1 } from "./types"

export type { StepCopy, StepId }
export {
  buildAudienceCopyContext,
  personalFactCategoryLabel,
  personalFactCategoryOptions,
  photoCopy,
  recapCopy,
  resolveFactTarget,
  queName,
  deName,
} from "./audience-copy"

/** Core steps required before optional deep personalization. */
export const CORE_JOURNEY_STEPS: StepId[] = [
  "audience",
  "participants",
  "personality",
  "interests",
  "game",
  "forbidden",
  "color",
  "style",
]

/** @deprecated use buildJourneySteps — kept for callers that only know audience. */
export function stepsForAudience(audience: AudienceType | null): StepId[] {
  return buildJourneySteps(audience, null)
}

/**
 * Journey: CORE → deepIntro gate → light optional → deep optional → finale → recap.
 */
export function buildJourneySteps(
  audience: AudienceType | null,
  creatorIsParticipant: boolean | null | undefined,
): StepId[] {
  const steps: StepId[] = ["audience"]
  if (!audience) return steps

  const isParticipant = deriveCreatorIsParticipant(audience, creatorIsParticipant)

  // PARTIE ESSENTIELLE
  steps.push("participants", "personality", "interests", "game", "forbidden", "color", "style")

  // Transition + optional personalization
  steps.push("deepIntro", "closePeople", "lifeContext", "personalFacts", "memories")

  if (audience === "DUO" || audience === "GROUP") {
    steps.push("insideJokes")
  }

  steps.push("photos", "finale", "recap")

  void isParticipant
  return steps
}

export function getStepCopy(step: StepId, q: QuestionnaireV1): StepCopy {
  return buildStepCopy(step, buildAudienceCopyContext(q))
}

export function memorySuggestions(audience: AudienceType | null): string[] {
  if (audience === "ME") {
    return [
      "Un voyage mémorable",
      "Une anecdote qui vous fait encore rire",
      "Un moment dont vous êtes fier/fière",
      "Un souvenir avec vos proches",
      "Une expérience improbable",
    ]
  }
  if (audience === "OTHER_PERSON") {
    return [
      "Un souvenir partagé",
      "Une anecdote drôle",
      "Un voyage",
      "Une habitude mémorable",
      "Un moment marquant",
    ]
  }
  if (audience === "DUO") {
    return [
      "Leur rencontre",
      "Un voyage",
      "Une anecdote drôle",
      "Un moment marquant",
      "Une habitude commune",
    ]
  }
  if (audience === "GROUP") {
    return [
      "Un souvenir culte",
      "Une soirée",
      "Un voyage",
      "Une catastrophe devenue drôle",
      "Une tradition",
      "Une private joke",
    ]
  }
  return []
}

export const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: "ME", label: "Pour moi" },
  { value: "OTHER_PERSON", label: "Pour quelqu'un" },
  { value: "DUO", label: "Pour deux personnes" },
  { value: "GROUP", label: "Pour un groupe d'amis" },
]

/** Forbidden wording for ME / OTHER_PERSON solo personality chips. */
export const FORBIDDEN_SOLO_TRAITS = ["complice", "opposés mais complémentaires"] as const

export function difficultyLabel(level: 1 | 2 | 3 | 4 | undefined): string {
  switch (level) {
    case 1:
      return "Détente"
    case 2:
      return "Facile"
    case 3:
      return "Un peu challenge"
    case 4:
      return "Difficile"
    default:
      return "—"
  }
}

export function audienceHumanLabel(audience: AudienceType | null): string {
  switch (audience) {
    case "ME":
      return "Pour vous"
    case "OTHER_PERSON":
      return "Pour quelqu'un"
    case "DUO":
      return "Pour deux personnes"
    case "GROUP":
      return "Pour un groupe"
    default:
      return "—"
  }
}

export function richnessClientMessage(
  level: PersonalizationDepth | "INSUFFICIENT" | "ENOUGH" | "RICH" | "LIGHT" | "PERSONALIZED",
): string {
  if (level === "INSUFFICIENT") {
    return "Il manque encore quelques informations de base pour créer le cahier."
  }
  if (level === "RICH") {
    return "Nous avons tout ce qu'il faut pour créer le cahier — avec une personnalisation très riche."
  }
  if (level === "PERSONALIZED" || level === "ENOUGH") {
    return "Nous avons déjà assez d'informations pour créer le cahier. Les touches personnelles le rendront encore plus unique."
  }
  // LIGHT
  return "Nous avons déjà assez d'informations pour créer le cahier."
}

/** Recap tags: show up to `max` items, then "+ X autres". */
export function truncateTagList(
  items: string[],
  max = 6,
): { visible: string[]; overflow: number } {
  if (items.length <= max) return { visible: items, overflow: 0 }
  return { visible: items.slice(0, max), overflow: items.length - max }
}

/** Existing non-empty group member particularities (personalTrait). */
export function listGroupParticularities(
  participants: { id: string; firstName: string; personalTrait?: string }[],
): { participantId: string; firstName: string; text: string }[] {
  return participants
    .filter((p) => Boolean(p.personalTrait?.trim()))
    .map((p) => ({
      participantId: p.id,
      firstName: p.firstName,
      text: p.personalTrait!.trim(),
    }))
}

export function setGroupParticularity<T extends { id: string; personalTrait?: string }>(
  participants: T[],
  participantId: string,
  text: string,
): T[] {
  const trimmed = text.trim()
  return participants.map((p) =>
    p.id === participantId
      ? { ...p, personalTrait: trimmed ? trimmed : undefined }
      : p,
  )
}

export function clearGroupParticularity<T extends { id: string; personalTrait?: string }>(
  participants: T[],
  participantId: string,
): T[] {
  return setGroupParticularity(participants, participantId, "")
}
