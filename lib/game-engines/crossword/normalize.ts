import type { CrosswordEntry, NormalizedEntry } from "./types"

/** V1 grid length constraints (in normalized letters). */
export const MIN_ANSWER_LENGTH = 3
export const MAX_ANSWER_LENGTH = 12

/**
 * Normalize an answer for the GRID: uppercase, strip accents, remove spaces,
 * apostrophes, hyphens, and keep only A-Z.
 *
 *   "Vélo"          -> "VELO"
 *   "Saint-Émilion" -> "SAINTEMILION"
 *   "l'aigle"       -> "LAIGLE"
 *
 * The original string is preserved separately by `normalizeEntries` so it can
 * still be shown or debugged.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFD") // split base letters from combining accents
    .replace(/[\u0300-\u036f]/g, "") // drop the accents
    .toUpperCase()
    .replace(/[^A-Z]/g, "") // keep only A-Z (removes spaces, ' ’ - etc.)
}

export function isEligibleLength(normalized: string): boolean {
  return normalized.length >= MIN_ANSWER_LENGTH && normalized.length <= MAX_ANSWER_LENGTH
}

/**
 * Normalize a list of raw entries. Keeps the original answer, drops entries
 * that normalize to an empty string, and de-duplicates by normalized answer
 * (first occurrence wins) so the same word can't be placed twice.
 */
export function normalizeEntries(entries: CrosswordEntry[]): NormalizedEntry[] {
  const seen = new Set<string>()
  const out: NormalizedEntry[] = []

  for (const entry of entries) {
    const answer = normalizeAnswer(entry.answer ?? "")
    if (!answer) continue
    if (seen.has(answer)) continue
    seen.add(answer)
    out.push({
      answer,
      original: entry.answer,
      clue: entry.clue,
      length: answer.length,
    })
  }

  return out
}

/** Split normalized entries into eligible (3-12 letters) and rejected. */
export function partitionEligible(entries: NormalizedEntry[]): {
  eligible: NormalizedEntry[]
  rejected: NormalizedEntry[]
} {
  const eligible: NormalizedEntry[] = []
  const rejected: NormalizedEntry[] = []
  for (const e of entries) {
    if (isEligibleLength(e.answer)) eligible.push(e)
    else rejected.push(e)
  }
  return { eligible, rejected }
}
