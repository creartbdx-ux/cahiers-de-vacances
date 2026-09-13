import type { Orientation } from "./types"

/**
 * A letter grid is the canonical geometry the engine reasons about: a map from
 * "row,col" to a single uppercase letter. Numbering, validation and the final
 * cell/solution structures are all DERIVED from this one source, never
 * recreated independently — so the player grid and the solution grid are
 * guaranteed to share the exact same layout.
 */
export type LetterGrid = Map<string, string>

export function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

export function hasLetter(grid: LetterGrid, row: number, col: number): boolean {
  return grid.has(cellKey(row, col))
}

/** A word slot detected from pure grid geometry. */
export interface Slot {
  number: number
  orientation: Orientation
  row: number
  column: number
  length: number
  answer: string
}

export interface Numbering {
  /** number assigned to each start cell, keyed by "row,col". */
  numberAt: Map<string, number>
  across: Slot[]
  down: Slot[]
}

/**
 * Assign clue numbers using the classic convention: scan top→bottom then
 * left→right; a cell starts a number when it begins an across word, a down
 * word, or both. A cell that starts both an across and a down word carries a
 * single shared number.
 */
export function computeNumbering(grid: LetterGrid, width: number, height: number): Numbering {
  const numberAt = new Map<string, number>()
  const across: Slot[] = []
  const down: Slot[] = []
  let next = 1

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!hasLetter(grid, row, col)) continue

      const leftEmpty = !hasLetter(grid, row, col - 1)
      const rightLetter = hasLetter(grid, row, col + 1)
      const topEmpty = !hasLetter(grid, row - 1, col)
      const bottomLetter = hasLetter(grid, row + 1, col)

      const startsAcross = leftEmpty && rightLetter
      const startsDown = topEmpty && bottomLetter
      if (!startsAcross && !startsDown) continue

      const number = next++
      numberAt.set(cellKey(row, col), number)

      if (startsAcross) {
        let c = col
        let answer = ""
        while (hasLetter(grid, row, c)) {
          answer += grid.get(cellKey(row, c))
          c++
        }
        across.push({ number, orientation: "across", row, column: col, length: answer.length, answer })
      }
      if (startsDown) {
        let r = row
        let answer = ""
        while (hasLetter(grid, r, col)) {
          answer += grid.get(cellKey(r, col))
          r++
        }
        down.push({ number, orientation: "down", row, column: col, length: answer.length, answer })
      }
    }
  }

  return { numberAt, across, down }
}
