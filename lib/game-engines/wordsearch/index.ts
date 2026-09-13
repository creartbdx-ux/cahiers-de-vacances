import { generateBestCandidate } from "./generator"
import { ALL_DIRECTIONS } from "./geometry"
import { normalizeEntries, partitionEligible } from "./normalize"
import { validateCandidate } from "./validator"
import type { GenerateWordSearchOptions, WordSearchResult } from "./types"

const DEFAULTS = {
  width: 12,
  height: 12,
  minWords: 8,
  targetWords: 12,
  maxWords: 15,
  attempts: 40,
}

/**
 * Deterministically generate a word-search grid from a list of words.
 *
 *   generateWordSearch({ entries, seed, width, height, directions, minWords, targetWords, maxWords })
 *
 * The engine normalizes and filters the entries, runs a seeded search for the
 * best packed grid, fills leftover cells with seeded A-Z letters, validates
 * independently, and returns a structured result — or a structured failure.
 * It never throws on bad input and never fabricates an invalid grid.
 */
export function generateWordSearch(options: GenerateWordSearchOptions): WordSearchResult {
  const seed = String(options.seed ?? "default")
  const width = options.width ?? DEFAULTS.width
  const height = options.height ?? DEFAULTS.height
  const minWords = options.minWords ?? DEFAULTS.minWords
  const targetWords = options.targetWords ?? DEFAULTS.targetWords
  const maxWords = options.maxWords ?? DEFAULTS.maxWords
  const attempts = options.attempts ?? DEFAULTS.attempts
  const directions = options.directions?.length ? options.directions : ALL_DIRECTIONS

  const normalized = normalizeEntries(options.entries ?? [])
  const { eligible, rejected } = partitionEligible(normalized, directions, width, height)

  if (eligible.length < minWords) {
    return {
      success: false,
      reason: "NOT_ENOUGH_ELIGIBLE_ENTRIES",
      message: `Seulement ${eligible.length} mot(s) éligible(s) (3 lettres min, taille grille), il en faut au moins ${minWords}.`,
      unusedEntries: [...rejected, ...eligible],
      stats: { seed, received: normalized.length, eligible: eligible.length, width, height },
    }
  }

  const { best, candidatesTried } = generateBestCandidate(
    eligible,
    seed,
    width,
    height,
    directions,
    minWords,
    targetWords,
    maxWords,
    attempts,
  )

  if (!best || best.placements.length < minWords) {
    const placed = new Set(best?.placements.map((p) => p.normalizedWord) ?? [])
    const unused = eligible.filter((e) => !placed.has(e.word))
    return {
      success: false,
      reason: "PLACEMENT_FAILED",
      message: `Impossible de placer au moins ${minWords} mots (seed "${seed}").`,
      unusedEntries: [...unused, ...rejected],
      stats: {
        seed,
        received: normalized.length,
        eligible: eligible.length,
        placed: best?.placements.length ?? 0,
        width,
        height,
        candidatesTried,
      },
    }
  }

  const validation = validateCandidate(best, directions)
  if (!validation.ok) {
    return {
      success: false,
      reason: "VALIDATION_FAILED",
      message: `Grille invalide: ${validation.errors.join(" ")}`,
      unusedEntries: [...best.unused, ...rejected],
      stats: {
        seed,
        received: normalized.length,
        eligible: eligible.length,
        placed: best.placements.length,
        width: best.width,
        height: best.height,
        crossings: best.crossings,
        candidatesTried,
      },
    }
  }

  const unusedEntries = [...best.unused, ...rejected]

  return {
    success: true,
    seed,
    width: best.width,
    height: best.height,
    grid: best.filled,
    placements: best.placements,
    unusedEntries,
    stats: {
      seed,
      received: normalized.length,
      eligible: eligible.length,
      placed: best.placements.length,
      unused: unusedEntries.length,
      width: best.width,
      height: best.height,
      crossings: best.crossings,
      orientationCounts: best.orientationCounts,
      score: Math.round(best.score),
      candidatesTried,
    },
    validation,
  }
}

export * from "./types"
export { normalizeWord, normalizeEntries, partitionEligible } from "./normalize"
export { isHighlightedCell, wordCellKeySet } from "./solution"
export { ALL_DIRECTIONS } from "./geometry"
