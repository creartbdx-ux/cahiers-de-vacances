/**
 * Audience-aware questionnaire copy.
 * Separates creator (who fills) vs recipient/participants (who the book is for).
 */

import { deriveCreatorIsParticipant } from "./audience"
import {
  PERSONAL_FACT_CATEGORIES,
  type AudienceType,
  type PersonalFactCategory,
  type QuestionnaireV1,
} from "./types"

export type StepId =
  | "audience"
  | "participants"
  | "personality"
  | "interests"
  | "game"
  | "forbidden"
  | "color"
  | "style"
  | "deepIntro"
  | "closePeople"
  | "lifeContext"
  | "personalFacts"
  | "memories"
  | "insideJokes"
  | "photos"
  | "finale"
  | "recap"

export interface StepCopy {
  title: string
  subtitle?: string
  /** Short nav label for progress. */
  navLabel: string
}

export interface AudienceCopyContext {
  audience: AudienceType | null
  creatorIsParticipant: boolean
  /** Creator first name when known (questionnaire fields). */
  creatorName: string | null
  /** Primary recipient for OTHER_PERSON (first participant). */
  recipientName: string | null
  participantNames: string[]
  groupName: string | null
}

export function buildAudienceCopyContext(q: QuestionnaireV1): AudienceCopyContext {
  const audience = q.audience
  const creatorIsParticipant = audience
    ? deriveCreatorIsParticipant(audience, q.creatorIsParticipant)
    : false

  const participantNames = q.participants.map((p) => p.firstName.trim()).filter(Boolean)

  let creatorName: string | null = null
  if (audience === "ME") {
    creatorName = participantNames[0] ?? null
  } else if (q.creatorFirstName?.trim()) {
    creatorName = q.creatorFirstName.trim()
  } else if (creatorIsParticipant && q.creatorParticipantId) {
    const p = q.participants.find((x) => x.id === q.creatorParticipantId)
    creatorName = p?.firstName.trim() || null
  }

  const recipientName =
    audience === "OTHER_PERSON" ? participantNames[0] ?? null : null

  return {
    audience,
    creatorIsParticipant,
    creatorName,
    recipientName,
    participantNames,
    groupName: q.groupName?.trim() || null,
  }
}

/** Elision: que Sami / qu'Emma */
export function queName(name: string): string {
  const n = name.trim()
  if (!n) return "que cette personne"
  return /^[aeiouyhàâäéèêëïîôöùûüAEIOUYHÀÂÄÉÈÊËÏÎÔÖÙÛÜ]/u.test(n)
    ? `qu'${n}`
    : `que ${n}`
}

/** Elision: de Sami / d'Emma */
export function deName(name: string): string {
  const n = name.trim()
  if (!n) return "de cette personne"
  return /^[aeiouyhàâäéèêëïîôöùûüAEIOUYHÀÂÄÉÈÊËÏÎÔÖÙÛÜ]/u.test(n)
    ? `d'${n}`
    : `de ${n}`
}

/** Elision: sur Sami (no change) / sur Emma */
export function surName(name: string): string {
  const n = name.trim()
  return n ? `sur ${n}` : "sur cette personne"
}

export type FactTargetKind = "SELF" | "PERSON" | "DUO" | "GROUP"

export interface FactTarget {
  kind: FactTargetKind
  firstName?: string | null
}

/**
 * Resolve who a personal-fact row is about (for label adaptation).
 * OTHER_PERSON / ME ignore participantIds — always recipient / self.
 */
export function resolveFactTarget(
  ctx: AudienceCopyContext,
  participantIds: string[] | undefined,
  participants: { id: string; firstName: string }[],
): FactTarget {
  if (ctx.audience === "ME") return { kind: "SELF" }
  if (ctx.audience === "OTHER_PERSON") {
    return { kind: "PERSON", firstName: ctx.recipientName }
  }
  if (!participantIds?.length) {
    return { kind: ctx.audience === "DUO" ? "DUO" : "GROUP" }
  }
  if (participantIds.length === 1) {
    const p = participants.find((x) => x.id === participantIds[0])
    return { kind: "PERSON", firstName: p?.firstName.trim() || null }
  }
  // Multiple selected → treat as duo/group collective
  return { kind: ctx.audience === "DUO" ? "DUO" : "GROUP" }
}

