import { isGameEngineId } from "@/lib/game-engines/registry"
import type { BookProfileV1, GameTypePreference } from "@/lib/questionnaire/types"
import type { Game } from "@/lib/supabase/types"
import { PERSONAL_THRESHOLDS } from "./requirements"
import type { SourceInventory } from "./types"
import { EDITORIAL_V1_GAME_IDS, type EditorialV1GameId, type PersonalizationType } from "./types"

/** Editorial: QUIZ_PERSONAL is a poor fit when the reader plays about themselves. */
export const QUIZ_PERSONAL_REJECT_ME =
  "Un quiz sur soi-même apporte peu de valeur ludique."

export const QUIZ_PERSONAL_REJECT_OTHER_PERSON =
  "Le destinataire étant également le joueur, privilégier un quiz thématique et utiliser les données personnelles dans des jeux plus adaptés."

export interface EligibilityResult {
  gameId: EditorialV1GameId
  eligible: boolean
  reason: string
  personalizationType: PersonalizationType
  technicalEngine: string
  gameName: string
  maxPerBook: number
  /** How strong the match is (0–1), used by scoring. */
  strength: number
}

function likedEngine(profile: BookProfileV1, engine: string): boolean {
  const liked = profile.gamePreferences.likedTypes ?? []
  if (!liked.length) return true
  if (liked.includes("SURPRISE")) return true
  return liked.includes(engine as GameTypePreference)
}

function dislikedEngine(profile: BookProfileV1, engine: string): boolean {
  const disliked = profile.gamePreferences.dislikedTypes ?? []
  return disliked.includes(engine as GameTypePreference)
}

function clampDifficulty(profile: BookProfileV1, game: Game): boolean {
  const d = profile.gamePreferences.difficulty
  return d >= game.min_difficulty && d <= game.max_difficulty
}

export function evaluateEligibility(
  profile: BookProfileV1,
  inventory: SourceInventory,
  games: Game[],
): { eligible: EligibilityResult[]; rejected: { gameId: string; reason: string }[] } {
  const byId = new Map(games.map((g) => [g.id, g]))
  const eligible: EligibilityResult[] = []
  const rejected: { gameId: string; reason: string }[] = []

  for (const gameId of EDITORIAL_V1_GAME_IDS) {
    const game = byId.get(gameId)
    if (!game) {
      rejected.push({ gameId, reason: "Jeu absent du catalogue." })
      continue
    }
    if (!game.active) {
      rejected.push({ gameId, reason: "Jeu inactif." })
      continue
    }
    if (!game.technical_engine || !isGameEngineId(game.technical_engine)) {
      rejected.push({ gameId, reason: "Moteur technique non implémenté." })
      continue
    }
    if (!clampDifficulty(profile, game)) {
      rejected.push({
        gameId,
        reason: `Difficulté profil hors plage ${game.min_difficulty}–${game.max_difficulty}.`,
      })
      continue
    }
    if (dislikedEngine(profile, game.technical_engine)) {
      rejected.push({ gameId, reason: "Type de jeu marqué à éviter." })
      continue
    }

    const personalizationType = (game.personalization_type === "THEME"
      ? "THEME"
      : "PERSONAL") as PersonalizationType

    let ok = false
    let reason = ""
    let strength = 0

    if (gameId === "CROSSWORD_PERSONAL") {
      const n = inventory.crosswordAnswers.length
      const { min, ideal } = PERSONAL_THRESHOLDS.CROSSWORD_PERSONAL
      ok = n >= min
      strength = Math.min(1, n / ideal)
      reason = ok
        ? `Assez de réponses courtes personnelles (${n}).`
        : `Données insuffisantes pour mots croisés personnalisés (${n}/${min} réponses courtes).`
    } else if (gameId === "WORDSEARCH_PERSONAL") {
      const n = inventory.wordsearchWords.length
      const { min, ideal } = PERSONAL_THRESHOLDS.WORDSEARCH_PERSONAL
      ok = n >= min
      strength = Math.min(1, n / ideal)
      reason = ok
        ? `Assez de mots personnels normalisables (${n}).`
        : `Données insuffisantes pour mots mêlés personnalisés (${n}/${min}).`
    } else if (gameId === "QUIZ_PERSONAL") {
      // ME / OTHER_PERSON: reader would quiz themselves — poor ludic value.
      // DUO / GROUP: cross-person / collective quiz remains fun.
      if (profile.audience === "ME") {
        ok = false
        reason = QUIZ_PERSONAL_REJECT_ME
      } else if (profile.audience === "OTHER_PERSON") {
        ok = false
        reason = QUIZ_PERSONAL_REJECT_OTHER_PERSON
      } else {
        const n = inventory.quizFacts.length
        const { min, ideal } = PERSONAL_THRESHOLDS.QUIZ_PERSONAL
        ok = n >= min
        strength = Math.min(1, n / ideal)
        reason = ok
          ? `Assez de faits personnels / collectifs pour un quiz (${n}).`
          : `Faits personnels insuffisants pour un quiz (${n}/${min}).`
      }
    } else if (gameId === "TRUE_FALSE_PERSONAL") {
      const n = inventory.trueFalseFacts.length
      const { min, ideal } = PERSONAL_THRESHOLDS.TRUE_FALSE_PERSONAL
      ok = n >= min
      strength = Math.min(1, n / ideal)
      reason = ok
        ? `Assez de faits fiables pour vrai/faux (${n}).`
        : `Faits insuffisants pour vrai/faux personnalisé (${n}/${min}).`
    } else if (
      gameId === "CROSSWORD_THEME" ||
      gameId === "WORDSEARCH_THEME" ||
      gameId === "QUIZ_THEME"
    ) {
      const n = inventory.interests.length
      ok = n >= 1
      strength = Math.min(1, n / 3)
      reason = ok
        ? `Univers thématiques disponibles (${n}).`
        : "Aucun intérêt/univers pour un jeu thématique."

      // Fallback: when QUIZ_PERSONAL is editorially unsuitable, prefer QUIZ_THEME.
      if (
        ok &&
        gameId === "QUIZ_THEME" &&
        (profile.audience === "ME" || profile.audience === "OTHER_PERSON")
      ) {
        strength = Math.min(1, strength + 0.35)
        reason = `Univers thématiques disponibles (${n}) — favorisé car un quiz personnel est peu adapté à cette audience.`
      }
    }

    if (!ok) {
      rejected.push({ gameId, reason })
      continue
    }

    // Soft preference boost later; still eligible if not liked.
    const liked = likedEngine(profile, game.technical_engine)
    if (!liked) strength *= 0.85

    eligible.push({
      gameId,
      eligible: true,
      reason,
      personalizationType,
      technicalEngine: game.technical_engine,
      gameName: game.name,
      maxPerBook: game.max_per_book,
      strength,
    })
  }

  // Games in catalogue outside V1 set — ignore silently for V1 planner.
  return { eligible, rejected }
}
