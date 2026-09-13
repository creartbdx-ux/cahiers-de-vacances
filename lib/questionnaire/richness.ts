import {
  MIN_INTERESTS,
  MIN_PERSONAL_FACTS,
  MIN_TRAITS_SOLO,
  type BookProfileV1,
  type QuestionnaireV1,
  type RichnessResult,
} from "./types"
import { deriveCreatorIsParticipant } from "./audience"

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

function participantsOk(q: QuestionnaireV1): boolean {
  if (!q.audience) return false
  if (q.audience === "ME" || q.audience === "OTHER_PERSON") {
    const p = q.participants[0]
    return Boolean(p?.firstName.trim() && p.ageBracket)
  }
  if (q.audience === "DUO") {
    return (
      q.participants.length === 2 &&
      q.participants.every((p) => p.firstName.trim() && p.ageBracket) &&
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
 * Deterministic richness score. Does not block with fake percentages —
 * returns ENOUGH / RICH (or INSUFFICIENT with missing list).
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
    missing.push(`centres d'intérêt (min ${MIN_INTERESTS})`)
  }
  if (questionnaire.personalFacts.filter((f) => f.value.trim()).length < MIN_PERSONAL_FACTS) {
    missing.push(`informations personnelles (min ${MIN_PERSONAL_FACTS})`)
  }
  if (!questionnaire.gamePreferences.likedTypes?.length) missing.push("préférences de jeux")
  const d = questionnaire.gamePreferences.difficulty
  if (d !== 1 && d !== 2 && d !== 3 && d !== 4) missing.push("difficulté")
  if (!questionnaire.forbiddenTopics?.answered) missing.push("sujets interdits (réponse explicite)")
  if (!questionnaire.visualPreferences.paletteId || !questionnaire.visualPreferences.styleId) {
    missing.push("style / palette")
  }

  const memories = (profile?.memories ?? questionnaire.memories).filter((m) => m.text.trim())
  const jokes = (profile?.insideJokes ?? questionnaire.insideJokes).filter((j) => j.text.trim())
  const photos = (profile?.photos ?? questionnaire.photos).filter((p) => {
    if ("uploadStatus" in p && (p as { uploadStatus?: string }).uploadStatus === "error") {
      return false
    }
    return true
  })

  if (memories.length > 0) bonuses.push("souvenirs")
  if (jokes.length > 0) bonuses.push("private jokes")
  if (photos.length > 0) bonuses.push("photos")
  if (questionnaire.personalFacts.filter((f) => f.value.trim()).length >= 5) {
    bonuses.push("détails personnels enrichis")
  }

  if (missing.length > 0) {
    return {
      level: "INSUFFICIENT",
      missing,
      bonuses,
      message: "Il manque encore quelques informations essentielles pour personnaliser le cahier.",
    }
  }

  const rich =
    memories.length >= 1 ||
    jokes.length >= 1 ||
    photos.length >= 1 ||
    questionnaire.personalFacts.filter((f) => f.value.trim()).length >= 5

  if (rich) {
    return {
      level: "RICH",
      missing: [],
      bonuses,
      message:
        "Votre cahier contient déjà assez d'informations pour être personnalisé. Les souvenirs, détails et photos le rendront encore plus unique.",
    }
  }

  return {
    level: "ENOUGH",
    missing: [],
    bonuses,
    message:
      "Votre cahier contient déjà assez d'informations pour être personnalisé. Ajoutez encore quelques souvenirs ou détails si vous souhaitez le rendre encore plus unique.",
  }
}
