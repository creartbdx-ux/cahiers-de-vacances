import type { Candidate } from "./generator"
import { cellKey, computeNumbering, hasLetter } from "./numbering"

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Independent structural validator. It does NOT trust the generator: it
 * re-derives everything from the final grid and checks the classic invariants.
 * The engine must never report success on a grid that fails here.
 */
export function validateCandidate(candidate: Candidate): ValidationResult {
  const { grid, width, height, placements } = candidate
  const errors: string[] = []

  // 1. Every placed word sits inside the grid and matches the written letters.
  for (const p of placements) {
    for (let i = 0; i < p.entry.length; i++) {
      const r = p.orientation === "across" ? p.row : p.row + i
      const c = p.orientation === "across" ? p.col + i : p.col
      if (r < 0 || c < 0 || r >= height || c >= width) {
        errors.push(`Le mot ${p.entry.answer} sort de la grille en (${r}, ${c}).`)
        break
      }
      if (grid.get(cellKey(r, c)) !== p.entry.answer[i]) {
        errors.push(`Collision de lettre pour ${p.entry.answer} en (${r}, ${c}).`)
        break
      }
    }
  }

  // 2. Each placed word must be a MAXIMAL run (empty before start / after end),
  //    otherwise it is glued to another word.
  for (const p of placements) {
    const beforeOccupied =
      p.orientation === "across"
        ? hasLetter(grid, p.row, p.col - 1)
        : hasLetter(grid, p.row - 1, p.col)
    const afterOccupied =
      p.orientation === "across"
        ? hasLetter(grid, p.row, p.col + p.entry.length)
        : hasLetter(grid, p.row + p.entry.length, p.col)
    if (beforeOccupied || afterOccupied) {
      errors.push(`Le mot ${p.entry.answer} est collé à un autre mot (adjacence illégale).`)
    }
  }

  // 3. No accidental words: every maximal run of length >= 2 must correspond to
  //    a real placed word (checked by re-deriving slots from geometry).
  const { across, down, numberAt } = computeNumbering(grid, width, height)
  const placedKeys = new Set(
    placements.map((p) => `${p.orientation}:${p.row}:${p.col}:${p.entry.answer}`),
  )
  for (const slot of [...across, ...down]) {
    const key = `${slot.orientation}:${slot.row}:${slot.column}:${slot.answer}`
    if (!placedKeys.has(key)) {
      errors.push(`Mot accidentel détecté: ${slot.answer} (${slot.orientation}).`)
    }
  }
  // Also every placed word must appear as a derived slot (coherent numbering).
  for (const p of placements) {
    if (!numberAt.has(cellKey(p.row, p.col))) {
      errors.push(`Le mot ${p.entry.answer} n'a pas de numéro de départ cohérent.`)
    }
  }

  // 4. Connectivity: all letter cells form a single connected component.
  const letterCells = [...grid.keys()]
  if (letterCells.length > 0) {
    const visited = new Set<string>()
    const start = letterCells[0]
    const queue = [start]
    visited.add(start)
    while (queue.length) {
      const [r, c] = queue.shift()!.split(",").map(Number)
      const neighbours = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ]
      for (const [nr, nc] of neighbours) {
        const nk = cellKey(nr, nc)
        if (grid.has(nk) && !visited.has(nk)) {
          visited.add(nk)
          queue.push(nk)
        }
      }
    }
    if (visited.size !== letterCells.length) {
      errors.push(
        `Grille non connectée: ${visited.size}/${letterCells.length} cases reliées.`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}
