/**
 * Explicit relations between personal editorial sources.
 * Never invents a link that is not supported by source facts.
 */

import type { PersonalSourceFacts } from "./facts"
import { categoriesClash } from "./semantic"
import type { PersonalBlockV1 } from "./types"

export type SourceRelationType =
  | "PART_OF_TRIP"
  | "SAME_TRIP"
  | "SAME_EVENT"
  | "SAME_LOCATION"
  | "SAME_PERIOD"
  | "FOLLOWS"
  | "PRECEDES"
  | "RELATED_TO"
  | "NONE"

export type EditorialRelationLevel = "STRONG" | "NEUTRAL" | "CONFLICT"

export interface SourceRelation {
  type: SourceRelationType
  subjectSourceId: string
  objectSourceId: string
  subjectLabel: string
  objectLabel: string
  evidence: string[]
}

const STRONG_TYPES = new Set<SourceRelationType>([
  "PART_OF_TRIP",
  "SAME_TRIP",
  "SAME_EVENT",
  "SAME_LOCATION",
  "SAME_PERIOD",
  "FOLLOWS",
  "PRECEDES",
])

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function sourceLabel(f: PersonalSourceFacts): string {
  return (
    f.locations[0] ||
    f.tripContext[0] ||
    f.events[0] ||
    f.sourceId.slice(0, 12)
  )
}

/** Explicit Australia trip mention in facts. */
export function hasAustraliaTrip(f: PersonalSourceFacts): boolean {
  const blob = `${f.rawText}\n${f.tripContext.join(" ")}\n${f.sharedFacts.join(" ")}`
  return /australie/i.test(blob) || f.tripContext.some((t) => /australie/i.test(t))
}

/** Tokyo / Japon / onsen as local stop. */
export function hasJapanLocal(f: PersonalSourceFacts): boolean {
  const blob = `${f.rawText}\n${f.locations.join(" ")}\n${f.sharedFacts.join(" ")}`
  return /tokyo|japon|onsen/i.test(blob)
}

/**
 * Source explicitly states Japan/Tokyo is a stopover during Australia trip.
 */
export function hasExplicitAustraliaJapanEscale(f: PersonalSourceFacts): boolean {
  const t = f.rawText
  if (!/escale/i.test(t)) return false
  if (!/australie/i.test(t)) return false
  if (!/japon|tokyo|onsen/i.test(t)) return false
  return (
    /pendant\s+(notre|votre|le)\s+voyage/i.test(t) ||
    /voyage\s+en\s+australie/i.test(t) ||
    /escale.{0,40}(pendant|lors|durant).{0,40}(voyage|australie)/i.test(t) ||
    /(voyage|australie).{0,40}escale/i.test(t)
  )
}

function locationOverlap(a: PersonalSourceFacts, b: PersonalSourceFacts): string[] {
  return a.locations.filter((l) =>
    b.locations.some((x) => norm(x) === norm(l) || norm(x).includes(norm(l)) || norm(l).includes(norm(x))),
  )
}

function tripOverlap(a: PersonalSourceFacts, b: PersonalSourceFacts): string[] {
  return a.tripContext.filter((t) =>
    b.tripContext.some((x) => norm(x) === norm(t)),
  )
}

function eventOverlap(a: PersonalSourceFacts, b: PersonalSourceFacts): string[] {
  return a.events.filter((e) => b.events.includes(e))
}

function dateOverlap(a: PersonalSourceFacts, b: PersonalSourceFacts): string[] {
  return (a.dates ?? []).filter((d) =>
    (b.dates ?? []).some((x) => norm(x) === norm(d)),
  )
}

function actorOverlap(a: PersonalSourceFacts, b: PersonalSourceFacts): string[] {
  return a.actors
    .map((x) => x.name)
    .filter((n) => b.actors.some((y) => norm(y.name) === norm(n)))
}

/**
 * Infer the strongest supported relation between two sources.
 * Order: STRONG evidence first, then RELATED_TO (participants only), else NONE.
 */
