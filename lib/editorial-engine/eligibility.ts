import { isGameEngineId } from "@/lib/game-engines/registry"
import type { BookProfileV1, GameTypePreference } from "@/lib/questionnaire/types"
import type { Game } from "@/lib/supabase/types"
import { PERSONAL_THRESHOLDS } from "./requirements"
import type { SourceInventory } from "./types"
import { EDITORIAL_V1_GAME_IDS, type EditorialV1GameId, type PersonalizationType } from "./types"

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
      const n = inventory.quizFacts.length
      const { min, ideal } = PERSONAL_THRESHOLDS.QUIZ_PERSONAL
      ok = n >= min
      strength = Math.min(1, n / ideal)
      reason = ok
        ? `Assez de faits personnels distincts (${n}).`
        : `Faits personnels insuffisants pour un quiz (${n}/${min}).`
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
