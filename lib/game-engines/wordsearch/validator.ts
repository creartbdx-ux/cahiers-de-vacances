import { ALL_DIRECTIONS, cellKey, cellsFor, inBounds } from "./geometry"
import type { Placement, WordSearchCandidate, WordSearchDirection, WordSearchValidation } from "./types"

const LETTER = /^[A-Z]$/

/**
 * Independent structural validator. It does NOT trust the generator: it
 * re-reads every placement from the filled grid and checks the invariants.
 * The engine must never report success on a grid that fails here.
 */
export function validateCandidate(
  candidate: WordSearchCandidate,
  allowedDirections: WordSearchDirection[] = ALL_DIRECTIONS,
): WordSearchValidation {
  const errors: string[] = []
  const { filled, placements, width, height } = candidate

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    errors.push(`Dimensions invalides: ${width}×${height}.`)
  }

  if (filled.length !== height) {
    errors.push(`La grille a ${filled.length} lignes, attendu ${height}.`)
  }
  for (let r = 0; r < filled.length; r++) {
    if (filled[r].length !== width) {
      errors.push(`La ligne ${r} a ${filled[r].length} colonnes, attendu ${width}.`)
    }
    for (let c = 0; c < (filled[r]?.length ?? 0); c++) {
      const ch = filled[r][c]
      if (!LETTER.test(ch ?? "")) {
        errors.push(`Cellule (${r}, ${c}) n'est pas A-Z.`)
      }
    }
  }

  const allowed = new Set(allowedDirections)
  const occupancy = new Map<string, string>()

  for (const p of placements) {
    if (!allowed.has(p.direction)) {
      errors.push(`Orientation interdite pour ${p.normalizedWord}: ${p.direction}.`)
    }
    if (p.length !== p.normalizedWord.length) {
      errors.push(`Longueur incohérente pour ${p.normalizedWord}.`)
    }
    if (!inBounds(p.row, p.column, width, height)) {
      errors.push(`Le mot ${p.normalizedWord} démarre hors grille (${p.row}, ${p.column}).`)
      continue
    }

    const expectedCells = cellsFor(p.row, p.column, p.direction, p.length)
    if (p.cells.length !== expectedCells.length) {
      errors.push(`Chemin incomplet pour ${p.normalizedWord}.`)
    }
    for (let i = 0; i < expectedCells.length; i++) {
      const cell = expectedCells[i]
      if (!inBounds(cell.row, cell.column, width, height)) {
        errors.push(`Le mot ${p.normalizedWord} sort de la grille en (${cell.row}, ${cell.column}).`)
        break
      }
      const letter = filled[cell.row]?.[cell.column]
      if (letter !== p.normalizedWord[i]) {
        errors.push(
          `Le mot ${p.normalizedWord} n'est pas présent en (${cell.row}, ${cell.column}) (lu "${letter}").`,
        )
      }
      const key = cellKey(cell.row, cell.column)
      const previous = occupancy.get(key)
      if (previous !== undefined && previous !== p.normalizedWord[i]) {
        errors.push(`Collision incompatible en (${cell.row}, ${cell.column}).`)
      }
      occupancy.set(key, p.normalizedWord[i])
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Re-read a placement from a filled grid (for tests / correction geometry). */
export function readPlacement(grid: string[][], placement: Placement): string {
  return cellsFor(placement.row, placement.column, placement.direction, placement.length)
    .map((c) => grid[c.row]?.[c.column] ?? "?")
    .join("")
}