export function inferPairRelation(
  a: PersonalSourceFacts,
  b: PersonalSourceFacts,
): SourceRelation {
  const subjectSourceId = a.sourceId
  const objectSourceId = b.sourceId
  const subjectLabel = sourceLabel(a)
  const objectLabel = sourceLabel(b)

  // PART_OF_TRIP: Japan escale ↔ Australia trip sources
  const aEscale = hasExplicitAustraliaJapanEscale(a)
  const bEscale = hasExplicitAustraliaJapanEscale(b)
  if (aEscale && hasAustraliaTrip(b) && !hasJapanLocal(b)) {
    return {
      type: "PART_OF_TRIP",
      subjectSourceId,
      objectSourceId,
      subjectLabel: "Tokyo / Japon (escale)",
      objectLabel: "Voyage Australie",
      evidence: ["escale explicite pendant voyage Australie", a.rawText.slice(0, 80)],
    }
  }
  if (bEscale && hasAustraliaTrip(a) && !hasJapanLocal(a)) {
    return {
      type: "PART_OF_TRIP",
      subjectSourceId: objectSourceId,
      objectSourceId: subjectSourceId,
      subjectLabel: "Tokyo / Japon (escale)",
      objectLabel: "Voyage Australie",
      evidence: ["escale explicite pendant voyage Australie", b.rawText.slice(0, 80)],
    }
  }
  // Both Japan escale and Australia content on either side with explicit link in either
  if ((aEscale || bEscale) && hasAustraliaTrip(a) && hasAustraliaTrip(b)) {
    return {
      type: "PART_OF_TRIP",
      subjectSourceId: aEscale ? subjectSourceId : objectSourceId,
      objectSourceId: aEscale ? objectSourceId : subjectSourceId,
      subjectLabel: "Tokyo / Japon (escale)",
      objectLabel: "Voyage Australie",
      evidence: ["escale + contexte Australie sur les deux sources"],
    }
  }
  // One source is Japan with escale-to-Australia, other also Japan local but Australia trip — SAME_TRIP via parent
  if (
    (aEscale && hasJapanLocal(b) && hasAustraliaTrip(b)) ||
    (bEscale && hasJapanLocal(a) && hasAustraliaTrip(a))
  ) {
    return {
      type: "SAME_TRIP",
      subjectSourceId,
      objectSourceId,
      subjectLabel,
      objectLabel,
      evidence: ["même voyage Australie (escale Japon incluse)"],
    }
  }

  const trips = tripOverlap(a, b)
  if (trips.length) {
    return {
      type: "SAME_TRIP",
      subjectSourceId,
      objectSourceId,
      subjectLabel,
      objectLabel,
      evidence: trips.map((t) => `trip: ${t}`),
    }
  }

  // Implicit SAME_TRIP: both Australia (including Whitehaven/Sydney/road trip) without needing identical trip string
  if (hasAustraliaTrip(a) && hasAustraliaTrip(b)) {
    return {
      type: "SAME_TRIP",
      subjectSourceId,
      objectSourceId,
      subjectLabel,
      objectLabel,
      evidence: ["contexte voyage Australie explicite des deux côtés"],
    }
  }

  const locs = locationOverlap(a, b)
  if (locs.length) {
    return {
      type: "SAME_LOCATION",
      subjectSourceId,
      objectSourceId,
      subjectLabel,
      objectLabel,
      evidence: locs.map((l) => `lieu: ${l}`),
    }
  }

  const dates = dateOverlap(a, b)
  if (dates.length) {
    return {
      type: "SAME_PERIOD",
      subjectSourceId,
      objectSourceId,
      subjectLabel,
      objectLabel,
      evidence: dates.map((d) => `date: ${d}`),
    }
  }

  const events = eventOverlap(a, b)
  // Shared generic events alone are weak unless specific milestone shared meaningfully
  const strongEvents = events.filter(
    (e) => e !== "rire" && e !== "escale",
  )
  if (strongEvents.length) {
    return {
      type: "SAME_EVENT",
      subjectSourceId,
      objectSourceId,
      subjectLabel,
      objectLabel,
      evidence: strongEvents.map((e) => `event: ${e}`),
    }
  }

  const actors = actorOverlap(a, b)
  if (actors.length >= 1) {
    return {
      type: "RELATED_TO",
      subjectSourceId,
      objectSourceId,
      subjectLabel,
      objectLabel,
      evidence: actors.map((n) => `participant: ${n}`),
    }
  }

  return {
    type: "NONE",
    subjectSourceId,
    objectSourceId,
    subjectLabel,
    objectLabel,
    evidence: [],
  }
}

