import { cellKey, hasLetter, type LetterGrid, type Numbering } from "./numbering"
import type { CrosswordCell } from "./types"

/**
 * Build the single canonical cell matrix from the letter grid + numbering.
 * Every cell always carries its solution letter; the player view is derived
 * from this exact same matrix by hiding letters — so the game grid and the
 * solution grid can never diverge in geometry.
 */
export function buildCells(
  grid: LetterGrid,
  width: number,
  height: number,
  numbering: Numbering,
): CrosswordCell[][] {
  const cells: CrosswordCell[][] = []
  for (let row = 0; row < height; row++) {
    const rowCells: CrosswordCell[] = []
    for (let col = 0; col < width; col++) {
      const isLetter = hasLetter(grid, row, col)
      rowCells.push({
        row,
        column: col,
        block: !isLetter,
        solution: isLetter ? grid.get(cellKey(row, col))! : null,
        number: numbering.numberAt.get(cellKey(row, col)) ?? null,
      })
    }
    cells.push(rowCells)
  }
  return cells
}

/**
 * Player view: identical geometry (block / number / coordinates) with every
 * solution letter removed. Derived from the canonical matrix, never rebuilt.
 */
export function toPlayerCells(cells: CrosswordCell[][]): CrosswordCell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell, solution: null })))
}

/** Solution view: the canonical matrix as-is (letters visible). */
export function toSolutionCells(cells: CrosswordCell[][]): CrosswordCell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell })))
}
