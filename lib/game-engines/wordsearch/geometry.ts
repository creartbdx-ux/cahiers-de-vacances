import type { Coord, WordSearchDirection } from "./types"

export const ALL_DIRECTIONS: WordSearchDirection[] = ["E", "S", "SE", "NE"]

export const DIRECTION_DELTA: Record<WordSearchDirection, { dr: number; dc: number }> = {
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  SE: { dr: 1, dc: 1 },
  NE: { dr: -1, dc: 1 },
}

export function cellsFor(
  row: number,
  column: number,
  direction: WordSearchDirection,
  length: number,
): Coord[] {
  const { dr, dc } = DIRECTION_DELTA[direction]
  const cells: Coord[] = []
  for (let i = 0; i < length; i++) {
    cells.push({ row: row + dr * i, column: column + dc * i })
  }
  return cells
}

export function inBounds(row: number, column: number, width: number, height: number): boolean {
  return row >= 0 && column >= 0 && row < height && column < width
}

/** Valid start cells so a word of `length` stays inside the grid. */
export function startsFor(
  direction: WordSearchDirection,
  length: number,
  width: number,
  height: number,
): Coord[] {
  const starts: Coord[] = []
  switch (direction) {
    case "E":
      for (let row = 0; row < height; row++) {
        for (let column = 0; column <= width - length; column++) {
          starts.push({ row, column })
        }
      }
      break
    case "S":
      for (let row = 0; row <= height - length; row++) {
        for (let column = 0; column < width; column++) {
          starts.push({ row, column })
        }
      }
      break
    case "SE":
      for (let row = 0; row <= height - length; row++) {
        for (let column = 0; column <= width - length; column++) {
          starts.push({ row, column })
        }
      }
      break
    case "NE":
      for (let row = length - 1; row < height; row++) {
        for (let column = 0; column <= width - length; column++) {
          starts.push({ row, column })
        }
      }
      break
  }
  return starts
}

export function cellKey(row: number, column: number): string {
  return `${row},${column}`
}

export function emptyGrid(width: number, height: number): (string | null)[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null))
}

export function cloneGrid(grid: (string | null)[][]): (string | null)[][] {
  return grid.map((row) => row.slice())
}