export function relationLevel(relation: SourceRelation): EditorialRelationLevel {
  if (STRONG_TYPES.has(relation.type)) return "STRONG"
  return "NEUTRAL"
}

/**
 * Pairwise editorial compatibility for packing.
 * same participants alone → NEUTRAL (never STRONG).
 * category clash without STRONG relation → CONFLICT.
 */
export function pairEditorialCompatibility(
  a: PersonalSourceFacts,
  b: PersonalSourceFacts,
): {
  level: EditorialRelationLevel
  relation: SourceRelation
  reason: string
} {
  const relation = inferPairRelation(a, b)
  const levelFromRel = relationLevel(relation)

  if (levelFromRel === "STRONG") {
    return {
      level: "STRONG",
      relation,
      reason: formatRelationReason(relation),
    }
  }

  const workish = (f: PersonalSourceFacts) =>
    f.category === "WORK" ||
    f.events.includes("rendez-vous-pro") ||
    /\b(entreprise|d[eé]marchage|professionnel)\b/i.test(f.rawText)
  const travelish = (f: PersonalSourceFacts) =>
    f.category === "TRAVEL" ||
    f.tripContext.length > 0 ||
    f.events.includes("escale") ||
    /\b(voyage|australie|japon|whitehaven|sydney|road\s*trip)\b/i.test(f.rawText)

  if (
    (workish(a) && travelish(b)) ||
    (workish(b) && travelish(a))
  ) {
    return {
      level: "CONFLICT",
      relation,
      reason: `catégories incompatibles (WORK × TRAVEL) sans relation forte`,
    }
  }

  // Work vs non-work without STRONG → keep pro memories isolated
  if ((workish(a) && !workish(b)) || (workish(b) && !workish(a))) {
    return {
      level: "CONFLICT",
      relation,
      reason: "pro / hors-pro sans relation forte",
    }
  }

  // Travel vs non-travel without STRONG → CONFLICT (avoids false shared story)
  if (
    (travelish(a) && !travelish(b)) ||
    (travelish(b) && !travelish(a))
  ) {
    return {
      level: "CONFLICT",
      relation,
      reason: "voyage vs hors-voyage sans relation forte — fausse histoire commune",
    }
  }

  if (categoriesClash(a.category, b.category)) {
    return {
      level: "CONFLICT",
      relation,
      reason: `catégories incompatibles (${a.category} × ${b.category}) sans relation forte`,
    }
  }

  if (relation.type === "RELATED_TO") {
    return {
      level: "NEUTRAL",
      relation,
      reason: "same participants only",
    }
  }

  return {
    level: "NEUTRAL",
    relation,
    reason: "aucune incompatibilité — aucun lien éditorial fort",
  }
}

export function formatRelationReason(relation: SourceRelation): string {
  if (relation.type === "NONE") return "aucune relation"
  if (relation.type === "RELATED_TO") return "same participants only"
  if (relation.type === "PART_OF_TRIP") {
    return `${relation.subjectLabel} PART_OF_TRIP ${relation.objectLabel}`
  }
  return `${relation.type}: ${relation.subjectLabel} ↔ ${relation.objectLabel}`
}

export function blockPairCompatibility(
  a: PersonalBlockV1,
  b: PersonalBlockV1,
): ReturnType<typeof pairEditorialCompatibility> {
  return pairEditorialCompatibility(a.facts, b.facts)
}

