/**
 * Adaptive crossword page layout for print-first readability.
 * Grid readability wins over decorative framing.
 */
export type CrosswordPageLayout = "side-by-side" | "grid-top"

export function resolveCrosswordPageLayout(params: {
  acrossCount: number
  downCount: number
  width: number
  height: number
}): CrosswordPageLayout {
  const clueCount = params.acrossCount + params.downCount
  const area = Math.max(1, params.width) * Math.max(1, params.height)

  // Dense clue lists → grid on top, compact two-column definitions below.
  if (clueCount >= 12) return "grid-top"
  // Sparse puzzles → side-by-side so a small grid isn't lost mid-page.
  if (clueCount <= 8) return "side-by-side"
  // Medium: keep grid dominant when the board itself is compact.
  if (area <= 100) return "side-by-side"
  return "grid-top"
}
