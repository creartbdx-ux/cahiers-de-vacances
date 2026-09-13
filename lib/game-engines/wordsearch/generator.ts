import { createRng, type Rng } from "../random"
import { ALL_DIRECTIONS, cellKey, cellsFor, cloneGrid, emptyGrid, startsFor } from "./geometry"
import type { NormalizedWord, Placement, WordSearchCandidate, WordSearchDirection } from "./types"

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

function emptyOrientationCounts(directions: WordSearchDirection[]): Record<WordSearchDirection, number> {
  const counts = { E: 0, S: 0, SE: 0, NE: 0 }
  for (const d of directions) counts[d] = 0
  return counts
}

function letterFrequency(words: NormalizedWord[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const w of words) {
    for (const ch of w.word) freq.set(ch, (freq.get(ch) ?? 0) + 1)
  }
  return freq
}

/** Longest first, then letters that appear often across the list (crossing-friendly). */
export function orderWords(words: NormalizedWord[]): NormalizedWord[] {
  const freq = letterFrequency(words)
  const crossScore = (w: NormalizedWord) => [...w.word].reduce((sum, ch) => sum + (freq.get(ch) ?? 0), 0)
  return words.slice().sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length
    const cs = crossScore(b) - crossScore(a)
    if (cs !== 0) return cs
    return a.word < b.word ? -1 : a.word > b.word ? 1 : 0
  })
}

function evaluatePlacement(
  grid: (string | null)[][],
  word: string,
  row: number,
  column: number,
  direction: WordSearchDirection,
  width: number,
  height: number,
): { valid: boolean; crossings: number } {
  const cells = cellsFor(row, column, direction, word.length)
  let crossings = 0
  for (let i = 0; i < cells.length; i++) {
    const { row: r, column: c } = cells[i]
    if (r < 0 || c < 0 || r >= height || c >= width) return { valid: false, crossings: 0 }
    const existing = grid[r][c]
    if (existing !== null) {
      if (existing !== word[i]) return { valid: false, crossings: 0 }
      crossings++
    }
  }
  if (crossings === word.length) return { valid: false, crossings: 0 }
  return { valid: true, crossings }
}

function writeWord(
  grid: (string | null)[][],
  word: string,
  row: number,
  column: number,
  direction: WordSearchDirection,
): CoordLike[] {
  const cells = cellsFor(row, column, direction, word.length)
  for (let i = 0; i < cells.length; i++) {
    grid[cells[i].row][cells[i].column] = word[i]
  }
  return cells
}

type CoordLike = { row: number; column: number }

function filledCentroid(grid: (string | null)[][], width: number, height: number): { r: number; c: number; n: number } {
  let rSum = 0
  let cSum = 0
  let n = 0
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] !== null) {
        rSum += r
        cSum += c
        n++
      }
    }
  }
  if (n === 0) {
    return { r: (height - 1) / 2, c: (width - 1) / 2, n: 0 }
  }
  return { r: rSum / n, c: cSum / n, n }
}

function compactnessCost(
  cells: CoordLike[],
  centroid: { r: number; c: number; n: number },
): number {
  if (centroid.n === 0) {
    // Prefer the geometric centre of the grid for the first word.
    return cells.reduce((sum, cell) => sum + Math.abs(cell.row - centroid.r) + Math.abs(cell.column - centroid.c), 0)
  }
  return cells.reduce((sum, cell) => sum + Math.abs(cell.row - centroid.r) + Math.abs(cell.column - centroid.c), 0)
}

interface ScoredSlot {
  row: number
  column: number
  direction: WordSearchDirection
  crossings: number
  score: number
}

function scoreSlot(
  crossings: number,
  direction: WordSearchDirection,
  orientationCounts: Record<WordSearchDirection, number>,
  compactness: number,
  cellCount: number,
): number {
  const maxCount = Math.max(orientationCounts.E, orientationCounts.S, orientationCounts.SE, orientationCounts.NE)
  const diversity = maxCount - orientationCounts[direction]
  return crossings * 120 + diversity * 18 - compactness / Math.max(1, cellCount)
}

