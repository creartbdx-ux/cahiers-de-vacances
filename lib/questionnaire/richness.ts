import {
  MIN_INTERESTS,
  MIN_TRAITS_SOLO,
  type BookProfileV1,
  type QuestionnaireV1,
  type RichnessResult,
} from "./types"
import { deriveCreatorIsParticipant } from "./audience"
import {
  computePersonalizationCapabilities,
  computeQuestionnaireCapabilities,
} from "./capabilities"

function soloTraitsCount(q: QuestionnaireV1): number {
  const id = q.participants[0]?.id
  if (!id) return 0
  return q.personality.traitsByParticipantId[id]?.length ?? 0
}

function personalityOk(q: QuestionnaireV1): boolean {
  if (!q.audience) return false
  if (q.audience === "ME" || q.audience === "OTHER_PERSON") {
    return soloTraitsCount(q) >= MIN_TRAITS_SOLO
  }
  if (q.audience === "DUO") {
    return Boolean(q.personality.duoDescription?.trim()) && (q.personality.duoDynamics?.length ?? 0) >= 2
  }
  return (q.personality.groupTraits?.length ?? 0) >= 3
}

function participantHasAgeSignal(p: QuestionnaireV1["participants"][number]): boolean {
  if (p.birthDate?.trim()) return true
  if (typeof p.approximateAge === "number" && p.approximateAge > 0) return true
  return Boolean(p.ageBracket)
}

function participantsOk(q: QuestionnaireV1): boolean {
  if (!q.audience) return false
  if (q.audience === "ME" || q.audience === "OTHER_PERSON") {
    const p = q.participants[0]
    return Boolean(p?.firstName.trim())
  }
  if (q.audience === "DUO") {
    return (
      q.participants.length === 2 &&
      q.participants.every((p) => p.firstName.trim()) &&
      Boolean(q.duoType)
    )
  }
  return (
    q.participants.length >= 3 &&
    q.participants.length <= 10 &&
    q.participants.every((p) => p.firstName.trim())
  )
}

/**
 * Personalization depth from questionnaire matter.
 * LIGHT / PERSONALIZED / RICH — never client-facing "insufficient quality".
 * Incomplete CORE → canCreate false + missing list; depth stays LIGHT.
 */
export function calculateProfileRichness(
  questionnaire: QuestionnaireV1,
  profile?: BookProfileV1,
): RichnessResult {
  const missing: string[] = []
  const bonuses: string[] = []

  if (!questionnaire.audience) missing.push("audience")
  else {
    const derived = deriveCreatorIsParticipant(
      questionnaire.audience,
      questionnaire.creatorIsParticipant,
    )
    if (questionnaire.audience === "ME" && derived !== true) missing.push("creatorIsParticipant")
    if (questionnaire.audience === "OTHER_PERSON" && derived !== false) {
      missing.push("creatorIsParticipant")
    }
  }

  if (!participantsOk(questionnaire)) missing.push("participants")
  if (!personalityOk(questionnaire)) missing.push("personnalité")
  if (questionnaire.interestUniverseIds.length < MIN_INTERESTS) {
    missing.push("centres d'intérêt")
  }
  if (!questionnaire.gamePreferences.likedTypes?.length) missing.push("préférences de jeux")
  const d = questionnaire.gamePreferences.difficulty
  if (d !== 1 && d !== 2 && d !== 3 && d !== 4) missing.push("difficulté")
  if (!questionnaire.forbiddenTopics?.answered) missing.push("sujets interdits (réponse explicite)")
  if (!questionnaire.visualPreferences.paletteId || !questionnaire.visualPreferences.styleId) {
    missing.push("style / palette")
  }

  const caps = profile
    ? computePersonalizationCapabilities(profile)
    : computeQuestionnaireCapabilities(questionnaire)

  if (questionnaire.participants.some(participantHasAgeSignal)) {
    bonuses.push("âge / date de naissance")
  }
  if (caps.hasClosePeople) bonuses.push("proches")
  if (caps.hasFamilyContext) bonuses.push("contexte de vie")
  if (caps.hasPersonalFacts) bonuses.push("petits détails")
  if (caps.hasMemories) bonuses.push("souvenirs")
  if (caps.hasInsideJokes) bonuses.push("private jokes")
  if (caps.hasPhotos) bonuses.push("photos")

  const canCreate = missing.length === 0
  const depth = canCreate ? caps.depth : "LIGHT"

  if (!canCreate) {
    return {
      level: "LIGHT",
      depth: "LIGHT",
      canCreate: false,
      missing,
      bonuses,
      message:
        "Il manque encore quelques informations de base pour créer le cahier. Les souvenirs et photos restent facultatifs.",
    }
  }

  if (depth === "RICH") {
    return {
      level: "RICH",
      depth: "RICH",
      canCreate: true,
      missing: [],
      bonuses,
      message:
        "Nous avons tout ce qu'il faut pour créer le cahier — avec une personnalisation très riche.",
    }
  }

  if (depth === "PERSONALIZED") {
    return {
      level: "PERSONALIZED",
      depth: "PERSONALIZED",
      canCreate: true,
      missing: [],
      bonuses,
      message:
        "Nous avons déjà assez d'informations pour créer le cahier. Les touches personnelles le rendront encore plus unique.",
    }
  }

  return {
    level: "LIGHT",
    depth: "LIGHT",
    canCreate: true,
    missing: [],
    bonuses,
    message:
      "Nous avons déjà assez d'informations pour créer le cahier. Vous pouvez ajouter des touches personnelles si vous le souhaitez.",
  }
}
