import type { CapabilityGap } from "./types"
import type { BlueprintPageSlot } from "./types"
import { getArchetype } from "./archetypes"

/**
 * Capability gaps by missing *mechanics*, not generic "personal pages".
 * Personalization is transversal (touches) — gaps list engines to build.
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
  const gaps: CapabilityGap[] = []

  // Group MISSING/PARTIAL by mechanic family (skip legacy reflection quota)
  const byMechanic = new Map<
    string,
    { pages: BlueprintPageSlot[]; labels: Set<string>; archetypeIds: Set<string> }
  >()

  for (const p of pages) {
    if (p.implementationStatus === "READY") continue
    if (p.archetypeId === "PERSONAL_REFLECTION") continue // deprecated quota — ignore
    if (p.family === "OPENING" || p.family === "CLOSING" || p.family === "CORRECTION") {
      // Still report opening/closing as soft gaps once
      continue
    }

    const arch = safeArchetype(p.archetypeId)
    const mechanic =
      arch?.mechanicFamily ??
      (p.family === "THEME_GAME" && p.archetypeId === "THEME_VARIETY_GAME"
        ? "VARIETY"
        : p.family === "PHOTO"
          ? "PHOTO"
          : p.family === "BREATHER"
            ? "BREATHER"
            : "OTHER")

    const bucket = byMechanic.get(mechanic) ?? {
      pages: [],
      labels: new Set<string>(),
      archetypeIds: new Set<string>(),
    }
    bucket.pages.push(p)
    bucket.labels.add(p.label)
    bucket.archetypeIds.add(p.archetypeId)
    byMechanic.set(mechanic, bucket)
  }

  for (const [mechanic, bucket] of byMechanic) {
    const gap = bucket.pages.length
    if (gap === 0) continue
    const priority = gap >= 5 ? "HIGH" : gap >= 3 ? "MEDIUM" : "LOW"
    gaps.push({
      family: bucket.pages[0]!.family,
      archetypeId: [...bucket.archetypeIds][0],
      label: mechanicLabel(mechanic),
      pagesNeeded: gap,
      ready: 0,
      gap,
      priority,
      audiences: [audience],
      availableData: dataHints(availableData, mechanic),
      mechanicTags: [mechanic.toLowerCase()],
      recommendation: recommendationForMechanic(mechanic, gap, audience, availableData),
    })
  }

  // Opening / closing once if partial
  for (const family of ["OPENING", "CLOSING"] as const) {
    const familyPages = pages.filter((p) => p.family === family)
    const missing = familyPages.filter((p) => p.implementationStatus !== "READY")
    if (!missing.length) continue
    gaps.push({
      family,
      label: family === "OPENING" ? "Pages d'ouverture" : "Pages de clôture",
      pagesNeeded: missing.length,
      ready: familyPages.length - missing.length,
      gap: missing.length,
      priority: "LOW",
      audiences: [audience],
      availableData: [],
      mechanicTags: [family.toLowerCase()],
      recommendation:
        family === "OPENING"
          ? "Page d'ouverture intérieure encore partielle (hors couverture)."
          : "Page de clôture encore partielle.",
    })
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  gaps.sort((a, b) => order[a.priority] - order[b.priority] || b.gap - a.gap)
  return gaps
}

function safeArchetype(id: string) {
  try {
    return getArchetype(id)
  } catch {
    return null
  }
}

function mechanicLabel(mechanic: string): string {
  switch (mechanic) {
    case "LOGIC":
      return "Jeux de logique / codes"
    case "SECRET_CODE":
      return "Jeux mot secret / message caché"
    case "PERSONALITY_TEST":
      return "Tests de personnalité"
    case "VARIETY":
      return "Nouvelles mécaniques thématiques"
    case "QUICK":
      return "Jeux rapides / activités légères"
    case "QUIZ":
      return "Quiz"
    case "WORDSEARCH":
      return "Mots mêlés"
    case "CROSSWORD":
      return "Mots croisés"
    case "TRUE_FALSE":
      return "Vrai / faux"
    case "PHOTO":
      return "Pages album photo"
    case "BREATHER":
      return "Respirations / transitions"
    case "RANKING":
      return "Jeux de classement / ordre"
    case "VISUAL":
      return "Jeux visuels / observation"
    default:
      return `Mécanique ${mechanic}`
  }
}

function dataHints(
  data: { photos: number; memories: number; personalFacts: number; interests: number },
  mechanic: string,
): string[] {
  const hints: string[] = []
  if (mechanic === "PHOTO") hints.push(`${data.photos} photo(s)`)
  if (mechanic === "QUIZ" || mechanic === "TRUE_FALSE") {
    hints.push(`${data.personalFacts} fait(s)`, `${data.memories} souvenir(s)`)
  }
  if (mechanic === "VARIETY" || mechanic === "WORDSEARCH" || mechanic === "CROSSWORD") {
    hints.push(`${data.interests} intérêt(s)`)
  }
  return hints
}

function recommendationForMechanic(
  mechanic: string,
  gap: number,
  audience: string,
  data: { photos: number; memories: number; personalFacts: number; interests: number },
): string {
  switch (mechanic) {
    case "LOGIC":
      return `Besoin de ${gap} page(s) de jeux de logique / codes (âge, proches comme labels, etc.).`
    case "SECRET_CODE":
      return `Besoin de ${gap} page(s) mot secret / message caché (ex. prénom du destinataire).`
    case "PERSONALITY_TEST":
      return `Besoin de ${gap} page(s) de test de personnalité contextualisé par les traits.`
    case "VARIETY":
      return `Besoin de ${gap} pages de jeux thématiques avec de nouvelles mécaniques (au-delà de quiz / mots mêlés / mots croisés).`
    case "QUICK":
      return `Besoin de ${gap} pages de jeux rapides / activités légères pour ${audience}.`
    case "PHOTO":
      return `Besoin de ${gap} pages album photo encore non READY${data.photos ? ` — ${data.photos} photo(s)` : ""}.`
    case "BREATHER":
      return `Besoin de ${gap} pages de respiration / transition éditoriale.`
    default:
      return `Besoin de ${gap} page(s) pour la mécanique ${mechanic}.`
  }
}
