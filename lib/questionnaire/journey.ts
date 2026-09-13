/**
 * Adaptive questionnaire journey: step lists + audience-aware copy.
 * Pure presentation helpers — does not invent profile data.
 */

import { deriveCreatorIsParticipant } from "./audience"
import type { AudienceType, QuestionnaireV1 } from "./types"

export type StepId =
  | "audience"
  | "participants"
  | "personality"
  | "interests"
  | "personalFacts"
  | "memories"
  | "insideJokes"
  | "games"
  | "photos"
  | "forbidden"
  | "color"
  | "style"
  | "finale"
  | "recap"

/** @deprecated use buildJourneySteps — kept for callers that only know audience. */
export function stepsForAudience(audience: AudienceType | null): StepId[] {
  return buildJourneySteps(audience, null)
}

export function buildJourneySteps(
  audience: AudienceType | null,
  creatorIsParticipant: boolean | null | undefined,
): StepId[] {
  const steps: StepId[] = ["audience"]
  if (!audience) return steps

  const isParticipant = deriveCreatorIsParticipant(audience, creatorIsParticipant)

  steps.push("participants", "personality", "interests", "personalFacts", "memories")

  if (audience === "DUO" || audience === "GROUP") {
    steps.push("insideJokes")
  }

  steps.push("games", "photos", "forbidden", "color", "style", "finale", "recap")

  // Journey shape is identical for participant vs not, but copy differs.
  // Keep isParticipant referenced so future step inserts stay easy.
  void isParticipant

  return steps
}

export interface StepCopy {
  title: string
  subtitle?: string
  /** Short nav label for progress. */
  navLabel: string
}