export function groupEditorialCompatibility(blocks: PersonalBlockV1[]): {
  level: EditorialRelationLevel
  reason: string
  relations: SourceRelation[]
} {
  if (blocks.length <= 1) {
    return { level: "STRONG", reason: "page mono-bloc", relations: [] }
  }
  const relations: SourceRelation[] = []
  let hasConflict = false
  let hasStrong = false
  const reasons: string[] = []

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const r = blockPairCompatibility(blocks[i]!, blocks[j]!)
      relations.push(r.relation)
      if (r.level === "CONFLICT") {
        hasConflict = true
        reasons.push(r.reason)
      } else if (r.level === "STRONG") {
        hasStrong = true
        reasons.push(r.reason)
      } else {
        reasons.push(r.reason)
      }
    }
  }

  if (hasConflict) {
    return {
      level: "CONFLICT",
      reason: reasons.find((x) => /incompatibles/i.test(x)) || reasons[0] || "CONFLICT",
      relations,
    }
  }
  // Mixed STRONG + NEUTRAL pairs → page is NEUTRAL (no false common theme)
  const hasNeutralPair = relations.some(
    (r) => !STRONG_TYPES.has(r.type) && r.type !== "NONE",
  )
  const hasNonePair = relations.some((r) => r.type === "NONE")
  if (hasStrong && (hasNeutralPair || hasNonePair)) {
    return {
      level: "NEUTRAL",
      reason: "regroupement mixte — pas de thème commun pour tous les blocs",
      relations,
    }
  }
  if (hasStrong) {
    return {
      level: "STRONG",
      reason: reasons.find((x) => !/same participants|aucun/i.test(x)) || reasons[0]!,
      relations,
    }
  }
  return {
    level: "NEUTRAL",
    reason: reasons.every((r) => /same participants/i.test(r))
      ? "same participants only"
      : reasons[0] || "NEUTRAL",
    relations,
  }
}

/**
 * Kicker from THIS block's facts only — never inherits page trip theme.
 */
export function localBlockKicker(facts: PersonalSourceFacts): string | null {
  const locs = facts.locations
  const text = facts.rawText

  if (
    facts.events.includes("escale") ||
    /escale/i.test(text)
  ) {
    if (locs.some((l) => /tokyo/i.test(l)) || /tokyo/i.test(text)) {
      return "ESCALE AU JAPON"
    }
    if (locs.some((l) => /japon/i.test(l)) || /japon|onsen/i.test(text)) {
      return "ESCALE AU JAPON"
    }
  }

  if (locs.some((l) => /tokyo/i.test(l)) || (/tokyo/i.test(text) && /onsen|japon/i.test(text))) {
    return "TOKYO"
  }
  if (locs.some((l) => /japon|onsen/i.test(l)) || /onsen/i.test(text)) {
    return "JAPON"
  }
  if (locs.some((l) => /whitehaven/i.test(l))) return "WHITEHAVEN BEACH"
  if (locs.some((l) => /sydney/i.test(l)) || /sydney\s+tower/i.test(text)) {
    return "SYDNEY"
  }
  if (locs.some((l) => /porto|portugal|penha/i.test(l)) || /porto/i.test(text)) {
    return "PORTO"
  }
  if (locs.some((l) => /eysines/i.test(l)) || /eysines/i.test(text)) {
    return "EYSINES"
  }
  if (facts.events.includes("premier-bisou") || /premier\s+baiser|premier\s+bisou/i.test(text)) {
    return locs[0]?.toUpperCase() || "LES DÉBUTS"
  }
  if (
    facts.events.includes("rendez-vous-pro") ||
    /d[eé]marchage|entreprise/i.test(text)
  ) {
    return "LES DÉBUTS"
  }

  // Prefer concrete location over parent trip
  if (locs[0]) return locs[0].toUpperCase()

  // Trip only when no more specific place
  if (facts.tripContext[0]) return facts.tripContext[0].toUpperCase()

  return null
}
