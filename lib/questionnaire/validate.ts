import {
  MAX_GROUP_SIZE,
  MAX_PERSONAL_FACTS,
  MAX_PHOTOS,
  MAX_TRAITS_SOLO,
  MIN_GROUP_SIZE,
  MIN_INTERESTS,
  MIN_PERSONAL_FACTS,
  MIN_TRAITS_SOLO,
  type AudienceType,
  type QuestionnaireV1,
} from "./types"
import { deriveCreatorIsParticipant } from "./audience"

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
  | "visual"
  | "finale"
  | "recap"

export function stepsForAudience(audience: AudienceType | null): StepId[] {
  const base: StepId[] = [
    "audience",
    "participants",
    "personality",
    "interests",
    "personalFacts",
    "memories",
  ]
  if (audience === "DUO" || audience === "GROUP") {
    base.push("insideJokes")
  }
  base.push("games", "photos", "forbidden", "visual", "finale", "recap")
  return base
}

export function validateStep(step: StepId, q: QuestionnaireV1): string[] {
  const errors: string[] = []

  switch (step) {
    case "audience": {
      if (!q.audience) errors.push("Choisissez qui va remplir le cahier.")
      else if (
        (q.audience === "DUO" || q.audience === "GROUP") &&
        q.creatorIsParticipant !== true &&
        q.creatorIsParticipant !== false
      ) {
        errors.push("Indiquez si vous ferez partie des participants.")
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
          if (!p.ageBracket) errors.push("L'âge ou la tranche d'âge est obligatoire.")
          if (q.audience === "OTHER_PERSON" && !p.relationship?.trim()) {
            errors.push("Indiquez votre lien avec cette personne.")
          }
        }
      } else if (q.audience === "DUO") {
        if (q.participants.length !== 2) errors.push("Deux participants sont requis.")
        q.participants.forEach((p, i) => {
          if (!p.firstName.trim()) errors.push(`Prénom obligatoire pour la personne ${i + 1}.`)
          if (!p.ageBracket) errors.push(`Âge obligatoire pour la personne ${i + 1}.`)
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
      break
    }
    case "personality": {
      if (!q.audience) break
      if (q.audience === "ME" || q.audience === "OTHER_PERSON") {
        const id = q.participants[0]?.id
        const traits = id ? q.personality.traitsByParticipantId[id] ?? [] : []
        if (traits.length < MIN_TRAITS_SOLO) {
          errors.push(`Choisissez au moins ${MIN_TRAITS_SOLO} traits de personnalité.`)
        }
        if (traits.length > MAX_TRAITS_SOLO) {
          errors.push(`Maximum ${MAX_TRAITS_SOLO} traits.`)
        }
      } else if (q.audience === "DUO") {
        if (!q.personality.duoDescription?.trim()) {
          errors.push("Décrivez votre duo.")
        }
        if ((q.personality.duoDynamics?.length ?? 0) < 2) {
          errors.push("Choisissez au moins 2 caractéristiques de votre relation.")
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
        errors.push(`Choisissez au moins ${MIN_INTERESTS} centres d'intérêt.`)
      }
      break
    }
    case "personalFacts": {
      const facts = q.personalFacts.filter((f) => f.value.trim())
      if (facts.length < MIN_PERSONAL_FACTS) {
        errors.push(`Ajoutez au moins ${MIN_PERSONAL_FACTS} informations personnelles.`)
      }
      if (facts.length > MAX_PERSONAL_FACTS) {
        errors.push(`Maximum ${MAX_PERSONAL_FACTS} informations.`)
      }
      break
    }
    case "memories":
    case "insideJokes":
      break
    case "games": {
      if (!q.gamePreferences.likedTypes?.length) {
        errors.push("Choisissez au moins un type de jeu.")
      }
      const d = q.gamePreferences.difficulty
      if (d !== 1 && d !== 2 && d !== 3 && d !== 4) {
        errors.push("Choisissez un niveau de difficulté (1 à 4).")
      }
      break
    }
    case "photos": {
      if (q.photos.length > MAX_PHOTOS) {
        errors.push(`Maximum ${MAX_PHOTOS} photos.`)
      }
      for (const photo of q.photos) {
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
    case "visual": {
      if (!q.visualPreferences.paletteId) errors.push("Choisissez une palette ou AUTO.")
      if (!q.visualPreferences.styleId) errors.push("Choisissez un style ou AUTO.")
      break
    }
    case "finale":
    case "recap":
      break
  }

  return errors
}

export function validateQuestionnaireComplete(q: QuestionnaireV1): string[] {
  if (!q.audience) return ["Audience manquante."]
  const steps = stepsForAudience(q.audience).filter((s) => s !== "recap")
  const errors: string[] = []
  for (const step of steps) {
    errors.push(...validateStep(step, q))
  }
  // Extra group size hard fail
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
