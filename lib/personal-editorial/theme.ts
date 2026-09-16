import type { PersonalBlockV1, PersonalEditorialPageTheme } from "./types"
import { groupRelationMeta, isNeutralGrouping } from "./compatibility"
import { validatePageTitle } from "./validate-editorial"
import {
  factsSupportAustraliaJapanLink,
  type PersonalSourceFacts,
} from "./facts"
import {
  hasAustraliaTrip,
  hasExplicitAustraliaJapanEscale,
  hasJapanLocal,
} from "./relations"

function uniq(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))]
}

function blockFacts(b: PersonalBlockV1): PersonalSourceFacts | null {
  return b.facts ?? null
}

/**
 * Natural page title from blocks — NEVER concatenates tags with "&".
 * NEUTRAL pages never invent a common story between unrelated places.
 */
export function buildNaturalPageCopy(blocks: PersonalBlockV1[]): PersonalEditorialPageTheme {
  const sourceIds = blocks.map((b) =>
    b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId,
  )
  const tags = uniq(blocks.flatMap((b) => b.semanticTags))
  const locations = uniq(blocks.flatMap((b) => b.locations))
  const trips = uniq(blocks.flatMap((b) => b.trips))
  const allFacts = blocks.map(blockFacts).filter(Boolean) as PersonalSourceFacts[]
  const meta = groupRelationMeta(blocks)

  if (blocks.length === 1) {
    const lead = blocks[0]!
    return {
      themeType: "SINGLE",
      title: lead.shortTitle?.trim() || lead.locations[0] || "Un moment",
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: "Bloc seul",
    }
  }

  if (meta.level === "NEUTRAL" || isNeutralGrouping(blocks)) {
    return {
      themeType: "NEUTRAL_MOMENTS",
      title: pickNeutralTitle(sourceIds.join(":")),
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: meta.reason || "Regroupement neutre — aucune thématique forcée",
    }
  }

  // STRONG: Australia + Japan escale
  const hasAusJapan =
    allFacts.some((f) => hasExplicitAustraliaJapanEscale(f)) &&
    allFacts.some((f) => hasAustraliaTrip(f)) &&
    (allFacts.some((f) => hasJapanLocal(f)) ||
      allFacts.some((a, i) =>
        allFacts.some((b, j) => i < j && factsSupportAustraliaJapanLink(a, b)),
      ))

  if (hasAusJapan) {
    return finishTitle({
      themeType: "THEMED",
      title: "Australie, avec une escale au Japon",
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: meta.reason,
    })
  }

  const allAustralia = blocks.every(
    (b) =>
      hasAustraliaTrip(b.facts) ||
      b.trips.some((t) => /australie/i.test(t)) ||
      b.locations.some((l) => /australie|whitehaven|sydney/i.test(l)),
  )
  if (allAustralia) {
    return finishTitle({
      themeType: "THEMED",
      title: "En Australie",
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: meta.reason || "Voyage Australie explicite",
    })
  }

  if (
    blocks.every(
      (b) =>
        b.semanticCategory === "RELATIONSHIP" ||
        b.semanticCategory === "MILESTONE" ||
        b.semanticCategory === "WORK",
    ) &&
    blocks.some(
      (b) =>
        /premier/i.test(b.originalText) ||
        b.semanticTags.some((t) => t.includes("premier")) ||
        b.facts.events.includes("rendez-vous-pro") ||
        b.facts.events.includes("premier-bisou"),
    )
  ) {
    return finishTitle({
      themeType: "THEMED",
      title: "Les débuts",
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: meta.reason || "Repères de début explicitement présents",
    })
  }

  if (
    trips.length === 1 &&
    blocks.every(
      (b) =>
        b.trips.includes(trips[0]!) ||
        b.locations.some((l) => l.toLowerCase().includes(trips[0]!.toLowerCase())),
    )
  ) {
    return finishTitle({
      themeType: "THEMED",
      title: `En ${trips[0]}`,
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: meta.reason || "Même voyage explicite",
    })
  }

  if (locations.length === 1) {
    return finishTitle({
      themeType: "THEMED",
      title: locations[0]!,
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: meta.reason || "Lieu explicite commun",
    })
  }

  // Never "Eysines · Porto" / location concat without SAME_LOCATION STRONG
  return {
    themeType: "NEUTRAL_MOMENTS",
    title: pickNeutralTitle(sourceIds.join(":")),
    subtitle: null,
    semanticTags: tags,
    sourceIds,
    groupingReason: meta.reason || "Pas de dénominateur commun assez fort",
  }
}

function finishTitle(theme: PersonalEditorialPageTheme): PersonalEditorialPageTheme {
  const v = validatePageTitle(theme.title)
  if (!v.ok) {
    return {
      ...theme,
      themeType: "NEUTRAL_MOMENTS",
      title: pickNeutralTitle(theme.sourceIds.join(":")),
      groupingReason: `${theme.groupingReason} — titre corrigé (anti-concat)`,
    }
  }
  // Ban "X et Y" / "X · Y" style place mashups in themed titles when places differ
  if (/\bet\b|·/.test(theme.title) && /eysines|porto|tokyo|sydney/i.test(theme.title)) {
    return {
      ...theme,
      themeType: "NEUTRAL_MOMENTS",
      title: pickNeutralTitle(theme.sourceIds.join(":")),
      groupingReason: `${theme.groupingReason} — concaténation de lieux refusée`,
    }
  }
  return theme
}

const NEUTRAL_TITLES = [
  "Quelques moments",
  "Petits fragments",
  "Instants choisis",
  "Pages personnelles",
]

function pickNeutralTitle(seedKey: string): string {
  let h = 2166136261
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return NEUTRAL_TITLES[(h >>> 0) % NEUTRAL_TITLES.length]!
}

/** @deprecated Use buildNaturalPageCopy — kept for imports. */
export function buildPageTheme(
  blocks: PersonalBlockV1[],
  options?: { isHero?: boolean; isSingle?: boolean },
): PersonalEditorialPageTheme {
  if (options?.isHero) {
    const lead = blocks[0]!
    return {
      themeType: "HERO",
      title: lead.shortTitle?.trim() || lead.locations[0] || lead.title || "Souvenir",
      subtitle: null,
      semanticTags: uniq(blocks.flatMap((b) => b.semanticTags)),
      sourceIds: blocks.map((b) =>
        b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId,
      ),
      groupingReason: "Contenu RICH — pleine page",
    }
  }
  return buildNaturalPageCopy(blocks)
}
