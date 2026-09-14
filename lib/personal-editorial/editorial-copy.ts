import type { PersonalEditorialAudienceContext } from "./audience-context"
import type { PersonalSourceFacts } from "./facts"

export type EditorialPerspectiveV2 =
  | "CREATOR_ATTRIBUTED"
  | "RECIPIENT"
  | "SHARED"
  | "NEUTRAL_EDITORIAL"

export interface EditorialCopyFromFacts {
  kicker: string | null
  shortTitle: string | null
  displayText: string
  perspective: EditorialPerspectiveV2
  attributedQuote: boolean
  claimsUsed: string[]
}

function de(name: string): string {
  return /^[AEIOUYÉÈÊÀÂÎÔÙÛaeiouy]/u.test(name.trim()) || name.trim() === "Emma"
    ? `d’${name.trim()}`
    : `de ${name.trim()}`
}

/**
 * Deterministic editorial copy from fact model — primary no-IA path.
 * Prefer short attributed / neutral fragments over pronoun surgery.
 */
export function buildEditorialCopyFromFacts(input: {
  facts: PersonalSourceFacts
  ctx: PersonalEditorialAudienceContext
}): EditorialCopyFromFacts {
  const { facts, ctx } = input
  const claimsUsed: string[] = []
  const leadPlace =
    facts.locations.find((l) =>
      /whitehaven|sydney\s+tower|tokyo|onsen|portugal/i.test(l),
    ) ||
    facts.locations[0] ||
    null
  const trip = facts.tripContext[0] || null
  const kicker = trip || null

  // Creator opinions → always attributed (OTHER_PERSON)
  if (facts.creatorOpinions.length && ctx.audience === "OTHER_PERSON") {
    const opinion = facts.creatorOpinions[0]!
    claimsUsed.push(opinion)
    const creator = ctx.creatorName || "Créateur"
    let displayText: string
    if (leadPlace && trip) {
      displayText = `${leadPlace}, le moment préféré ${de(creator)} pendant votre voyage en ${trip}.`
    } else if (leadPlace) {
      displayText = `${leadPlace}, un coup de cœur ${de(creator)}.`
    } else {
      displayText = opinion
    }
    return {
      kicker,
      shortTitle: leadPlace,
      displayText,
      perspective: "CREATOR_ATTRIBUTED",
      attributedQuote: false,
      claimsUsed,
    }
  }

  if (facts.events.includes("dernier-jour") && (leadPlace || trip)) {
    const claim =
      facts.sharedFacts.find((f) => /dernier/i.test(f)) || "Dernier jour"
    claimsUsed.push(claim)
    return {
      kicker: trip,
      shortTitle: leadPlace || "Dernier jour",
      displayText: trip
        ? `Votre dernier jour en ${trip}${leadPlace ? ` — ${leadPlace}` : ""}.`
        : "Votre dernier jour.",
      perspective: "SHARED",
      attributedQuote: false,
      claimsUsed,
    }
  }

  if (facts.events.includes("escale")) {
    claimsUsed.push(...facts.sharedFacts.filter((s) => /escale/i.test(s)))
    return {
      kicker: trip,
      shortTitle: leadPlace || "Escale",
      displayText:
        facts.sharedFacts.find((s) => /escale/i.test(s)) ||
        (leadPlace ? `Escale à ${leadPlace}.` : "Escale."),
      perspective: "NEUTRAL_EDITORIAL",
      attributedQuote: false,
      claimsUsed,
    }
  }

  if (
    facts.events.includes("rendez-vous-pro") ||
    facts.sharedFacts.some((s) => /entreprise|professionnel/i.test(s))
  ) {
    claimsUsed.push(...facts.sharedFacts)
    const hasLaugh = facts.events.includes("rire") || /\bfou\s+rire\b/i.test(facts.rawText)
    const hasHead =
      /\bcogn[ée]|tête\b/i.test(facts.rawText) || /\btête\b/i.test(facts.rawText)
    let displayText = "Aux débuts, les premiers rendez-vous professionnels."
    if (hasLaugh && hasHead) {
      displayText =
        "À l’époque de la première entreprise, un rendez-vous de démarchage tourne au fou rire."
    } else if (hasLaugh) {
      displayText =
        "Aux débuts de l’entreprise, un rendez-vous professionnel marqué par un fou rire."
    }
    // Only mention elements present in source
    if (hasLaugh && !/\brire\b/i.test(facts.rawText)) {
      displayText = "Aux débuts, les premiers rendez-vous professionnels."
    }
    return {
      kicker: "Les débuts",
      shortTitle: hasLaugh ? "Un fou rire" : "Premiers pas",
      displayText,
      perspective: "NEUTRAL_EDITORIAL",
      attributedQuote: false,
      claimsUsed,
    }
  }

  if (facts.events.includes("premier-bisou")) {
    claimsUsed.push("Premier bisou")
    return {
      kicker: "Les débuts",
      shortTitle: "Premier bisou",
      displayText: "Le premier bisou.",
      perspective: "SHARED",
      attributedQuote: false,
      claimsUsed,
    }
  }

  // Shared place + trip without first person — short neutral
  if (
    ctx.audience === "OTHER_PERSON" &&
    leadPlace &&
    trip &&
    !/\b(j['']|je\s+|mon\s+|ma\s+)/i.test(facts.rawText)
  ) {
    claimsUsed.push(...facts.sharedFacts.slice(0, 2))
    return {
      kicker: trip,
      shortTitle: leadPlace,
      displayText: `Un repère de votre voyage en ${trip}.`,
      perspective: "NEUTRAL_EDITORIAL",
      attributedQuote: false,
      claimsUsed,
    }
  }

  if (ctx.audience === "ME") {
    return {
      kicker,
      shortTitle: leadPlace,
      displayText: facts.rawText,
      perspective: "SHARED",
      attributedQuote: false,
      claimsUsed: ["source-verbatim-me"],
    }
  }

  // OTHER_PERSON + first person → attributed quote (safe, no pronoun surgery)
  // Quote body may keep first person; UI shows kicker = creator name.
  if (
    ctx.audience === "OTHER_PERSON" &&
    /j['\u2019]|je\s+|mon\s+|ma\s+|mes\s+|moi\b/i.test(facts.rawText)
  ) {
    const who = ctx.creatorName || "Créateur"
    claimsUsed.push("citation-createur")
    return {
      kicker: who,
      shortTitle: leadPlace,
      displayText: facts.quotes[0] || facts.rawText,
      perspective: "CREATOR_ATTRIBUTED",
      attributedQuote: true,
      claimsUsed,
    }
  }

  if (leadPlace) {
    claimsUsed.push(...facts.sharedFacts.slice(0, 2))
    return {
      kicker,
      shortTitle: leadPlace,
      displayText: facts.sharedFacts[0] || leadPlace,
      perspective: "NEUTRAL_EDITORIAL",
      attributedQuote: false,
      claimsUsed,
    }
  }

  const who = ctx.creatorName || "Souvenir"
  return {
    kicker: who,
    shortTitle: null,
    displayText: facts.quotes[0] || facts.rawText,
    perspective: "CREATOR_ATTRIBUTED",
    attributedQuote: true,
    claimsUsed: ["citation-fallback"],
  }
}

export function hasMixedEditorialVoice(
  displayText: string,
  attributedQuote: boolean,
): boolean {
  if (attributedQuote) return false
  const hasVous = /\b(votre|vos|vous)\b/i.test(displayText)
  const hasNous = /\b(nous|notre|nos)\b/i.test(displayText)
  const hasJe = /\b(j['']|je\s+|mon\s+moment)\b/i.test(displayText)
  return (hasVous && hasNous) || (hasVous && hasJe)
}

export function hasForbiddenQuestionnaireVoice(
  displayText: string,
  recipientNames: string[],
): boolean {
  for (const name of recipientNames) {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\s+et\\s+moi\\b`, "i")
    if (re.test(displayText)) return true
  }
  return false
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
