import type { PersonalSourceFacts } from "./facts"
import type { EditorialCopyFromFacts } from "./editorial-copy"
import { hasForbiddenQuestionnaireVoice, hasMixedEditorialVoice } from "./editorial-copy"
import type { PersonalEditorialAudienceContext } from "./audience-context"

export interface EditorialValidationResult {
  ok: boolean
  reasons: string[]
  /** Human-readable unsupported claims for Lab debug / repair. */
  unsupportedClaims?: string[]
}

/** Word-ish boundary that works with French accents (JS \\b is ASCII-only). */
const WB = "(?:^|[^A-Za-zÀ-ÖØ-öø-ÿ])"
const WE = "(?=$|[^A-Za-zÀ-ÖØ-öø-ÿ])"

/** Poetic / filler phrases that must not appear unless literally in the source. */
export const UNSUPPORTED_POETIC_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "instant-precieux", re: /instant[s]?\s+pr[eé]cieu/i },
  { id: "grave-memoire", re: /grav[eé]e?\s+dans\s+(la\s+)?m[eé]moire/i },
  { id: "place-particuliere-memoire", re: /place\s+particuli[eè]re\s+dans\s+(la\s+)?m[eé]moire/i },
  { id: "histoire-a-connu", re: /votre\s+histoire\s+a\s+connu/i },
  { id: "instant-suspendu", re: /instant[s]?\s+suspendu/i },
  { id: "souvenirs-en-suspens", re: /souvenirs?\s+en\s+suspens/i },
  { id: "instants-qui-racontent", re: /instants?\s+qui\s+racontent/i },
  { id: "moment-precieux", re: /moments?\s+pr[eé]cieu/i },
  { id: "ces-instants", re: /ces\s+instants\s+qui/i },
]

/** Evaluative / cultural enrichment — allowed only if present in source blob. */
export const EVALUATIVE_OR_CULTURAL_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "repute", re: new RegExp(`${WB}r[eé]put[eé]e?s?${WE}`, "i") },
  { id: "savoureux", re: new RegExp(`${WB}savoureu(?:x|se|ses)${WE}`, "i") },
  { id: "incontournable", re: new RegExp(`${WB}incontournable${WE}`, "i") },
  { id: "typique", re: new RegExp(`${WB}typique${WE}`, "i") },
  { id: "authentique", re: new RegExp(`${WB}authentique${WE}`, "i") },
  { id: "spa-traditionnel", re: /spa\s+traditionnel/i },
  { id: "bain-thermal", re: /bain\s+thermal/i },
  { id: "baigne-nu", re: /baigne\s+nu|se\s+baigner\s+nu/i },
  { id: "nudite", re: /nudit[eé]|onsen.{0,40}\bnu(?:e|s)?\b|\bnu(?:e|s)?\b.{0,40}onsen/i },
  { id: "rituel", re: new RegExp(`${WB}rituele?s?${WE}`, "i") },
  { id: "eau-chaude", re: /eau\s+chaude?/i },
  { id: "culture-japonaise", re: /culture\s+japonaise|tradition\s+japonaise/i },
]

const GENERIC_CREATOR_RE =
  /la\s+personne\s+qui\s+a\s+(cr[eé][eé]|rempli|choisi|saisi|ajout[eé])|(?:le|la)\s+cr[eé]at(?:eur|rice)\b/i

const ABSTRACT_PAGE_TITLE_RE =
  /souvenirs?\s+en\s+suspens|instants?\s+suspendus?|m[eé]moire\s+vivante|moments?\s+pr[eé]cieux|histoire\s+partag[eé]e/i