function personFactLabel(category: PersonalFactCategory, name: string | null): string {
  const who = name?.trim() || "cette personne"
  const de = deName(who)
  switch (category) {
    case "FOOD":
      return `Le plat préféré ${de}`
    case "DRINK":
      return `La boisson préférée ${de}`
    case "MUSIC":
      return `La musique ou l'artiste préféré ${de}`
    case "MOVIE_SERIES":
      return `Le film ou la série préféré ${de}`
    case "BOOK":
      return who === "cette personne"
        ? "Un livre que cette personne aime"
        : `Un livre que ${who} aime`
    case "ACTIVITY":
      return `Une activité ${de}`
    case "PLACE":
      return who === "cette personne"
        ? "Un lieu que cette personne adore"
        : `Un lieu que ${who} adore`
    case "HABIT":
      return `Une petite habitude ${de}`
    case "EXPRESSION":
      return fixExpressionLabel(who === "cette personne" ? null : who)
    case "DISLIKE":
      return who === "cette personne"
        ? "Une chose que cette personne déteste"
        : `Une chose que ${who} déteste`
    case "FUNNY_FLAW":
      return `Un petit défaut amusant ${de}`
    case "OBJECT":
      return `Un objet fétiche ${de}`
    case "OTHER":
      return `Autre chose ${surName(who)}`
    default:
      return `Un détail ${surName(who)}`
  }
}

function fixExpressionLabel(name: string | null): string {
  const who = name?.trim()
  if (!who) return "Une expression que cette personne dit souvent"
  return `Une expression ${queName(who)} dit souvent`
}

function selfFactLabel(category: PersonalFactCategory): string {
  switch (category) {
    case "FOOD":
      return "Votre plat préféré"
    case "DRINK":
      return "Votre boisson préférée"
    case "MUSIC":
      return "Votre musique ou artiste"
    case "MOVIE_SERIES":
      return "Votre film ou série"
    case "BOOK":
      return "Un livre"
    case "ACTIVITY":
      return "Une activité"
    case "PLACE":
      return "Un lieu que vous adorez"
    case "HABIT":
      return "Une petite habitude"
    case "EXPRESSION":
      return "Une expression que vous dites souvent"
    case "DISLIKE":
      return "Une chose que vous détestez"
    case "FUNNY_FLAW":
      return "Un petit défaut amusant"
    case "OBJECT":
      return "Un objet fétiche"
    case "OTHER":
      return "Autre chose"
    default:
      return "Un détail"
  }
}

function duoCollectiveLabel(
  category: PersonalFactCategory,
  creatorIsParticipant: boolean,
): string {
  const vous = creatorIsParticipant
  switch (category) {
    case "FOOD":
      return vous ? "Un plat que vous aimez à deux" : "Un plat qu'ils aiment à deux"
    case "DRINK":
      return vous ? "Une boisson que vous aimez à deux" : "Une boisson qu'ils aiment à deux"
    case "HABIT":
      return vous
        ? "Une habitude que vous avez à deux"
        : "Une habitude qu'ils ont à deux"
    case "EXPRESSION":
      return vous
        ? "Une expression que vous dites souvent à deux"
        : "Une expression qu'ils utilisent souvent"
    case "PLACE":
      return vous ? "Un lieu que vous adorez à deux" : "Un lieu qu'ils adorent à deux"
    case "ACTIVITY":
      return vous ? "Une activité que vous faites à deux" : "Une activité qu'ils font à deux"
    case "OTHER":
      return vous ? "Autre chose sur votre duo" : "Autre chose sur leur duo"
    default:
      return vous ? "Un détail sur vous deux" : "Un détail sur eux deux"
  }
}

function groupCollectiveLabel(
  category: PersonalFactCategory,
  creatorIsParticipant: boolean,
): string {
  const vous = creatorIsParticipant
  switch (category) {
    case "FOOD":
      return vous ? "Un plat du groupe" : "Un plat du groupe"
    case "HABIT":
      return vous
        ? "Une habitude de votre groupe"
        : "Une habitude du groupe"
    case "EXPRESSION":
      return vous
        ? "Une expression que vous dites souvent entre vous"
        : "Une expression qu'ils utilisent souvent"
    case "PLACE":
      return vous ? "Un lieu que votre groupe adore" : "Un lieu que le groupe adore"
    case "ACTIVITY":
      return vous ? "Une activité de votre groupe" : "Une activité du groupe"
    case "OTHER":
      return vous ? "Autre chose sur votre groupe" : "Autre chose sur le groupe"
    default:
      return vous ? "Un détail de votre groupe" : "Un détail du groupe"
  }
}

