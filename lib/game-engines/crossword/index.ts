import { generateBestCandidate } from "./generator"
import { computeNumbering } from "./numbering"
import { normalizeEntries, partitionEligible } from "./normalize"
import { buildCells } from "./solution"
import { validateCandidate } from "./validator"
import type {
  CrosswordClue,
  CrosswordResult,
  GenerateCrosswordOptions,
  NormalizedEntry,
  PlacedWord,
} from "./types"

const DEFAULTS = {
  minEntries: 4,
  targetEntries: 12,
  maxEntries: 15,
  attempts: 60,
}

/**
 * Deterministically generate a crossword from answer+clue entries.
 *
 *   generateCrossword({ entries, seed, minEntries, targetEntries, maxEntries })
 *
 * The engine normalizes and filters the entries, runs a seeded search for the
 * best connected grid, validates it independently, and returns a fully
 * structured result — or a structured failure. It never throws on bad input
 * and never fabricates an invalid grid to hide a failure.
 */
export function generateCrossword(options: GenerateCrosswordOptions): CrosswordResult {
  const seed = String(options.seed ?? "default")
  const minEntries = options.minEntries ?? DEFAULTS.minEntries
  const maxEntries = options.maxEntries ?? DEFAULTS.maxEntries
  const attempts = options.attempts ?? DEFAULTS.attempts

  const normalized = normalizeEntries(options.entries ?? [])
  const { eligible, rejected } = partitionEligible(normalized)

  if (eligible.length < minEntries) {
    return {
      success: false,
      reason: "NOT_ENOUGH_ELIGIBLE_ENTRIES",
      message: `Seulement ${eligible.length} réponse(s) éligible(s) (3 à 12 lettres), il en faut au moins ${minEntries}.`,
      unusedEntries: [...rejected],
      stats: { seed, received: normalized.length, eligible: eligible.length },
    }
  }

  // targetEntries is a soft aim; the scored search naturally maximises placed
  // words up to maxEntries, so we simply bound the search by maxEntries.
  void (options.targetEntries ?? DEFAULTS.targetEntries)
  const { best, candidatesTried } = generateBestCandidate(eligible, seed, maxEntries, attempts)

  if (!best || best.placements.length < minEntries) {
    const placedAnswers = new Set(best?.placements.map((p) => p.entry.answer) ?? [])
    const unused = eligible.filter((e) => !placedAnswers.has(e.answer))
    return {
      success: false,
      reason: "NOT_ENOUGH_CONNECTED_ENTRIES",
      message: `Impossible de relier au moins ${minEntries} mots par des croisements (seed "${seed}").`,
      unusedEntries: [...unused, ...rejected],
      stats: {
        seed,
        received: normalized.length,
        eligible: eligible.length,
        placed: best?.placements.length ?? 0,
        candidatesTried,
      },
    }
  }

  const validation = validateCandidate(best)
  if (!validation.valid) {
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

  const numbering = computeNumbering(best.grid, best.width, best.height)
  const cells = buildCells(best.grid, best.width, best.height, numbering)

  // Attach clues to the geometry-derived slots by (row, col, orientation).
  const clueByStart = new Map<string, NormalizedEntry>()
  for (const p of best.placements) {
    clueByStart.set(`${p.orientation}:${p.row}:${p.col}`, p.entry)
  }
  const toClue = (slotList: typeof numbering.across): CrosswordClue[] =>
    slotList.map((slot) => {
      const entry = clueByStart.get(`${slot.orientation}:${slot.row}:${slot.column}`)
      return {
        number: slot.number,
        clue: entry?.clue ?? "",
        answer: slot.answer,
        row: slot.row,
        column: slot.column,
        length: slot.length,
      }
    })

  const across = toClue(numbering.across)
  const down = toClue(numbering.down)

  const placedWords: PlacedWord[] = best.placements.map((p) => {
    const number = numbering.numberAt.get(`${p.row},${p.col}`) ?? 0
    return {
      answer: p.entry.answer,
      original: p.entry.original,
      clue: p.entry.clue,
      row: p.row,
      column: p.col,
      orientation: p.orientation,
      number,
      length: p.entry.length,
    }
  })

  const unusedEntries = [...best.unused, ...rejected]

  return {
    success: true,
    seed,
    width: best.width,
    height: best.height,
    cells,
    across,
    down,
    placedWords,
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
      score: Math.round(best.score),
      candidatesTried,
    },
  }
}

export * from "./types"
export { normalizeAnswer, normalizeEntries } from "./normalize"
export { toPlayerCells, toSolutionCells } from "./solution"
