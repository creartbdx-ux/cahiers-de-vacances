import {
  MAX_GROUP_SIZE,
  MAX_PERSONAL_FACTS,
  MAX_PHOTOS,
  MAX_TRAITS_SOLO,
  MIN_GROUP_SIZE,
  MIN_INTERESTS,
  MIN_TRAITS_SOLO,
  type QuestionnaireV1,
} from "./types"
import { deriveCreatorIsParticipant } from "./audience"
import {
  needsCreatorFirstNameField,
  needsCreatorParticipantChoice,
} from "./creator"
import { buildJourneySteps, type StepId } from "./journey"

/** CORE steps that must pass for book creation. Deep steps are never required. */
const CORE_STEPS: StepId[] = [
  "audience",
  "participants",
  "personality",
  "interests",
  "game",
  "forbidden",
  "color",
  "style",
]

export function validateStep(step: StepId, q: QuestionnaireV1): string[] {
  const errors: string[] = []

  switch (step) {
    case "audience": {
      if (!q.audience) errors.push("Indiquez pour qui vous créez ce cahier.")
      else if (
        (q.audience === "DUO" || q.audience === "GROUP") &&
        q.creatorIsParticipant !== true &&
        q.creatorIsParticipant !== false
      ) {
        errors.push("Indiquez si vous faites partie des personnes qui utiliseront ce cahier.")
      }
      break
    }
    case "participants": {
      if (!q.audience) {
        errors.push("Audience manquante.")
        break
      }
      if (q.audience === "ME" || q.audience === "OTHER_PERSON") {
        if (q.participants.length !== 1) errors.push("Un participant est requis.")
        else {
          const p = q.participants[0]
          if (!p.firstName.trim()) errors.push("Le prénom est obligatoire.")
          // Age / birth preferred but optional — never block CORE
          if (q.audience === "OTHER_PERSON" && !p.relationship?.trim()) {
            errors.push("Indiquez votre lien avec cette personne.")
          }
        }
      } else if (q.audience === "DUO") {
        if (q.participants.length !== 2) errors.push("Deux participants sont requis.")
        q.participants.forEach((p, i) => {
          if (!p.firstName.trim()) errors.push(`Prénom obligatoire pour la personne ${i + 1}.`)
        })
        if (!q.duoType) errors.push("Choisissez le type de duo.")
      } else if (q.audience === "GROUP") {
        const n = q.participants.length
        if (n < MIN_GROUP_SIZE) errors.push(`Minimum ${MIN_GROUP_SIZE} participants.`)
        if (n > MAX_GROUP_SIZE) errors.push(`Maximum ${MAX_GROUP_SIZE} participants pour la V1.`)
        q.participants.forEach((p, i) => {
          if (!p.firstName.trim()) errors.push(`Prénom obligatoire pour le participant ${i + 1}.`)
        })
      }

      if (needsCreatorFirstNameField(q.audience, q.creatorIsParticipant)) {
        if (!q.creatorFirstName?.trim()) {
          errors.push("Indiquez votre prénom.")
        }
      } else if (needsCreatorParticipantChoice(q.audience, q.creatorIsParticipant)) {
        const id = q.creatorParticipantId?.trim()
        if (!id) {
          errors.push("Indiquez qui vous êtes parmi les personnes du cahier.")
        } else if (!q.participants.some((p) => p.id === id)) {
          errors.push("Le choix « qui êtes-vous » doit correspondre à une personne du cahier.")
        }
      }
      break
    }
    case "personality": {
      if (!q.audience) break
      if (q.audience === "ME" || q.audience === "OTHER_PERSON") {
        const id = q.participants[0]?.id
        const traits = id ? q.personality.traitsByParticipantId[id] ?? [] : []
        if (traits.length < MIN_TRAITS_SOLO) {
          errors.push(`Choisissez au moins ${MIN_TRAITS_SOLO} trait de personnalité.`)
        }
        if (traits.length > MAX_TRAITS_SOLO) {
          errors.push(`Maximum ${MAX_TRAITS_SOLO} traits.`)
        }
      } else if (q.audience === "DUO") {
        if (!q.personality.duoDescription?.trim()) {
          errors.push("Décrivez le duo.")
        }
        if ((q.personality.duoDynamics?.length ?? 0) < 2) {
          errors.push("Choisissez au moins 2 caractéristiques de la dynamique du duo.")
        }
      } else if (q.audience === "GROUP") {
        const n = q.personality.groupTraits?.length ?? 0
        if (n < 3 || n > 5) {
          errors.push("Choisissez entre 3 et 5 caractéristiques pour le groupe.")
        }
      }
      break
    }
    case "interests": {
      if (q.interestUniverseIds.length < MIN_INTERESTS) {
        errors.push("Sélectionnez au moins un centre d'intérêt.")
      }
      break
    }
    case "deepIntro":
    case "closePeople":
    case "lifeContext":
      // Optional light personalization — never blocking
      break
    case "personalFacts": {
      const facts = q.personalFacts.filter((f) => f.value.trim())
      // Deep personalization — 0 is valid
      if (facts.length > MAX_PERSONAL_FACTS) {
        errors.push(`Maximum ${MAX_PERSONAL_FACTS} détails.`)
      }
      break
    }
    case "memories":
    case "insideJokes":
      break
    case "game": {
      if (!q.gamePreferences.likedTypes?.length) {
        errors.push("Choisissez au moins un type de jeu.")
      }
      const d = q.gamePreferences.difficulty
      if (d !== 1 && d !== 2 && d !== 3 && d !== 4) {
        errors.push("Choisissez un niveau de difficulté.")
      }
      break
    }
    case "photos": {
      if (q.photos.length > MAX_PHOTOS) {
        errors.push(`Maximum ${MAX_PHOTOS} photos.`)
      }
      for (const photo of q.photos) {
        if (photo.uploadStatus === "error") {
          errors.push(
            "Une photo n'a pas pu être enregistrée. Réessayez ou supprimez-la pour continuer.",
          )
          break
        }
        if (!photo.useAuthorized) {
          errors.push("Chaque photo doit être autorisée pour usage dans le cahier.")
          break
        }
      }
      break
    }
    case "forbidden": {
      if (!q.forbiddenTopics?.answered) {
        errors.push("Répondez à la question sur les sujets à éviter.")
      } else if (q.forbiddenTopics.hasRestrictions && !q.forbiddenTopics.text?.trim()) {
        errors.push("Précisez les sujets à éviter.")
      }
      break
    }
    case "color": {
      if (!q.visualPreferences.paletteId) errors.push("Choisissez une ambiance de couleurs.")
      break
    }
    case "style": {
      if (!q.visualPreferences.styleId) errors.push("Choisissez un univers graphique.")
      break
    }
    case "finale":
    case "recap":
      break
  }

  return errors
}

