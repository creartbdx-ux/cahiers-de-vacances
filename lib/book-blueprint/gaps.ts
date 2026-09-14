import type { CapabilityGap, PageFamily } from "./types"
import type { BlueprintPageSlot } from "./types"

/**
 * Derive capability gaps from planned pages — drives what to build next.
 */
export function computeCapabilityGaps(
  pages: BlueprintPageSlot[],
  audience: "ME" | "OTHER_PERSON" | "DUO" | "GROUP",
  availableData: {
    photos: number
    memories: number
    personalFacts: number
    interests: number
  },
): CapabilityGap[] {
  const familiesOfInterest: PageFamily[] = [
    "QUICK_GAME",
    "PERSONAL_EDITORIAL",
    "MEMORY",
    "PHOTO",
    "PERSONAL_GAME",
    "BREATHER",
    "THEME_GAME",
    "OPENING",
    "CLOSING",
  ]

  const gaps: CapabilityGap[] = []

  for (const family of familiesOfInterest) {
    const familyPages = pages.filter((p) => p.family === family)
    if (!familyPages.length) continue

    const pagesNeeded = familyPages.length
    const ready = familyPages.filter((p) => p.implementationStatus === "READY").length
    const missingOrPartial = familyPages.filter((p) => p.implementationStatus !== "READY").length
    if (missingOrPartial === 0 && family !== "THEME_GAME") continue

    // For THEME_GAME, only report gap on MISSING variety slots
    if (family === "THEME_GAME") {
      const variety = familyPages.filter((p) => p.archetypeId === "THEME_VARIETY_GAME")
      if (!variety.length) continue
      gaps.push({
        family,
        archetypeId: "THEME_VARIETY_GAME",
        label: "Nouvelles mécaniques de jeux thématiques",
        pagesNeeded: variety.length,
        ready: 0,
        gap: variety.length,
        priority: variety.length >= 5 ? "HIGH" : "MEDIUM",
        audiences: [audience],
        availableData: dataHints(availableData),
        mechanicTags: ["variety", "theme", "main"],
        recommendation: `Besoin de ${variety.length} pages de jeux thématiques avec de nouvelles mécaniques (au-delà de quiz / mots mêlés / mots croisés).`,
      })
      continue
    }

    if (missingOrPartial === 0) continue

    const priority =
      missingOrPartial >= 5 ? "HIGH" : missingOrPartial >= 3 ? "MEDIUM" : "LOW"

    const label = familyLabel(family)
    gaps.push({
      family,
      label,
      pagesNeeded,
      ready,
      gap: missingOrPartial,
      priority,
      audiences: [audience],
      availableData: dataHints(availableData, family),
      mechanicTags: tagsForFamily(family),
      recommendation: recommendationFor(family, missingOrPartial, audience, availableData),
    })
  }

  // Sort HIGH first
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  gaps.sort((a, b) => order[a.priority] - order[b.priority] || b.gap - a.gap)
  return gaps
}

function familyLabel(family: PageFamily): string {
  switch (family) {
    case "QUICK_GAME":
      return "Jeux rapides / activités légères"
    case "MEMORY":
      return "Blocs souvenirs (HERO)"
    case "PHOTO":
      return "Blocs photo (HERO)"
    case "PERSONAL_EDITORIAL":
      return "Pages personnelles composites"
    case "PERSONAL_GAME":
      return "Pages personnelles ludiques"
    case "BREATHER":
      return "Respirations / transitions"
    case "OPENING":
      return "Pages d'ouverture"
    case "CLOSING":
      return "Pages de clôture"
    default:
      return family
  }
}

function tagsForFamily(family: PageFamily): string[] {
  switch (family) {
    case "QUICK_GAME":
      return ["quick", "light", "activity"]
    case "MEMORY":
      return ["memory", "block"]
    case "PHOTO":
      return ["photo", "block"]
    case "PERSONAL_EDITORIAL":
      return ["personal", "editorial", "composite"]
    case "PERSONAL_GAME":
      return ["personal", "interaction"]
    case "BREATHER":
      return ["breather", "transition"]
    default:
      return []
  }
}

function dataHints(
  data: { photos: number; memories: number; personalFacts: number; interests: number },
  family?: PageFamily,
): string[] {
  const hints: string[] = []
  if (!family || family === "PHOTO" || family === "PERSONAL_EDITORIAL") {
    hints.push(`${data.photos} photo(s)`)
  }
  if (!family || family === "MEMORY" || family === "PERSONAL_EDITORIAL") {
    hints.push(`${data.memories} souvenir(s)`)
  }
  if (!family || family === "PERSONAL_GAME" || family === "QUICK_GAME") {
    hints.push(`${data.personalFacts} fait(s) personnel(s)`)
  }
  if (!family || family === "THEME_GAME") hints.push(`${data.interests} intérêt(s)`)
  return hints
}

function recommendationFor(
  family: PageFamily,
  gap: number,
  audience: string,
  data: { photos: number; memories: number; personalFacts: number; interests: number },
): string {
  switch (family) {
    case "QUICK_GAME":
      return `Besoin de ${gap} pages de jeux rapides, particulièrement pour ${audience}.`
    case "MEMORY":
      return `Besoin de ${gap} pages HERO souvenir encore non READY${data.memories ? ` — ${data.memories} souvenir(s) disponibles` : ""}.`
    case "PHOTO":
      return `Besoin de ${gap} pages HERO photo encore non READY${data.photos ? ` — ${data.photos} photo(s) disponibles` : ""}.`
    case "PERSONAL_EDITORIAL":
      return `Besoin de ${gap} pages personnelles composites encore non READY (${data.memories} souvenir(s), ${data.photos} photo(s)).`
    case "PERSONAL_GAME":
      return `Besoin de ${gap} pages personnelles ludiques adaptées à ${audience}.`
    case "BREATHER":
      return `Besoin de ${gap} pages de respiration / transition éditoriale.`
    case "OPENING":
      return `Page d'ouverture intérieure encore partielle (hors couverture).`
    case "CLOSING":
      return `Page de clôture encore partielle.`
    default:
      return `Besoin de ${gap} pages ${family}.`
  }
}
