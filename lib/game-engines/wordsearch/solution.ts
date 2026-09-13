import { cellKey } from "./geometry"
import type { Coord, Placement } from "./types"

/**
 * Cells that belong to at least one placed word. Game and correction share
 * the exact same filled grid; only this highlight set changes the view.
 */
export function wordCellKeySet(placements: Placement[]): Set<string> {
  const set = new Set<string>()
  for (const p of placements) {
    for (const c of p.cells) set.add(cellKey(c.row, c.column))
  }
  return set
}

export function uniqueWordCells(placements: Placement[]): Coord[] {
  const seen = new Set<string>()
  const out: Coord[] = []
  for (const p of placements) {
    for (const c of p.cells) {
      const k = cellKey(c.row, c.column)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(c)
    }
  }
  return out
}

/** Player view: every letter visible, no highlight. */
export function isWordHighlight(mode: "game" | "solution"): boolean {
  return mode === "solution"
}

export function isHighlightedCell(
  wordCells: Set<string>,
  row: number,
  column: number,
  mode: "game" | "solution",
): boolean {
  return isWordHighlight(mode) && wordCells.has(cellKey(row, column))
}