function pickBestSlot(slots: ScoredSlot[], rng: Rng | null): ScoredSlot | null {
  if (slots.length === 0) return null
  let bestScore = -Infinity
  for (const s of slots) if (s.score > bestScore) bestScore = s.score
  const top = slots.filter((s) => s.score === bestScore)
  if (!rng || top.length === 1) {
    top.sort((a, b) => {
      if (a.direction !== b.direction) return a.direction.localeCompare(b.direction)
      if (a.row !== b.row) return a.row - b.row
      return a.column - b.column
    })
    return top[0]
  }
  return top[rng.int(top.length)]
}

function collectSlots(
  grid: (string | null)[][],
  word: NormalizedWord,
  directions: WordSearchDirection[],
  width: number,
  height: number,
  orientationCounts: Record<WordSearchDirection, number>,
  preferCrossings: boolean,
): ScoredSlot[] {
  const centroid = filledCentroid(grid, width, height)
  const slots: ScoredSlot[] = []
  for (const direction of directions) {
    for (const start of startsFor(direction, word.length, width, height)) {
      const { valid, crossings } = evaluatePlacement(
        grid,
        word.word,
        start.row,
        start.column,
        direction,
        width,
        height,
      )
      if (!valid) continue
      if (preferCrossings && centroid.n > 0 && crossings === 0) continue
      const cells = cellsFor(start.row, start.column, direction, word.length)
      const compactness = compactnessCost(cells, centroid)
      slots.push({
        row: start.row,
        column: start.column,
        direction,
        crossings,
        score: scoreSlot(crossings, direction, orientationCounts, compactness, cells.length),
      })
    }
  }
  return slots
}

function placeWord(
  grid: (string | null)[][],
  word: NormalizedWord,
  directions: WordSearchDirection[],
  width: number,
  height: number,
  orientationCounts: Record<WordSearchDirection, number>,
  rng: Rng | null,
): Placement | null {
  let slots = collectSlots(grid, word, directions, width, height, orientationCounts, true)
  if (slots.length === 0) {
    slots = collectSlots(grid, word, directions, width, height, orientationCounts, false)
  }
  const chosen = pickBestSlot(slots, rng)
  if (!chosen) return null
  const cells = writeWord(grid, word.word, chosen.row, chosen.column, chosen.direction)
  orientationCounts[chosen.direction]++
  return {
    originalWord: word.original,
    normalizedWord: word.word,
    row: chosen.row,
    column: chosen.column,
    direction: chosen.direction,
    length: word.length,
    cells,
  }
}

