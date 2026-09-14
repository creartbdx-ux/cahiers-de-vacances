import type { PersonalBlockV1, PersonalEditorialPageTheme } from "./types"
import { groupCompatibilityScore, isNeutralGrouping } from "./compatibility"
import { validatePageTitle } from "./validate-editorial"
import {
  factsSupportAustraliaJapanLink,
  factsShareTrip,
  type PersonalSourceFacts,
} from "./facts"

function uniq(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))]
}

function blockFacts(b: PersonalBlockV1): PersonalSourceFacts | null {
  return b.facts ?? null
}

/**
 * Natural page title from blocks — NEVER concatenates tags with "&".
 */
export function buildNaturalPageCopy(blocks: PersonalBlockV1[]): PersonalEditorialPageTheme {
  const sourceIds = blocks.map((b) =>
    b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId,
  )
  const tags = uniq(blocks.flatMap((b) => b.semanticTags))
  const locations = uniq(blocks.flatMap((b) => b.locations))
  const trips = uniq(blocks.flatMap((b) => b.trips))
  const categories = uniq(blocks.map((b) => b.semanticCategory))
  const compat = groupCompatibilityScore(blocks)
  const allFacts = blocks.map(blockFacts).filter(Boolean) as PersonalSourceFacts[]

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

  if (isNeutralGrouping(blocks) || compat < 0.55) {
    const title = pickNeutralTitle(sourceIds.join(":"))
    return {
      themeType: "NEUTRAL_MOMENTS",
      title,
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: "Regroupement neutre — aucune thématique forcée",
    }
  }

  // Strong Australia trip shared by all
  const ausBlocks = blocks.filter(
    (b) =>
      b.trips.some((t) => /australie/i.test(t)) ||
      b.locations.some((l) => /australie|whitehaven|sydney/i.test(l)),
  )
  const japanBlocks = blocks.filter(
    (b) =>
      b.locations.some((l) => /japon|tokyo|onsen/i.test(l)) ||
      b.trips.some((t) => /japon/i.test(t)),
  )

  if (ausBlocks.length === blocks.length) {
    return finishTitle(
      {
        themeType: "THEMED",
        title: "En Australie",
        subtitle: null,
        semanticTags: tags,
        sourceIds,
        groupingReason: "Voyage Australie explicite sur tous les blocs",
      },
    )
  }

  if (
    ausBlocks.length > 0 &&
    japanBlocks.length > 0 &&
    allFacts.length >= 2 &&
    allFacts.some((a, i) =>
      allFacts.some((b, j) => i < j && factsSupportAustraliaJapanLink(a, b)),
    )
  ) {
    return finishTitle({
      themeType: "THEMED",
      title: "D’Australie au Japon",
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: "Escale Japon explicitement liée au voyage Australie",
    })
  }

  if (
    categories.every((c) => c === "RELATIONSHIP" || c === "MILESTONE" || c === "WORK") &&
    (tags.some((t) => t.includes("premier") || t === "premier-bisou") ||
      blocks.some(
        (b) =>
          b.semanticTags.includes("professionnel") || /début/i.test(b.kicker || ""),
      ))
  ) {
    const hasDebutSignal = blocks.some(
      (b) =>
        /premier/i.test(b.originalText) ||
        /premier/i.test(b.displayText) ||
        b.semanticTags.some((t) => t.includes("premier")),
    )
    if (hasDebutSignal) {
      return finishTitle({
        themeType: "THEMED",
        title: "Les débuts",
        subtitle: null,
        semanticTags: tags,
        sourceIds,
        groupingReason: "Repères de début explicitement présents",
      })
    }
  }

  if (trips.length === 1 && blocks.every((b) => b.trips.includes(trips[0]!) || b.locations.some((l) => l.toLowerCase().includes(trips[0]!.toLowerCase())))) {
    return finishTitle({
      themeType: "THEMED",
      title: `En ${trips[0]}`,
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: "Même voyage explicite",
    })
  }

  if (locations.length === 1) {
    return finishTitle({
      themeType: "THEMED",
      title: locations[0]!,
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: "Lieu explicite commun",
    })
  }

  if (locations.length === 2 && compat >= 0.7) {
    // Natural pairing without &
    return finishTitle({
      themeType: "THEMED",
      title: `${locations[0]} · ${locations[1]}`,
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: "Deux lieux explicites",
    })
  }

  return {
    themeType: "NEUTRAL_MOMENTS",
    title: pickNeutralTitle(sourceIds.join(":")),
    subtitle: null,
    semanticTags: tags,
    sourceIds,
    groupingReason: "Pas de dénominateur commun assez fort",
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
  return theme
}

const NEUTRAL_TITLES = [
  "Quelques moments",
  "Petits fragments",
  "Instants choisis",
  "Souvenirs en suspens",
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

void factsShareTrip