const USELESS_INTRO_RE =
  /deux\s+(instants?|souvenirs?).{0,40}(pr[eé]cieu|racontent|m[eé]moire)|au\s+fil\s+d['\u2019]un\s+voyage|chacun\s+avec\s+sa\s+date/i

function supportBlob(facts: PersonalSourceFacts): string {
  return [
    facts.rawText,
    ...facts.locations,
    ...facts.tripContext,
    ...facts.creatorOpinions,
    ...facts.recipientOpinions,
    ...facts.sharedFacts,
    ...facts.creatorFacts,
    ...facts.recipientFacts,
    ...facts.events,
    ...facts.quotes,
    ...facts.semanticTags,
  ]
    .join("\n")
    .toLowerCase()
}

function patternSupported(re: RegExp, blob: string): boolean {
  return re.test(blob)
}

/**
 * Closed-world claim scan: reject cultural enrichment, poetry filler,
 * generic creator labels, and unsupported evaluative adjectives.
 */
export function findUnsupportedClaims(input: {
  text: string
  title?: string | null
  kicker?: string | null
  facts: PersonalSourceFacts
  creatorName?: string | null
}): string[] {
  const unsupported: string[] = []
  const combined = `${input.text} ${input.title ?? ""} ${input.kicker ?? ""}`
  const blob = supportBlob(input.facts)

  if (GENERIC_CREATOR_RE.test(combined)) {
    if (input.creatorName) {
      unsupported.push(`creator-generique (utiliser « ${input.creatorName} »)`)
    } else if (/la\s+personne\s+qui/i.test(combined)) {
      unsupported.push("creator-generique")
    } else if (/(?:le|la)\s+cr[eé]at(?:eur|rice)/i.test(combined)) {
      // Prefer neutral / citation over "le créateur" even without a known first name
      unsupported.push("creator-generique")
    }
  }

  for (const p of UNSUPPORTED_POETIC_PATTERNS) {
    if (p.re.test(combined) && !patternSupported(p.re, blob)) {
      unsupported.push(`poesie-non-supportee:${p.id}`)
    }
  }

  for (const p of EVALUATIVE_OR_CULTURAL_PATTERNS) {
    if (p.re.test(combined) && !patternSupported(p.re, blob)) {
      unsupported.push(`enrichissement-non-source:${p.id}`)
    }
  }

  return unsupported
}

/**
 * Anti-invention + voice + closed-world checks for a single editorialized block.
 */
export function validateEditorialCopy(input: {
  copy: EditorialCopyFromFacts
  facts: PersonalSourceFacts
  recipientNames: string[]
  creatorName?: string | null
}): EditorialValidationResult {
  const reasons: string[] = []
  const unsupportedClaims: string[] = []
  const { copy, facts } = input
  const blob = supportBlob(facts)

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
    "eysines",
    "penha",
  ]
  const textLow = `${copy.displayText} ${copy.shortTitle ?? ""} ${copy.kicker ?? ""}`.toLowerCase()
  for (const p of placeHints) {
    if (textLow.includes(p) && !blob.includes(p)) {
      reasons.push(`lieu-non-source:${p}`)
      unsupportedClaims.push(`lieu inventé: ${p}`)
    }
  }

  // Recipient preference flip — creator-owned preference must stay on creator
  if (/votre\s+(plage|moment)\s+pr[eé]f[eé]r/i.test(copy.displayText)) {
    const creatorOwnsPreference =
      facts.creatorOpinions.length > 0 ||
      /(mon\s+moment\s+pr[eé]f|j['\u2019]ai\s+ador|c['\u2019]est\s+mon\s+moment)/i.test(
        facts.rawText,
      )
    const recipientExplicitPreference =
      facts.recipientOpinions.some((o) => /pr[eé]f[eé]r|ador/i.test(o)) ||
      /votre\s+(plage|moment)\s+pr[eé]f[eé]r/i.test(facts.rawText)
    if (creatorOwnsPreference && !recipientExplicitPreference) {
      reasons.push("opinion-reattribuee-recipient")
      unsupportedClaims.push("préférence réattribuée au destinataire")
    }
  }

  // Unattributed first person
  if (
    !copy.attributedQuote &&
    /\b(j['']ai|j['']adore|mon\s+moment)\b/i.test(copy.displayText)
  ) {
    reasons.push("premiere-personne-non-attribuee")
  }

  const closed = findUnsupportedClaims({
    text: copy.displayText,
    title: copy.shortTitle,
    kicker: copy.kicker,
    facts,
    creatorName: input.creatorName,
  })
  for (const c of closed) {
    unsupportedClaims.push(c)
    if (c.startsWith("creator-generique")) reasons.push("creator-generique")
    else if (c.startsWith("poesie-")) reasons.push("poesie-non-supportee")
    else if (c.startsWith("enrichissement-")) reasons.push("enrichissement-non-source")
  }

  return {
    ok: reasons.length === 0,
    reasons: [...new Set(reasons)],
    unsupportedClaims: [...new Set(unsupportedClaims)],
  }
}