export function getStepCopy(step: StepId, q: QuestionnaireV1): StepCopy {
  const audience = q.audience
  const participant = audience
    ? deriveCreatorIsParticipant(audience, q.creatorIsParticipant)
    : false

  switch (step) {
    case "audience":
      return {
        navLabel: "Pour qui ?",
        title: "Pour qui créez-vous ce cahier ?",
        subtitle: "Le questionnaire s'adapte à votre réponse.",
      }
    case "participants":
      if (audience === "ME") {
        return { navLabel: "Vous", title: "Parlons de vous", subtitle: "Juste l'essentiel pour commencer." }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Cette personne",
          title: "Parlons de cette personne",
          subtitle: "Qui est la personne pour qui vous créez ce cahier ?",
        }
      }
      if (audience === "DUO") {
        return {
          navLabel: "Le duo",
          title: participant ? "Parlez-nous de vous deux" : "Présentez-nous ces deux personnes",
          subtitle: participant
            ? "Quelques informations pour personnaliser le cahier autour de votre duo."
            : "Quelques informations pour personnaliser le cahier autour de leur duo.",
        }
      }
      return {
        navLabel: "Le groupe",
        title: participant ? "Présentez votre groupe" : "Présentez-nous ce groupe",
        subtitle: "Prénoms obligatoires — le reste reste léger.",
      }
    case "personality":
      if (audience === "ME") {
        return { navLabel: "Personnalité", title: "Votre personnalité" }
      }
      if (audience === "OTHER_PERSON") {
        return { navLabel: "Personnalité", title: "Sa personnalité" }
      }
      if (audience === "DUO") {
        return {
          navLabel: "Personnalité",
          title: participant
            ? "Comment décririez-vous votre duo ?"
            : "Comment décririez-vous leur duo ?",
          subtitle: "Traits individuels et dynamique du duo.",
        }
      }
      return {
        navLabel: "Personnalité",
        title: participant
          ? "Comment décririez-vous votre bande ?"
          : "Comment décririez-vous cette bande ?",
      }
    case "interests":
      if (audience === "ME") {
        return {
          navLabel: "Goûts",
          title: "Ce que vous aimez",
          subtitle: "Sélectionnez au moins 3 choses qui vous correspondent.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Goûts",
          title: "Ce qu'il/elle aime",
          subtitle: "Sélectionnez au moins 3 choses qui lui correspondent.",
        }
      }
      if (audience === "DUO") {
        return {
          navLabel: "Goûts",
          title: participant ? "Ce que vous aimez ensemble" : "Ce qu'elles aiment ensemble",
          subtitle: participant
            ? "Sélectionnez au moins 3 choses qui vous ressemblent à deux."
            : "Sélectionnez au moins 3 choses qui les rassemblent.",
        }
      }
      return {
        navLabel: "Goûts",
        title: participant
          ? "Ce que vous aimez faire ensemble"
          : "Ce qu'ils aiment faire ensemble",
        subtitle: "Sélectionnez au moins 3 choses qui correspondent au groupe.",
      }
    case "personalFacts":
      if (audience === "ME") {
        return {
          navLabel: "Détails",
          title: "Quelques petits détails sur vous",
          subtitle:
            "Ce sont souvent ces petites choses qui rendent le cahier vraiment personnel. Ajoutez au moins 3 petits détails. 5 à 8 permettent d'aller encore plus loin.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Détails",
          title: "Quelques petits détails sur cette personne",
          subtitle: "Ajoutez au moins 3 petits détails. 5 à 8 rendent le cahier encore plus personnel.",
        }
      }
      if (audience === "DUO") {
        return {
          navLabel: "Détails",
          title: participant ? "Quelques petits détails sur vous" : "Quelques petits détails sur elles",
          subtitle: "Ajoutez au moins 3 détails. Vous pouvez préciser qui cela concerne.",
        }
      }
      return {
        navLabel: "Détails",
        title: participant
          ? "Les petites choses qui caractérisent votre groupe"
          : "Les petites choses qui caractérisent le groupe",
        subtitle: "Ajoutez au moins 3 détails. Vous pouvez préciser qui cela concerne.",
      }
    case "memories":
      if (audience === "ME") {
        return {
          navLabel: "Souvenirs",
          title: "Quelques moments qui vous ressemblent",
          subtitle:
            "Vous pouvez nous raconter un voyage marquant, une anecdote drôle, une expérience mémorable ou simplement un moment que vous aimez raconter.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Souvenirs",
          title: "Quelques souvenirs à son sujet",
          subtitle: "Un souvenir partagé, une anecdote, un voyage… tout est bienvenu.",
        }
      }
      if (audience === "DUO") {
        return {
          navLabel: "Souvenirs",
          title: participant ? "Vos souvenirs à deux" : "Leurs souvenirs à deux",
          subtitle: "Rencontre, voyage, anecdote drôle, habitude commune…",
        }
      }
      return {
        navLabel: "Souvenirs",
        title: participant ? "Les souvenirs de votre bande" : "Les souvenirs du groupe",
        subtitle: "Souvenir culte, soirée, voyage, tradition…",
      }
    case "insideJokes":
      if (audience === "GROUP") {
        return {
          navLabel: "Private jokes",
          title: participant ? "Vos private jokes" : "Leurs private jokes",
          subtitle: "Expressions, références communes, blagues internes… (facultatif)",
        }
      }
      return {
        navLabel: "Private jokes",
        title: "Private jokes & habitudes",
        subtitle: "Expressions, références communes, blagues internes… (facultatif)",
      }
    case "games":
      if (audience === "ME") {
        return { navLabel: "Jeux", title: "Les jeux que vous aimez" }
      }
      if (audience === "OTHER_PERSON") {
        return { navLabel: "Jeux", title: "Les jeux qu'il/elle aime" }
      }
      return {
        navLabel: "Jeux",
        title: participant ? "Les jeux que vous aimez" : "Les jeux qu'ils aiment",
      }
    case "photos":
      if (audience === "ME") {
        return {
          navLabel: "Photos",
          title: "Vos photos",
          subtitle:
            "Elles sont totalement facultatives, mais peuvent être utilisées pour rendre certaines pages encore plus personnelles.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Photos",
          title: "Quelques photos",
          subtitle: "Totalement facultatives — elles enrichissent le cahier sans être obligatoires.",
        }
      }
      return {
        navLabel: "Photos",
        title: "Photos",
        subtitle: "Totalement facultatives — max. 10.",
      }
    case "forbidden":
      if (audience === "ME") {
        return {
          navLabel: "À éviter",
          title: "Ce qu'on doit éviter",
          subtitle: "Y a-t-il des sujets, personnes ou événements à ne jamais évoquer ?",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "À éviter",
          title: "Ce qu'il ne faut surtout pas évoquer",
          subtitle: "Sujets sensibles, personnes, événements…",
        }
      }
      return {
        navLabel: "À éviter",
        title: "Sujets à éviter",
        subtitle: "Y a-t-il des sujets, personnes ou événements à ne jamais évoquer ?",
      }
    case "color":
      return {
        navLabel: "Couleurs",
        title: "Quelle ambiance de couleurs vous plaît ?",
        subtitle: "Choisissez une palette, ou laissez-nous vous surprendre.",
      }
    case "style":
      return {
        navLabel: "Style",
        title: "Quel univers graphique vous ressemble ?",
        subtitle: "Comparez les ambiances grâce aux aperçus.",
      }
    case "finale":
      if (audience === "ME") {
        return {
          navLabel: "Fin",
          title: "Une dernière chose à nous dire ?",
          subtitle: "Facultatif — tout ce qui pourrait nous aider.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Fin",
          title: "Derniers détails",
          subtitle: "Un mot personnel, ou une dernière précision.",
        }
      }
      if (participant) {
        return {
          navLabel: "Fin",
          title: "Une phrase ou un message à glisser dans le cahier ?",
          subtitle: "Facultatif.",
        }
      }
      return {
        navLabel: "Fin",
        title: "Un petit mot cadeau ?",
        subtitle: "Facultatif — un message à glisser dans le cahier.",
      }
    case "recap":
      if (audience === "ME") {
        return {
          navLabel: "Récap",
          title: "Votre cahier est prêt à être créé",
          subtitle: "Voici un aperçu de ce que nous avons retenu.",
        }
      }
      return {
        navLabel: "Récap",
        title: "Le cahier est prêt à être créé",
        subtitle: "Voici un aperçu de ce que nous avons retenu.",
      }
  }
}

