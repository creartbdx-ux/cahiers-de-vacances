import { bookColor } from "@/lib/book-renderer/palette"
import { isWordHighlight } from "@/lib/game-engines/wordsearch/solution"
import type { Placement } from "@/lib/game-engines/wordsearch/types"

/**
 * Presentational word-search grid. Unit SVG cells stay square regardless of
 * style. Correction draws continuous highlight strokes along placed words.
 */
export function WordsearchGrid({
  grid,
  placements,
  mode,
}: {
  grid: string[][]
  placements: Placement[]
  mode: "game" | "solution"
}) {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  if (width === 0 || height === 0) return null

  const showHighlights = isWordHighlight(mode)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={mode === "solution" ? "Grille solution" : "Grille de mots mêlés"}
      style={{ width: "100%", height: "100%", maxHeight: "100%", display: "block" }}
    >
      {grid.flatMap((row, r) =>
        row.map((_, c) => (
          <rect
            key={`cell-${r}-${c}`}
            x={c}
            y={r}
            width={1}
            height={1}
            fill={bookColor.light}
            stroke={bookColor.dark}
            strokeWidth={0.04}
          />
        )),
      )}

      {showHighlights &&
        placements.map((p) => {
          const first = p.cells[0]
          const last = p.cells[p.cells.length - 1]
          if (!first || !last) return null
          return (
            <line
              key={`hl-${p.normalizedWord}-${p.row}-${p.column}-${p.direction}`}
              x1={first.column + 0.5}
              y1={first.row + 0.5}
              x2={last.column + 0.5}
              y2={last.row + 0.5}
              stroke="color-mix(in srgb, var(--book-accent) 48%, transparent)"
              strokeWidth={0.72}
              strokeLinecap="round"
            />
          )
        })}

      {grid.flatMap((row, r) =>
        row.map((letter, c) => (
          <text
            key={`letter-${r}-${c}`}
            x={c + 0.5}
            y={r + 0.72}
            fontSize={0.58}
            textAnchor="middle"
            fill={bookColor.dark}
            style={{ fontFamily: "var(--font-sans, sans-serif)", fontWeight: 700 }}
          >
            {letter}
          </text>
        )),
      )}
    </svg>
  )
}