function countCrossings(placements: Placement[]): number {
  const counts = new Map<string, number>()
  for (const p of placements) {
    for (const c of p.cells) {
      const k = cellKey(c.row, c.column)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  let n = 0
  for (const v of counts.values()) if (v >= 2) n++
  return n
}

export function fillEmptyCells(grid: (string | null)[][], rng: Rng): string[][] {
  return grid.map((row) =>
    row.map((cell) => {
      if (cell !== null) return cell
      return LETTERS[rng.int(26)]
    }),
  )
}

/**
 * Score a candidate relative to min / target / max:
 * - under minWords: heavy penalty (still climbs toward the floor)
 * - up to targetWords: strong reward for each placed word, bonus at the target
 * - above targetWords: soft per-word penalty — overshoot only wins via quality
 *   (crossings / orientation diversity), never past maxWords (enforced earlier)
 */
export function scoreCandidate(
  placed: number,
  crossings: number,
  orientationCounts: Record<WordSearchDirection, number>,
  minWords: number,
  targetWords: number,
  maxWords: number,
): number {
  const usedDirs = (["E", "S", "SE", "NE"] as WordSearchDirection[]).filter((d) => orientationCounts[d] > 0).length
  const quality = crossings * 80 + usedDirs * 50
  const target = Math.min(Math.max(targetWords, minWords), maxWords)

  if (placed < minWords) {
    return placed * 50 + quality - 1_000_000
  }

  if (placed <= target) {
    const reachBonus = placed === target ? 8_000 : 0
    return placed * 2_500 + reachBonus + quality
  }

  const overshoot = placed - target
  return target * 2_500 + 8_000 + quality - overshoot * 400
}

function orientationCountsFrom(
  placements: Placement[],
  directions: WordSearchDirection[],
): Record<WordSearchDirection, number> {
  const counts = emptyOrientationCounts(directions)
  for (const p of placements) counts[p.direction]++
  return counts
}

function buildGridFromPlacements(
  placements: Placement[],
  width: number,
  height: number,
): (string | null)[][] {
  const grid = emptyGrid(width, height)
  for (const p of placements) {
    writeWord(grid, p.normalizedWord, p.row, p.column, p.direction)
  }
  return grid
}

/**
 * Place up to maxWords, then keep the placement prefix whose score best
 * matches the min/target/max policy (so targetWords is not drowned by greed).
 */
function buildCandidate(
  ordered: NormalizedWord[],
  width: number,
  height: number,
  directions: WordSearchDirection[],
  minWords: number,
  targetWords: number,
  maxWords: number,
  fillRng: Rng,
  pickRng: Rng | null,
): WordSearchCandidate {
  const grid = emptyGrid(width, height)
  const placements: Placement[] = []
  const orientationCounts = emptyOrientationCounts(directions)

  for (const word of ordered) {
    if (placements.length >= maxWords) break
    const placement = placeWord(grid, word, directions, width, height, orientationCounts, pickRng)
    if (!placement) continue
    placements.push(placement)
  }

  let bestK = 0
  let bestScore = -Infinity
  for (let k = 0; k <= placements.length; k++) {
    const subset = placements.slice(0, k)
    const ori = orientationCountsFrom(subset, directions)
    const crossings = countCrossings(subset)
    const score = scoreCandidate(k, crossings, ori, minWords, targetWords, maxWords)
    if (score > bestScore) {
      bestScore = score
      bestK = k
    }
  }

  const chosen = placements.slice(0, bestK)
  const chosenWords = new Set(chosen.map((p) => p.normalizedWord))
  const unused = ordered.filter((w) => !chosenWords.has(w.word))
  const chosenOri = orientationCountsFrom(chosen, directions)
  const crossings = countCrossings(chosen)
  const rebuilt = buildGridFromPlacements(chosen, width, height)
  const filled = fillEmptyCells(rebuilt, fillRng)

  return {
    grid: cloneGrid(rebuilt),
    filled,
    placements: chosen,
    unused,
    width,
    height,
    crossings,
    orientationCounts: chosenOri,
    score: bestScore,
  }
}

export function generateBestCandidate(
  eligible: NormalizedWord[],
  seed: string,
  width: number,
  height: number,
  directions: WordSearchDirection[],
  minWords: number,
  targetWords: number,
  maxWords: number,
  attempts: number,
): { best: WordSearchCandidate | null; candidatesTried: number } {
  if (eligible.length === 0) return { best: null, candidatesTried: 0 }

  const enabled = directions.length > 0 ? directions : ALL_DIRECTIONS
  const base = orderWords(eligible)
  let best: WordSearchCandidate | null = null
  let tried = 0

  for (let attempt = 0; attempt < attempts; attempt++) {
    const ordered = attempt === 0 ? base : createRng(`${seed}#order#${attempt}`).shuffle(base)
    const dirs = attempt === 0 ? enabled : createRng(`${seed}#dirs#${attempt}`).shuffle(enabled)
    const pickRng = attempt === 0 ? null : createRng(`${seed}#pick#${attempt}`)
    const fillRng = createRng(`${seed}#fill#${attempt}`)
    const candidate = buildCandidate(
      ordered,
      width,
      height,
      dirs,
      minWords,
      targetWords,
      maxWords,
      fillRng,
      pickRng,
    )
    tried++
    if (!best || candidate.score > best.score) best = candidate
  }

  return { best, candidatesTried: tried }
}
