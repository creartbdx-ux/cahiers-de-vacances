import { bookColor } from "@/lib/book-renderer/palette"
import { isHighlightedCell, wordCellKeySet } from "@/lib/game-engines/wordsearch/solution"
import type { Placement } from "@/lib/game-engines/wordsearch/types"

/**
 * Presentational word-search grid. Unit SVG cells stay square regardless of
 * style. Every letter is always visible; correction only highlights cells that
 * belong to a placed word — same geometry, never a regenerated grid.
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

  const wordCells = wordCellKeySet(placements)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={mode === "solution" ? "Grille solution" : "Grille de mots mêlés"}
      style={{ width: "100%", height: "100%", maxHeight: "100%", display: "block" }}
    >
      {grid.flatMap((row, r) =>
        row.map((letter, c) => {
          const highlighted = isHighlightedCell(wordCells, r, c, mode)
          return (
            <g key={`${r}-${c}`}>
              <rect
                x={c}
                y={r}
                width={1}
                height={1}
                fill={
                  highlighted
                    ? "color-mix(in srgb, var(--book-accent) 38%, var(--book-light))"
                    : bookColor.light
                }
                stroke={bookColor.dark}
                strokeWidth={0.04}
              />
              <text
                x={c + 0.5}
                y={r + 0.72}
                fontSize={0.58}
                textAnchor="middle"
                fill={bookColor.dark}
                style={{ fontFamily: "var(--font-sans, sans-serif)", fontWeight: 700 }}
              >
                {letter}
              </text>
            </g>
          )
        }),
      )}
    </svg>
  )
}