export function personalFactCategoryLabel(
  category: PersonalFactCategory,
  ctx: AudienceCopyContext,
  target: FactTarget,
): string {
  if (target.kind === "SELF") return selfFactLabel(category)
  if (target.kind === "PERSON") {
    if (category === "EXPRESSION") return fixExpressionLabel(target.firstName ?? null)
    return personFactLabel(category, target.firstName ?? null)
  }
  if (target.kind === "DUO") {
    return duoCollectiveLabel(category, ctx.creatorIsParticipant)
  }
  return groupCollectiveLabel(category, ctx.creatorIsParticipant)
}

/** Default category labels for select options (OTHER_PERSON uses recipient). */
export function personalFactCategoryOptions(
  ctx: AudienceCopyContext,
): Array<{ value: PersonalFactCategory; label: string; placeholder: string }> {
  const target: FactTarget =
    ctx.audience === "ME"
      ? { kind: "SELF" }
      : ctx.audience === "OTHER_PERSON"
        ? { kind: "PERSON", firstName: ctx.recipientName }
        : { kind: ctx.audience === "DUO" ? "DUO" : "GROUP" }

  return PERSONAL_FACT_CATEGORIES.map((c) => ({
    value: c.value,
    label: personalFactCategoryLabel(c.value, ctx, target),
    placeholder: c.placeholder,
  }))
}

export function photoCopy(ctx: AudienceCopyContext): {
  captionPlaceholder: string
  anecdotePlaceholder: string
  whoLabel: string
} {
  if (ctx.audience === "OTHER_PERSON" && ctx.recipientName) {
    return {
      captionPlaceholder: "Que montre cette photo ?",
      anecdotePlaceholder: `Une anecdote liée à cette photo (avec ${ctx.recipientName} ou sur ${ctx.recipientName})`,
      whoLabel: "Qui apparaît sur cette photo ?",
    }
  }
  if (ctx.audience === "ME") {
    return {
      captionPlaceholder: "Une petite légende ?",
      anecdotePlaceholder: "Une anecdote liée à cette photo ?",
      whoLabel: "Qui apparaît sur cette photo ?",
    }
  }
  return {
    captionPlaceholder: "Que montre cette photo ?",
    anecdotePlaceholder: "Une anecdote liée à cette photo ?",
    whoLabel: "Qui apparaît sur cette photo ?",
  }
}

export function recapCopy(ctx: AudienceCopyContext): {
  title: string
  subtitle: string
  forTitle: string
  forSubtitle: string
  createdBy: string | null
  universesTitle: string
  gamesTitle: string
  visualTitle: string
  personalizationTitle: string
  personalizationHint: string | null
} {
  const creator = ctx.creatorName
  const recipient = ctx.recipientName

  if (ctx.audience === "ME") {
    return {
      title: "Nous avons tout ce qu'il faut pour créer votre cahier",
      subtitle: "Voici un aperçu — les touches personnelles restent un bonus.",
      forTitle: recipient || creator ? `Pour vous${creator ? `, ${creator}` : ""}` : "Pour vous",
      forSubtitle: "Pour vous",
      createdBy: null,
      universesTitle: "Les bases — univers",
      gamesTitle: "Jeux",
      visualTitle: "Univers graphique",
      personalizationTitle: "Touches personnelles",
      personalizationHint: null,
    }
  }

  if (ctx.audience === "OTHER_PERSON") {
    const forTitle = recipient ? `Pour ${recipient}` : "Pour quelqu'un"
    return {
      title: recipient
        ? `Nous avons tout ce qu'il faut pour créer le cahier de ${recipient}`
        : "Nous avons tout ce qu'il faut pour créer le cahier",
      subtitle: "Voici un aperçu — les touches personnelles restent un bonus.",
      forTitle,
      forSubtitle: "Pour quelqu'un",
      createdBy: creator ? `Créé par ${creator}` : null,
      universesTitle: recipient ? `Les bases — univers ${deName(recipient)}` : "Les bases — univers",
      gamesTitle: recipient ? `Jeux ${deName(recipient)}` : "Jeux choisis",
      visualTitle: "Univers graphique",
      personalizationTitle: "Touches personnelles",
      personalizationHint: null,
    }
  }

  const names = ctx.participantNames
  const forTitle = names.length ? names.join(" · ") : ctx.audience === "DUO" ? "Pour deux personnes" : "Pour un groupe"
  return {
    title: "Nous avons tout ce qu'il faut pour créer le cahier",
    subtitle: "Voici un aperçu — les touches personnelles restent un bonus.",
    forTitle,
    forSubtitle:
      ctx.audience === "DUO" ? "Pour deux personnes" : "Pour un groupe",
    createdBy: creator ? `Créé par ${creator}` : null,
    universesTitle: "Les bases — univers",
    gamesTitle: "Jeux",
    visualTitle: "Univers graphique",
    personalizationTitle: "Touches personnelles",
    personalizationHint: null,
  }
}

