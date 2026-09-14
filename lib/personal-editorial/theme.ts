import type { PersonalBlockV1, PersonalEditorialPageTheme, PersonalPageThemeType } from "./types"
import { groupCompatibilityScore, groupSourceIds, isNeutralGrouping } from "./compatibility"

function uniq(xs: string[]): string[] {
  return [...new Set(xs)]
}

/**
 * Derive a page theme ONLY from blocks present.
 * Never invents a journey/timeline not supported by sources.
 */
export function buildPageTheme(
  blocks: PersonalBlockV1[],
  options?: { isHero?: boolean; isSingle?: boolean },
): PersonalEditorialPageTheme {
  const sourceIds = groupSourceIds(blocks)
  const tags = uniq(blocks.flatMap((b) => b.semanticTags))
  const locations = uniq(blocks.flatMap((b) => b.locations))
  const trips = uniq(blocks.flatMap((b) => b.trips))
  const categories = uniq(blocks.map((b) => b.semanticCategory))
  const compat = groupCompatibilityScore(blocks)

  if (options?.isHero) {
    const lead = blocks[0]!
    const title =
      lead.shortTitle?.trim() ||
      lead.locations[0] ||
      lead.title?.trim() ||
      "Souvenir"
    return {
      themeType: "HERO",
      title,
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: "Contenu RICH — pleine page",
    }
  }

  if (options?.isSingle || blocks.length === 1) {
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
    return {
      themeType: "NEUTRAL_MOMENTS",
      title: "Quelques moments",
      subtitle: null,
      semanticTags: tags,
      sourceIds,
      groupingReason: "Regroupement neutre — aucune thématique forcée",
    }
  }

  let themeType: PersonalPageThemeType = "THEMED"
  let title = "Quelques moments"
  let reason = "Affinité sémantique"

  if (categories.length === 1 && categories[0] === "TRAVEL") {
    if (trips.length >= 2) {
      title = trips.slice(0, 3).join(" & ")
      reason = "Même famille voyage — lieux explicites"
    } else if (trips.length === 1) {
      const trip = trips[0]!
      const related = blocks.filter(
        (b) =>
          b.trips.some((t) => t.toLowerCase() === trip.toLowerCase()) ||
          b.locations.some((l) => l.toLowerCase().includes(trip.toLowerCase())),
      )
      if (related.length === blocks.length) {
        title = trip
        reason = "Voyage explicitement mentionné"
      } else if (locations.length >= 2) {
        title = locations.slice(0, 3).join(" · ")
        reason = "Lieux de voyage distincts — pas un seul récit"
      } else {
        themeType = "NEUTRAL_MOMENTS"
        title = "Quelques voyages"
        reason = "Voyages non unifiés"
      }
    } else if (locations.length >= 2) {
      title = locations.slice(0, 3).join(" · ")
      reason = "Lieux explicites partagés"
    } else if (locations.length === 1) {
      title = locations[0]!
      reason = "Lieu explicite"
    } else {
      title = "Sur la route"
      reason = "Catégorie TRAVEL commune"
    }
  } else if (
    categories.every((c) => c === "RELATIONSHIP" || c === "MILESTONE") &&
    tags.some((t) => t.includes("premier") || t === "premier-bisou")
  ) {
    title = "Les débuts"
    reason = "Repères de début explicitement présents"
  } else if (categories.every((c) => c === "RELATIONSHIP" || c === "MILESTONE")) {
    title = "À deux"
    reason = "Catégorie relationnelle commune"
  } else if (locations.length >= 2) {
    title = locations.slice(0, 3).join(" · ")
    reason = "Lieux explicites"
  } else if (compat >= 0.7) {
    title = locations[0] || trips[0] || "Moments liés"
    reason = `Compatibilité élevée (${compat.toFixed(2)})`
  } else {
    themeType = "NEUTRAL_MOMENTS"
    title = "Petits fragments"
    reason = "Affinité modérée — thème neutre"
  }

  return {
    themeType,
    title,
    subtitle: null,
    semanticTags: tags,
    sourceIds,
    groupingReason: reason,
  }
}
