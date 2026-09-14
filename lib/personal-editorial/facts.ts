import type { PersonalEditorialAudienceContext } from "./audience-context"
import { classifyPersonalSemantics, type PersonalSemanticCategory } from "./semantic"

export type PersonalActorRole = "CREATOR" | "RECIPIENT" | "OTHER"

export interface PersonalSourceActor {
  name: string
  role: PersonalActorRole
}

/**
 * Structured facts extracted ONLY from one source text.
 * Never invents; lists may be empty.
 */
export interface PersonalSourceFacts {
  sourceId: string
  sourceType: "MEMORY" | "PHOTO_MEMORY"
  rawText: string
  actors: PersonalSourceActor[]
  sharedFacts: string[]
  creatorFacts: string[]
  recipientFacts: string[]
  locations: string[]
  tripContext: string[]
  events: string[]
  creatorOpinions: string[]
  recipientOpinions: string[]
  quotes: string[]
  category: PersonalSemanticCategory
  semanticTags: string[]
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Build a conservative fact model from a single source + audience context.
 */
export function extractPersonalSourceFacts(input: {
  sourceId: string
  sourceType: "MEMORY" | "PHOTO_MEMORY"
  rawText: string
  place?: string | null
  title?: string | null
  ctx: PersonalEditorialAudienceContext
}): PersonalSourceFacts {
  const raw = input.rawText.trim()
  const semantics = classifyPersonalSemantics({
    text: raw,
    place: input.place,
    title: input.title,
  })

  const actors: PersonalSourceActor[] = []
  if (input.ctx.creatorName) {
    actors.push({ name: input.ctx.creatorName, role: "CREATOR" })
  }
  for (const name of input.ctx.recipientNames) {
    actors.push({ name, role: "RECIPIENT" })
  }

  const creatorOpinions: string[] = []
  const recipientOpinions: string[] = []
  const sharedFacts: string[] = []
  const creatorFacts: string[] = []
  const events: string[] = []
  const quotes: string[] = []

  const creator = input.ctx.creatorName

  // Creator opinions — keep attribution to creator
  // Apostrophe: ASCII or typographic; avoid \b after accents (JS \w is ASCII-only).
  if (/j['\u2019]ai\s+ador[ée]/i.test(raw) || /j['\u2019]adore\b/i.test(raw)) {
    const place =
      semantics.locations.find((l) => /whitehaven|plage/i.test(l)) ||
      semantics.locations[0] ||
      "ce lieu"
    creatorOpinions.push(
      creator
        ? `${creator} a adoré ${place}`
        : `Le créateur a adoré ${place}`,
    )
  }
  if (
    /moment\s+pr[eé]f[eé]r[eé]/i.test(raw) &&
    /(mon\s+moment|j['\u2019]ai|c['\u2019]est\s+mon)/i.test(raw)
  ) {
    const place =
      semantics.locations.find((l) => /whitehaven|plage/i.test(l)) ||
      semantics.locations[0] ||
      null
    const tripLabel = semantics.trips[0]
      ? `du voyage en ${semantics.trips[0]}`
      : "du voyage"
    creatorOpinions.push(
      creator
        ? place
          ? `Pour ${creator}, ${place} est son moment préféré ${tripLabel}`
          : `Moment préféré de ${creator} ${tripLabel}`
        : `Moment préféré du créateur ${tripLabel}`,
    )
  }

  // Shared trip / last day
  if (/\bdernier\s+jour\b/i.test(raw)) {
    const where = semantics.trips[0] || semantics.locations.find((l) => /australie|portugal|japon/i.test(l))
    sharedFacts.push(
      where ? `Dernier jour en ${where}` : "Dernier jour du voyage",
    )
    events.push("dernier-jour")
  }
  if (/\bvoyage\b/i.test(raw) && semantics.trips.length) {
    for (const t of semantics.trips) {
      sharedFacts.push(`Voyage lié à ${t}`)
    }
  }
  if (/\bescale\b/i.test(raw)) {
    events.push("escale")
    const loc = semantics.locations.find((l) => /tokyo|japon/i.test(l))
    sharedFacts.push(loc ? `Escale à ${loc}` : "Escale")
  }

  // "{Recipient} et moi" → shared presence, not creator-only opinion
  for (const name of input.ctx.recipientNames) {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\s+et\\s+moi\\b`, "i")
    if (re.test(raw)) {
      sharedFacts.push(
        creator
          ? `Présence de ${creator} et ${name}`
          : `Présence de ${name} et du créateur`,
      )
    }
  }

  // Firsts / milestones
  if (/\bpremier\s+bisou\b/i.test(raw)) {
    events.push("premier-bisou")
    sharedFacts.push("Premier bisou")
  }
  if (/\bpremiers?\s+rendez[- ]?vous\s+professionnels?\b/i.test(raw)) {
    events.push("rendez-vous-pro")
    sharedFacts.push("Premiers rendez-vous professionnels")
  }
  if (/\bentreprise\b/i.test(raw)) {
    sharedFacts.push(
      /\bpremi[eè]re\s+entreprise\b/i.test(raw)
        ? "Première entreprise"
        : "Entreprise",
    )
  }
  if (/\bfou\s+rire\b/i.test(raw) || /\brire\b/i.test(raw)) {
    events.push("rire")
    sharedFacts.push("Moment de rire")
  }

  // Keep a short quote slice for attributed fallback (raw, not rewritten)
  if (raw.length > 0) {
    quotes.push(raw.length > 180 ? `${raw.slice(0, 177).trim()}…` : raw)
  }

  // Explicit place field
  if (input.place?.trim() && !semantics.locations.includes(input.place.trim())) {
    semantics.locations.push(input.place.trim())
  }

  return {
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    rawText: raw,
    actors,
    sharedFacts: uniq(sharedFacts),
    creatorFacts: uniq(creatorFacts),
    recipientFacts: [],
    locations: semantics.locations,
    tripContext: semantics.trips,
    events: uniq(events),
    creatorOpinions: uniq(creatorOpinions),
    recipientOpinions: uniq(recipientOpinions),
    quotes,
    category: semantics.category,
    semanticTags: semantics.semanticTags,
  }
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))]
}

/** True if two fact models share an explicit trip key. */
export function factsShareTrip(a: PersonalSourceFacts, b: PersonalSourceFacts): boolean {
  return a.tripContext.some((t) =>
    b.tripContext.some((x) => x.toLowerCase() === t.toLowerCase()),
  )
}

/** Tokyo escale may join Australia only if escale + trip link is explicit. */
export function factsSupportAustraliaJapanLink(
  a: PersonalSourceFacts,
  b: PersonalSourceFacts,
): boolean {
  const texts = `${a.rawText}\n${b.rawText}`
  const hasAus = /australie/i.test(texts)
  const hasJapan = /japon|tokyo|onsen/i.test(texts)
  const linked =
    /escale/i.test(texts) &&
    /australie/i.test(texts) &&
    (/pendant\s+(notre|votre)\s+voyage/i.test(texts) ||
      /voyage\s+en\s+australie/i.test(texts))
  return hasAus && hasJapan && linked
}
