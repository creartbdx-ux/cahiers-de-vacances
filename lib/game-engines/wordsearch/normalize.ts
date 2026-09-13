import type { NormalizedWord, WordSearchDirection, WordSearchEntry } from "./types"

/** V1 minimum word length (in normalized letters). */
export const MIN_WORD_LENGTH = 3

/**
 * Normalize a word for the GRID: uppercase, strip accents, remove spaces,
 * apostrophes, hyphens, and keep only A-Z. Identical rules to the crossword
 * engine so both stay consistent.
 *
 *   "Vélo"          -> "VELO"
 *   "Saint-Émilion" -> "SAINTEMILION"
 *   "l'aigle"       -> "LAIGLE"
 */
export function normalizeWord(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
}

/**
 * Normalize a list of raw entries: keep the original word, drop entries that
 * normalize to empty, and de-duplicate by normalized word (first wins) so the
 * same word can't be hidden twice.
 */
export function normalizeEntries(entries: WordSearchEntry[]): NormalizedWord[] {
  const seen = new Set<string>()
  const out: NormalizedWord[] = []

  for (const entry of entries) {
    const word = normalizeWord(entry.word ?? "")
    if (!word) continue
    if (seen.has(word)) continue
    seen.add(word)
    out.push({ word, original: entry.word, length: word.length })
  }

  return out
}

/**
 * The longest run a single direction can hold on a width×height grid:
 *   E  spans columns  -> width
 *   S  spans rows     -> height
 *   SE / NE are diagonal -> min(width, height)
 */
export function directionMaxSpan(direction: WordSearchDirection, width: number, height: number): number {
  switch (direction) {
    case "E":
      return width
    case "S":
      return height
    case "SE":
    case "NE":
      return Math.min(width, height)
  }
}

/** The longest word the grid can hold across ALL enabled directions. */
export function maxPlaceableLength(
  directions: WordSearchDirection[],
  width: number,
  height: number,
): number {
  return directions.reduce((max, d) => Math.max(max, directionMaxSpan(d, width, height)), 0)
}

/**
 * Split normalized words into those that can fit the grid (>= MIN and short
 * enough for at least one enabled direction) and those that are rejected.
 */
export function partitionEligible(
  words: NormalizedWord[],
  directions: WordSearchDirection[],
  width: number,
  height: number,
): { eligible: NormalizedWord[]; rejected: NormalizedWord[] } {
  const limit = maxPlaceableLength(directions, width, height)
  const eligible: NormalizedWord[] = []
  const rejected: NormalizedWord[] = []
  for (const w of words) {
    if (w.length >= MIN_WORD_LENGTH && w.length <= limit) eligible.push(w)
    else rejected.push(w)
  }
  return { eligible, rejected }
}
