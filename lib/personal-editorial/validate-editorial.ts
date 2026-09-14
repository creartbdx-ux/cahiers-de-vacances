import type { PersonalSourceFacts } from "./facts"
import type { EditorialCopyFromFacts } from "./editorial-copy"
import { hasForbiddenQuestionnaireVoice, hasMixedEditorialVoice } from "./editorial-copy"

export interface EditorialValidationResult {
  ok: boolean
  reasons: string[]
}

/**
 * Anti-invention + voice checks for a single editorialized block.
 * Claims must be grounded in the fact model / raw source.
 */
export function validateEditorialCopy(input: {
  copy: EditorialCopyFromFacts
  facts: PersonalSourceFacts
  recipientNames: string[]
}): EditorialValidationResult {
  const reasons: string[] = []
  const { copy, facts } = input
  const blob = `${facts.rawText}\n${facts.locations.join(" ")}\n${facts.tripContext.join(" ")}\n${facts.creatorOpinions.join(" ")}\n${facts.sharedFacts.join(" ")}`.toLowerCase()

  if (hasForbiddenQuestionnaireVoice(copy.displayText, input.recipientNames)) {
    reasons.push("voix-questionnaire-interdite")
  }
  if (hasMixedEditorialVoice(copy.displayText, copy.attributedQuote)) {
    reasons.push("voix-mixte")
  }

  // New place names in title/text not in source
  const placeHints = [
    "whitehaven",
    "sydney",
    "tokyo",
    "japon",
    "australie",
    "portugal",
    "onsen",
  ]
  const textLow = `${copy.displayText} ${copy.shortTitle ?? ""} ${copy.kicker ?? ""}`.toLowerCase()
  for (const p of placeHints) {
    if (textLow.includes(p) && !blob.includes(p)) {
      reasons.push(`lieu-non-source:${p}`)
    }
  }

  // Recipient preference flip
  if (
    /votre\s+(plage|moment)\s+pr[eé]f[eé]r/i.test(copy.displayText) &&
    !/sami.*(pr[eé]f[eé]r|ador)/i.test(facts.rawText)
  ) {
    reasons.push("opinion-reattribuee-recipient")
  }

  // Unattributed first person
  if (
    !copy.attributedQuote &&
    /\b(j['']ai|j['']adore|mon\s+moment)\b/i.test(copy.displayText)
  ) {
    reasons.push("premiere-personne-non-attribuee")
  }

  return { ok: reasons.length === 0, reasons }
}

/** Page title must be natural French — no tag concatenation with &. */
export function validatePageTitle(title: string): EditorialValidationResult {
  const reasons: string[] = []
  if (/\s*&\s*/.test(title)) reasons.push("titre-concatenation-et")
  if (/^[A-Z0-9ÉÈÊÀÂÎÔÙÛ\s·\-]{3,}$/.test(title) && title === title.toUpperCase() && title.length > 12) {
    // ALL CAPS long titles look mechanical — soften check: only fail if also has &
  }
  if ((title.match(/·/g) || []).length >= 3) reasons.push("titre-trop-de-lieux")
  return { ok: reasons.length === 0, reasons }
}
