import { buildForbiddenNeedles, textHitsForbidden } from "@/lib/editorial-engine/sources"
import type { ForbiddenTopicsAnswer } from "@/lib/questionnaire/types"

export function normalizeChoiceKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
}

export function choicesAreDistinct(choices: string[]): boolean {
  const keys = choices.map(normalizeChoiceKey).filter(Boolean)
  return keys.length === choices.length && new Set(keys).size === keys.length
}

export function choicesAreSufficientlyDistinct(choices: string[]): boolean {
  if (!choicesAreDistinct(choices)) return false
  // Reject near-duplicates that only differ by punctuation / trailing words under 2 chars
  const stems = choices.map((c) => normalizeChoiceKey(c).replace(/[^a-z0-9 ]/g, ""))
  return new Set(stems).size === stems.length
}

export function textMentionsForbidden(
  text: string,
  forbidden: ForbiddenTopicsAnswer | { hasRestrictions: boolean; text?: string; peopleToAvoid?: string },
): boolean {
  if (!forbidden.hasRestrictions) return false
  const needles = buildForbiddenNeedles({
    answered: true,
    hasRestrictions: true,
    text: forbidden.text,
    peopleToAvoid: forbidden.peopleToAvoid,
  })
  return textHitsForbidden(text, needles)
}

export function collectTextsHitForbidden(
  texts: string[],
  forbidden: ForbiddenTopicsAnswer | { hasRestrictions: boolean; text?: string; peopleToAvoid?: string },
): string[] {
  return texts.filter((t) => textMentionsForbidden(t, forbidden))
}