/** Page title must be natural French — no tag concatenation with &. */
export function validatePageTitle(title: string): EditorialValidationResult {
  const reasons: string[] = []
  const unsupportedClaims: string[] = []
  if (/\s*&\s*/.test(title)) reasons.push("titre-concatenation-et")
  if ((title.match(/·/g) || []).length >= 3) reasons.push("titre-trop-de-lieux")
  if (ABSTRACT_PAGE_TITLE_RE.test(title)) {
    reasons.push("titre-abstrait-non-supporte")
    unsupportedClaims.push(`titre abstrait: « ${title} »`)
  }
  if (/un moment à garder|souvenir partagé|un souvenir à garder/i.test(title)) {
    reasons.push("titre-generique")
  }
  return {
    ok: reasons.length === 0,
    reasons,
    unsupportedClaims,
  }
}

/**
 * Page-level closed-world checks (title + intro + blocks).
 */
export function validatePageLevelCopy(input: {
  pageTitle: string
  pageIntro: string | null
  blocks: Array<{
    sourceId: string
    kicker: string | null
    title: string | null
    text: string
  }>
  factsBySourceId: Map<string, PersonalSourceFacts>
  ctx: PersonalEditorialAudienceContext
}): EditorialValidationResult {
  const reasons: string[] = []
  const unsupportedClaims: string[] = []

  const titleCheck = validatePageTitle(input.pageTitle)
  if (!titleCheck.ok) reasons.push(...titleCheck.reasons)
  unsupportedClaims.push(...(titleCheck.unsupportedClaims ?? []))

  if (input.pageIntro && USELESS_INTRO_RE.test(input.pageIntro)) {
    reasons.push("intro-inutile")
    unsupportedClaims.push(`pageIntro non supportée: « ${input.pageIntro.slice(0, 80)} »`)
  }

  // Intro poetic filler without support in any block
  if (input.pageIntro) {
    const pageBlob = [...input.factsBySourceId.values()]
      .map(supportBlob)
      .join("\n")
    for (const p of UNSUPPORTED_POETIC_PATTERNS) {
      if (p.re.test(input.pageIntro) && !p.re.test(pageBlob)) {
        reasons.push("intro-poesie-non-supportee")
        unsupportedClaims.push(`pageIntro poésie: ${p.id}`)
      }
    }
  }

  for (const blockCopy of input.blocks) {
    const facts = input.factsBySourceId.get(blockCopy.sourceId)
    if (!facts) {
      reasons.push(`unknown-source:${blockCopy.sourceId}`)
      continue
    }
    const v = validateEditorialCopy({
      copy: {
        kicker: blockCopy.kicker,
        shortTitle: blockCopy.title,
        displayText: blockCopy.text,
        perspective: "NEUTRAL_EDITORIAL",
        attributedQuote: false,
        claimsUsed: [],
      },
      facts,
      recipientNames: input.ctx.recipientNames,
      creatorName: input.ctx.creatorName,
    })
    if (!v.ok) reasons.push(...v.reasons.map((r) => `${blockCopy.sourceId}:${r}`))
    for (const c of v.unsupportedClaims ?? []) {
      unsupportedClaims.push(`${blockCopy.sourceId}: ${c}`)
    }
  }

  return {
    ok: reasons.length === 0,
    reasons: [...new Set(reasons)],
    unsupportedClaims: [...new Set(unsupportedClaims)],
  }
}