export function buildStepCopy(step: StepId, ctx: AudienceCopyContext): StepCopy {
  const audience = ctx.audience
  const participant = ctx.creatorIsParticipant
  const r = ctx.recipientName

  switch (step) {
    case "audience":
      return {
        navLabel: "Pour qui ?",
        title: "Pour qui créez-vous ce cahier ?",
        subtitle: "Le questionnaire s'adapte à votre réponse.",
      }
    case "participants":
      if (audience === "ME") {
        return {
          navLabel: "Vous",
          title: "Parlons de vous",
          subtitle: "Juste l'essentiel pour commencer.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: r ?? "Cette personne",
          title: r ? `Parlons ${deName(r)}` : "Parlons de cette personne",
          subtitle: r
            ? `Qui est ${r}, la personne pour qui vous créez ce cahier ?`
            : "Qui est la personne pour qui vous créez ce cahier ?",
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
        return {
          navLabel: "Personnalité",
          title: "Comment vous décririez-vous ?",
          subtitle: "Choisissez quelques traits — 3 à 6 idéalement, 1 ou 2 suffisent.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Personnalité",
          title: r ? `Comment décririez-vous ${r} ?` : "Comment le/la décririez-vous ?",
          subtitle: "Choisissez quelques traits — 3 à 6 idéalement, 1 ou 2 suffisent.",
        }
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
          subtitle: "Sélectionnez ce qui vous correspond — un seul intérêt suffit déjà.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Goûts",
          title: r ? `Ce que ${r} aime` : "Ce qu'il/elle aime",
          subtitle: r
            ? `Sélectionnez ce qui correspond à ${r} — quelques intérêts suffisent.`
            : "Sélectionnez ce qui lui correspond — quelques intérêts suffisent.",
        }
      }
      if (audience === "DUO") {
        return {
          navLabel: "Goûts",
          title: participant ? "Ce que vous aimez ensemble" : "Ce qu'elles aiment ensemble",
          subtitle: participant
            ? "Sélectionnez ce qui vous ressemble à deux."
            : "Sélectionnez ce qui les rassemble.",
        }
      }
      return {
        navLabel: "Goûts",
        title: participant
          ? "Ce que vous aimez faire ensemble"
          : "Ce qu'ils aiment faire ensemble",
        subtitle: "Sélectionnez ce qui correspond au groupe.",
      }
    case "deepIntro":
      return {
        navLabel: "Plus loin",
        title: "Vous voulez le rendre encore plus personnel ?",
        subtitle:
          "Tout ce qui suit est facultatif. Ajoutez seulement ce qui vous vient facilement — le cahier fonctionne déjà très bien avec les bases.",
      }
    case "closePeople":
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Proches",
          title: r
            ? `Quelques personnes importantes autour ${deName(r)}`
            : "Quelques personnes importantes autour d'elle/lui",
          subtitle: "Prénoms seulement — facultatif. Passez si rien ne vous vient.",
        }
      }
      if (audience === "ME") {
        return {
          navLabel: "Proches",
          title: "Quelques personnes importantes autour de vous",
          subtitle: "Prénoms seulement — facultatif.",
        }
      }
      return {
        navLabel: "Proches",
        title: "D'autres personnes importantes ?",
        subtitle: "Prénoms seulement — facultatif. Passez si rien ne vous vient.",
      }
    case "lifeContext":
      return {
        navLabel: "Contexte",
        title: "Un peu de contexte de vie ?",
        subtitle: "Quelques bascules simples — tout est facultatif.",
      }
    case "personalFacts":
      if (audience === "ME") {
        return {
          navLabel: "Détails",
          title: "Un petit détail vous vient en tête ?",
          subtitle:
            "Plat préféré, habitude, expression… 0 réponse est parfaitement valide. Passez si rien ne vient.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Détails",
          title: r
            ? `Un petit détail ${surName(r)} ?`
            : "Un petit détail sur cette personne ?",
          subtitle:
            "Plat préféré, habitude, expression… 0 réponse est parfaitement valide.",
        }
      }
      if (audience === "DUO") {
        return {
          navLabel: "Détails",
          title: "Un petit détail vous vient en tête ?",
          subtitle: "Facultatif. Précisez qui cela concerne si besoin.",
        }
      }
      return {
        navLabel: "Détails",
        title: "Un petit détail sur le groupe ?",
        subtitle: "Facultatif. Passez si rien ne vient.",
      }
    case "memories":
      if (audience === "ME") {
        return {
          navLabel: "Souvenirs",
          title: "Un souvenir vous vient en tête ?",
          subtitle: "Facultatif. Ajoutez seulement ce qui vient facilement — ou passez.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Souvenirs",
          title: r ? `Un souvenir avec ${r} ?` : "Un souvenir vous vient en tête ?",
          subtitle: "Facultatif. Ajoutez seulement ce qui vient facilement — ou passez.",
        }
      }
      if (audience === "DUO") {
        return {
          navLabel: "Souvenirs",
          title: participant ? "Un souvenir à deux ?" : "Un souvenir sur eux ?",
          subtitle: "Facultatif. Rencontre, voyage, anecdote… ou passez.",
        }
      }
      return {
        navLabel: "Souvenirs",
        title: participant ? "Un souvenir de votre bande ?" : "Un souvenir du groupe ?",
        subtitle: "Facultatif. Souvenir culte, soirée, voyage… ou passez.",
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
        title: participant ? "Vos private jokes & habitudes" : "Leurs private jokes & habitudes",
        subtitle: "Expressions, références communes, blagues internes… (facultatif)",
      }
    case "game":
      if (audience === "ME") {
        return { navLabel: "Jeux", title: "Les jeux que vous aimez" }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Jeux",
          title: r ? `Les jeux que ${r} aime` : "Les jeux qu'il/elle aime",
        }
      }
      return {
        navLabel: "Jeux",
        title: participant ? "Les jeux que vous aimez" : "Les jeux qu'ils aiment",
      }
    case "photos":
      if (audience === "ME") {
        return {
          navLabel: "Photos",
          title: "Quelques photos ?",
          subtitle:
            "Quelques photos peuvent ajouter des pages album à votre cahier, mais il fonctionnera très bien sans.",
        }
      }
      if (audience === "OTHER_PERSON") {
        return {
          navLabel: "Photos",
          title: r ? `Quelques photos pour le cahier ${deName(r)} ?` : "Quelques photos ?",
          subtitle:
            "Quelques photos peuvent ajouter des pages album, mais le cahier fonctionnera très bien sans.",
        }
      }
      return {
        navLabel: "Photos",
        title: "Quelques photos ?",
        subtitle:
          "Quelques photos peuvent ajouter des pages album, mais le cahier fonctionnera très bien sans.",
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
          title: r
            ? `Ce qu'il ne faut pas évoquer dans le cahier ${deName(r)}`
            : "Ce qu'il ne faut surtout pas évoquer",
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
        subtitle:
          "Choisissez une palette pour le cahier, ou laissez-nous vous surprendre.",
      }
    case "style":
      return {
        navLabel: "Style",
        title: "Quel univers graphique pour ce cahier ?",
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
          subtitle: r
            ? `Un mot personnel pour ${r}, ou une dernière précision.`
            : "Un mot personnel, ou une dernière précision.",
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
    case "recap": {
      const rcopy = recapCopy(ctx)
      return {
        navLabel: "Récap",
        title: rcopy.title,
        subtitle: rcopy.subtitle,
      }
    }
  }
}