/**
 * Final validation — CORE only.
 * Deep fields (facts, memories, jokes, photos, close people) never required.
 */
export function validateQuestionnaireComplete(q: QuestionnaireV1): string[] {
  if (!q.audience) return ["Audience manquante."]
  const journey = buildJourneySteps(q.audience, q.creatorIsParticipant)
  const stepsToCheck = CORE_STEPS.filter((s) => journey.includes(s))
  const errors: string[] = []
  for (const step of stepsToCheck) {
    errors.push(...validateStep(step, q))
  }
  // Soft caps on optional deep content still enforced
  if (journey.includes("personalFacts")) {
    errors.push(...validateStep("personalFacts", q))
  }
  if (journey.includes("photos")) {
    errors.push(...validateStep("photos", q))
  }
  if (q.audience === "GROUP" && q.participants.length > MAX_GROUP_SIZE) {
    errors.push(`GROUP > ${MAX_GROUP_SIZE} refusé.`)
  }
  const d = q.gamePreferences.difficulty
  if (d != null && (d < 1 || d > 4 || !Number.isInteger(d))) {
    errors.push("Difficulté hors 1–4 refusée.")
  }
  if (q.photos.length > MAX_PHOTOS) {
    errors.push(`Plus de ${MAX_PHOTOS} photos refusé.`)
  }
  return [...new Set(errors)]
}

export function withDerivedAudienceFields(q: QuestionnaireV1): QuestionnaireV1 {
  if (!q.audience) return q
  return {
    ...q,
    creatorIsParticipant: deriveCreatorIsParticipant(q.audience, q.creatorIsParticipant),
  }
}

/** True when CORE fields alone are enough to create the book. */
export function isCoreComplete(q: QuestionnaireV1): boolean {
  if (!q.audience) return false
  for (const step of CORE_STEPS) {
    if (step === "audience") {
      if (validateStep("audience", q).length > 0) return false
      continue
    }
    if (validateStep(step, q).length > 0) return false
  }
  return true
}
