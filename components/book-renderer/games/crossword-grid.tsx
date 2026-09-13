import { bookColor } from "@/lib/book-renderer/palette"
import type { CrosswordCell } from "@/lib/game-engines/crossword/types"

/**
 * Presentational crossword grid. Rendered as an SVG on a unit grid (1 unit =
 * 1 cell) so cells stay perfectly square and the whole grid scales cleanly to
 * whatever space it is given — independent of the graphic style.
 *
 * Colors: letters, numbers and cell borders use DARK; everything else comes
 * from the palette. In "game" mode the solution letters are never rendered.
 */
export function CrosswordGrid({
  cells,
  mode,
}: {
  cells: CrosswordCell[][]
  mode: "game" | "solution"
}) {
  const height = cells.length
  const width = cells[0]?.length ?? 0
  if (width === 0 || height === 0) return null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={mode === "solution" ? "Grille solution" : "Grille de mots croisés"}
      style={{ width: "100%", height: "100%", maxHeight: "100%", display: "block" }}
    >
      {cells.flat().map((cell) => {
        if (cell.block) return null
        const x = cell.column
        const y = cell.row
        return (
          <g key={`${cell.row}-${cell.column}`}>
            <rect
              x={x}
              y={y}
              width={1}
              height={1}
              fill={bookColor.light}
              stroke={bookColor.dark}
              strokeWidth={0.045}
            />
            {cell.number !== null && (
              <text
                x={x + 0.08}
                y={y + 0.32}
                fontSize={0.26}
                fill={bookColor.dark}
                style={{ fontFamily: "var(--font-sans, sans-serif)", fontWeight: 700 }}
              >
                {cell.number}
              </text>
            )}
            {mode === "solution" && cell.solution && (
              <text
                x={x + 0.5}
                y={y + 0.74}
                fontSize={0.6}
                textAnchor="middle"
                fill={bookColor.dark}
                style={{ fontFamily: "var(--font-sans, sans-serif)", fontWeight: 700 }}
              >
                {cell.solution}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
