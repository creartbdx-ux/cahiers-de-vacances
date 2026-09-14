import type { BookProfileV1 } from "@/lib/questionnaire/types"

/**
 * Human-facing name for the cover — never exposes IDs or technical labels.
 */
export function resolveCoverDisplayName(profile: BookProfileV1): string {
  const names = profile.participants.map((p) => p.firstName.trim()).filter(Boolean)

  switch (profile.audience) {
    case "ME":
      return names[0] || "Toi"
    case "OTHER_PERSON":
      return names[0] || "Pour toi"
    case "DUO":
      if (names.length >= 2) return `${names[0]} & ${names[1]}`
      if (names.length === 1) return names[0]!
      return "Duo"
    case "GROUP": {
      const group = profile.groupName?.trim()
      if (group) return group
      if (names.length >= 2) return names.slice(0, 3).join(", ")
      if (names.length === 1) return names[0]!
      return "Le groupe"
    }
    default:
      return names[0] || "Cahier"
  }
}

export function resolveCoverSubtitle(profile: BookProfileV1): string {
  switch (profile.audience) {
    case "ME":
    case "OTHER_PERSON":
      return "Édition personnalisée"
    case "DUO":
      return "Édition duo"
    case "GROUP":
      return "Édition de groupe"
    default:
      return "Édition personnalisée"
  }
}
