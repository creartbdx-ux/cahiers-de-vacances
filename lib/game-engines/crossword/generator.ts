import { createRng } from "./random"
import { cellKey, computeNumbering, hasLetter, type LetterGrid } from "./numbering"
import type { NormalizedEntry, Orientation } from "./types"

/** A word placed in the (possibly negative) working coordinate space. */
interface RawPlacement {
  entry: NormalizedEntry
  row: number
  col: number
  orientation: Orientation
}

/** Result of one seeded attempt, already normalized to a 0-based grid. */
export interface Candidate {
  placements: RawPlacement[]
  grid: LetterGrid
  width: number
  height: number
  crossings: number
  acrossCount: number
  downCount: number
  unused: NormalizedEntry[]
  score: number
}

function coordsFor(len: number, row: number, col: number, orientation: Orientation): [number, number][] {
  const cells: [number, number][] = []
  for (let i = 0; i < len; i++) {
    cells.push(orientation === "across" ? [row, col + i] : [row + i, col])
  }
  return cells
}

/**
 * Check whether a word can legally be placed. Enforces the classic crossword
 * separation rules:
 *  - overlapping cells must carry the same letter (a real crossing),
 *  - the cells immediately before the start and after the end must be empty,
 *  - every non-crossing cell must have empty perpendicular neighbours (so two
 *    parallel words never touch side-by-side and no accidental word forms),
 *  - a non-first word must cross at least one existing letter.
 */
function evaluatePlacement(
  grid: LetterGrid,
  word: string,
  row: number,
  col: number,
  orientation: Orientation,
  isFirst: boolean,
): { valid: boolean; crossings: number } {
  const cells = coordsFor(word.length, row, col, orientation)

  // Before / after must be empty so the word isn't glued to another in-line.
  const [firstR, firstC] = cells[0]
  const [lastR, lastC] = cells[cells.length - 1]
  if (orientation === "across") {
    if (hasLetter(grid, firstR, firstC - 1)) return { valid: false, crossings: 0 }
    if (hasLetter(grid, lastR, lastC + 1)) return { valid: false, crossings: 0 }
  } else {
    if (hasLetter(grid, firstR - 1, firstC)) return { valid: false, crossings: 0 }
    if (hasLetter(grid, lastR + 1, lastC)) return { valid: false, crossings: 0 }
  }

  let crossings = 0
  for (let i = 0; i < cells.length; i++) {
    const [r, c] = cells[i]
    const existing = grid.get(cellKey(r, c))
    if (existing !== undefined) {
      if (existing !== word[i]) return { valid: false, crossings: 0 }
      crossings++
      continue
    }
    // Empty cell we'll fill: its perpendicular neighbours must be empty.
    if (orientation === "across") {
      if (hasLetter(grid, r - 1, c) || hasLetter(grid, r + 1, c)) return { valid: false, crossings: 0 }
    } else {
      if (hasLetter(grid, r, c - 1) || hasLetter(grid, r, c + 1)) return { valid: false, crossings: 0 }
    }
  }

  if (!isFirst && crossings === 0) return { valid: false, crossings: 0 }
  // A placement that is entirely overlap (no new letters) is degenerate.
  if (crossings === word.length) return { valid: false, crossings: 0 }
  return { valid: true, crossings }
}

function writeWord(grid: LetterGrid, word: string, row: number, col: number, orientation: Orientation): void {
  coordsFor(word.length, row, col, orientation).forEach(([r, c], i) => {
    grid.set(cellKey(r, c), word[i])
  })
}

/** Order entries so long, crossing-friendly words are placed first. */
function orderEntries(entries: NormalizedEntry[]): NormalizedEntry[] {
  const letterFreq = new Map<string, number>()
  for (const e of entries) {
    for (const ch of e.answer) letterFreq.set(ch, (letterFreq.get(ch) ?? 0) + 1)
  }
  const crossScore = (e: NormalizedEntry) =>
    [...e.answer].reduce((sum, ch) => sum + (letterFreq.get(ch) ?? 0), 0)

  return entries.slice().sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length
    const cs = crossScore(b) - crossScore(a)
    if (cs !== 0) return cs
    return a.answer < b.answer ? -1 : a.answer > b.answer ? 1 : 0
  })
}

