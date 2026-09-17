/**
 * Diffuse personalization — decorate ordinary games without dedicated "personal pages".
 * dataNeed ≠ page type: LIGHT_PERSONAL means a page *can* receive light touches.
 */

import type { PersonalizationCapabilities } from "@/lib/questionnaire/capabilities"

export type PersonalizationTouchType =
  | "RECIPIENT_NAME"
  | "RECIPIENT_AGE"
  | "BIRTH_DATE"
  | "TRAITS"
  | "INTERESTS"
  | "CLOSE_PEOPLE_NAMES"
  | "FAMILY_CONTEXT"
  | "PERSONAL_FACT"
  | "MEMORY"
  | "INSIDE_JOKE"

export type PersonalizationTouchUsage =
  | "title"
  | "solution"
  | "label"
  | "word_list"
  | "theme"
  | "result_copy"
  | "context"
  | "question"

export interface PersonalizationTouch {
  type: PersonalizationTouchType
  usage: PersonalizationTouchUsage
}

/** Touch types available from profile capabilities. */
export function availableTouchTypes(
  caps: PersonalizationCapabilities,
): PersonalizationTouchType[] {
  const out: PersonalizationTouchType[] = []
  if (caps.hasRecipientName) out.push("RECIPIENT_NAME")
  if (caps.hasAge) out.push("RECIPIENT_AGE")
  if (caps.hasBirthDate) out.push("BIRTH_DATE")
  if (caps.hasTraits) out.push("TRAITS")
  if (caps.hasInterests) out.push("INTERESTS")
  if (caps.hasClosePeople) out.push("CLOSE_PEOPLE_NAMES")
  if (caps.hasFamilyContext) out.push("FAMILY_CONTEXT")
  if (caps.hasPersonalFacts) out.push("PERSONAL_FACT")
  if (caps.hasMemories) out.push("MEMORY")
  if (caps.hasInsideJokes) out.push("INSIDE_JOKE")
  return out
}

export function touch(
  type: PersonalizationTouchType,
  usage: PersonalizationTouchUsage,
): PersonalizationTouch {
  return { type, usage }
}

/** Whether a page counts toward PERSONAL % (touches / deep / photo). */
export function pageCountsAsPersonalized(input: {
  personalizationTouches?: PersonalizationTouch[]
  dataNeed?: string | null
  family?: string
}): boolean {
  if ((input.personalizationTouches?.length ?? 0) > 0) return true
  if (input.dataNeed === "DEEP_PERSONAL") return true
  if (input.family === "PHOTO") return true
  return false
}