export function memorySuggestions(audience: AudienceType | null): string[] {
  if (audience === "ME") {
    return [
      "Un voyage mémorable",
      "Une anecdote qui vous fait encore rire",
      "Un moment dont vous êtes fier/fière",
      "Un souvenir avec vos proches",
      "Une expérience improbable",
    ]
  }
  if (audience === "OTHER_PERSON") {
    return [
      "Un souvenir partagé",
      "Une anecdote drôle",
      "Un voyage",
      "Une habitude mémorable",
      "Un moment marquant",
    ]
  }
  if (audience === "DUO") {
    return [
      "Leur rencontre",
      "Un voyage",
      "Une anecdote drôle",
      "Un moment marquant",
      "Une habitude commune",
    ]
  }
  if (audience === "GROUP") {
    return [
      "Un souvenir culte",
      "Une soirée",
      "Un voyage",
      "Une catastrophe devenue drôle",
      "Une tradition",
      "Une private joke",
    ]
  }
  return []
}

export const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: "ME", label: "Pour moi" },
  { value: "OTHER_PERSON", label: "Pour quelqu'un" },
  { value: "DUO", label: "Pour deux personnes" },
  { value: "GROUP", label: "Pour un groupe d'amis" },
]

/** Forbidden wording for ME / OTHER_PERSON solo personality chips. */
export const FORBIDDEN_SOLO_TRAITS = ["complice", "opposés mais complémentaires"] as const

export function difficultyLabel(level: 1 | 2 | 3 | 4 | undefined): string {
  switch (level) {
    case 1:
      return "Détente"
    case 2:
      return "Facile"
    case 3:
      return "Un peu challenge"
    case 4:
      return "Difficile"
    default:
      return "—"
  }
}

export function audienceHumanLabel(audience: AudienceType | null): string {
  switch (audience) {
    case "ME":
      return "Pour vous"
    case "OTHER_PERSON":
      return "Pour quelqu'un"
    case "DUO":
      return "Pour deux personnes"
    case "GROUP":
      return "Pour un groupe"
    default:
      return "—"
  }
}

export function richnessClientMessage(
  level: "INSUFFICIENT" | "ENOUGH" | "RICH",
): string {
  if (level === "INSUFFICIENT") {
    return "Il manque encore quelques informations essentielles pour personnaliser le cahier."
  }
  if (level === "RICH") {
    return "Vous nous avez donné beaucoup de matière : votre cahier pourra être particulièrement personnalisé."
  }
  return "Nous avons déjà suffisamment d'informations pour créer un cahier vraiment personnel."
}

/** Recap tags: show up to `max` items, then "+ X autres". */
export function truncateTagList(
  items: string[],
  max = 6,
): { visible: string[]; overflow: number } {
  if (items.length <= max) return { visible: items, overflow: 0 }
  return { visible: items.slice(0, max), overflow: items.length - max }
}

/** Existing non-empty group member particularities (personalTrait). */
export function listGroupParticularities(
  participants: { id: string; firstName: string; personalTrait?: string }[],
): { participantId: string; firstName: string; text: string }[] {
  return participants
    .filter((p) => Boolean(p.personalTrait?.trim()))
    .map((p) => ({
      participantId: p.id,
      firstName: p.firstName,
      text: p.personalTrait!.trim(),
    }))
}

export function setGroupParticularity<T extends { id: string; personalTrait?: string }>(
  participants: T[],
  participantId: string,
  text: string,
): T[] {
  const trimmed = text.trim()
  return participants.map((p) =>
    p.id === participantId
      ? { ...p, personalTrait: trimmed ? trimmed : undefined }
      : p,
  )
}

export function clearGroupParticularity<T extends { id: string; personalTrait?: string }>(
  participants: T[],
  participantId: string,
): T[] {
  return setGroupParticularity(participants, participantId, "")
}