function normalizeCandidate(placements: RawPlacement[], unused: NormalizedEntry[]): Candidate {
  const grid: LetterGrid = new Map()
  let minRow = Infinity
  let minCol = Infinity
  let maxRow = -Infinity
  let maxCol = -Infinity

  for (const p of placements) {
    for (const [r, c] of coordsFor(p.entry.length, p.row, p.col, p.orientation)) {
      minRow = Math.min(minRow, r)
      minCol = Math.min(minCol, c)
      maxRow = Math.max(maxRow, r)
      maxCol = Math.max(maxCol, c)
    }
  }

  const shifted: RawPlacement[] = placements.map((p) => ({
    ...p,
    row: p.row - minRow,
    col: p.col - minCol,
  }))
  for (const p of shifted) writeWord(grid, p.entry.answer, p.row, p.col, p.orientation)

  const width = maxCol - minCol + 1
  const height = maxRow - minRow + 1

  let crossings = 0
  for (const [key, letter] of grid) {
    const [r, c] = key.split(",").map(Number)
    // A crossing cell is a letter with neighbours on BOTH axes.
    const horiz = hasLetter(grid, r, c - 1) || hasLetter(grid, r, c + 1)
    const vert = hasLetter(grid, r - 1, c) || hasLetter(grid, r + 1, c)
    if (horiz && vert) crossings++
    void letter
  }

  const { across, down } = computeNumbering(grid, width, height)

  const area = width * height
  const balance = Math.abs(across.length - down.length)
  const aspect = Math.max(width, height) / Math.max(1, Math.min(width, height))
  const score =
    shifted.length * 1000 +
    crossings * 60 -
    area * 1.5 -
    balance * 12 -
    aspect * 8 -
    unused.length * 120

  return {
    placements: shifted,
    grid,
    width,
    height,
    crossings,
    acrossCount: across.length,
    downCount: down.length,
    unused,
    score,
  }
}

/** Build one candidate grid for a given seeded ordering. */
function buildCandidate(ordered: NormalizedEntry[], maxEntries: number): Candidate {
  const grid: LetterGrid = new Map()
  const placements: RawPlacement[] = []
  const placedAnswers = new Set<string>()

  // First word: horizontal at the origin.
  const first = ordered[0]
  writeWord(grid, first.answer, 0, 0, "across")
  placements.push({ entry: first, row: 0, col: 0, orientation: "across" })
  placedAnswers.add(first.answer)

  // Repeated passes: a word placed now can unlock crossings for a later word.
  let progressed = true
  while (progressed && placements.length < maxEntries) {
    progressed = false
    for (const entry of ordered) {
      if (placements.length >= maxEntries) break
      if (placedAnswers.has(entry.answer)) continue

      let best: { row: number; col: number; orientation: Orientation; crossings: number } | null = null

      // Try to hook each of the word's letters onto every matching grid cell.
      for (let i = 0; i < entry.answer.length; i++) {
        const letter = entry.answer[i]
        for (const [key, existing] of grid) {
          if (existing !== letter) continue
          const [r, c] = key.split(",").map(Number)
          const candidates: { row: number; col: number; orientation: Orientation }[] = [
            { row: r, col: c - i, orientation: "across" },
            { row: r - i, col: c, orientation: "down" },
          ]
          for (const cand of candidates) {
            const { valid, crossings } = evaluatePlacement(
              grid,
              entry.answer,
              cand.row,
              cand.col,
              cand.orientation,
              false,
            )
            if (!valid) continue
            if (!best || crossings > best.crossings) {
              best = { ...cand, crossings }
            }
          }
        }
      }

      if (best) {
        writeWord(grid, entry.answer, best.row, best.col, best.orientation)
        placements.push({ entry, row: best.row, col: best.col, orientation: best.orientation })
        placedAnswers.add(entry.answer)
        progressed = true
      }
    }
  }

  const unused = ordered.filter((e) => !placedAnswers.has(e.answer))
  return normalizeCandidate(placements, unused)
}

/**
 * Run several seeded attempts and return the highest-scoring candidate. Because
 * every attempt derives its ordering from the seed, the whole search is
 * reproducible: same entries + same seed => same winning grid.
 */
export function generateBestCandidate(
  eligible: NormalizedEntry[],
  seed: string,
  maxEntries: number,
  attempts: number,
): { best: Candidate | null; candidatesTried: number } {
  if (eligible.length === 0) return { best: null, candidatesTried: 0 }

  const base = orderEntries(eligible)
  let best: Candidate | null = null
  let tried = 0

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Attempt 0 keeps the strong long-first ordering; later attempts explore
    // seeded reorderings for variety while staying deterministic.
    const ordered = attempt === 0 ? base : createRng(`${seed}#${attempt}`).shuffle(base)
    const candidate = buildCandidate(ordered, maxEntries)
    tried++
    if (!best || candidate.score > best.score) best = candidate
  }

  return { best, candidatesTried: tried }
}
