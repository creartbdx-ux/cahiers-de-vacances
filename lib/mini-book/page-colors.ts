import type { Palette } from "@/lib/supabase/types"
import type { MiniBookPageKind } from "./types"

export type MiniBookPageSurface = {
  /** Page background (overrides --book-light surface). */
  background: string
  /** Soft panel / card wash. */
  panel: string
  /** Header accent for badges / rules. */
  band: string
}

/**
 * Distribute palette colors across mini-book pages — deterministic, elegant, not flashy.
 * Same palette id for the whole book; different mixes per page role.
 */
export function resolveMiniBookPageColors(
  palette: Palette,
  colorKey: MiniBookPageKind,
): MiniBookPageSurface {
  const p = palette.primary_color
  const s = palette.secondary_color
  const a = palette.accent_color
  const light = palette.background_color

  switch (colorKey) {
    case "COVER":
      return {
        background: mix(p, light, 0.14),
        panel: mix(s, light, 0.18),
        band: p,
      }
    case "QUIZ":
      return {
        background: mix(s, light, 0.12),
        panel: mix(s, light, 0.2),
        band: s,
      }
    case "WORDSEARCH":
      return {
        background: mix(a, light, 0.1),
        panel: mix(a, light, 0.16),
        band: a,
      }
    case "CROSSWORD":
      return {
        background: light,
        panel: mix(p, light, 0.06),
        band: p,
      }
    case "QUIZ_CORRECTION":
      return {
        background: mix(p, light, 0.06),
        panel: mix(p, light, 0.1),
        band: p,
      }
    case "LETTERS_CORRECTION":
      return {
        background: mix(s, light, 0.07),
        panel: mix(a, light, 0.1),
        band: s,
      }
    default:
      return { background: light, panel: light, band: p }
  }
}

/** Mix foreground into background by weight (0 = all bg, 1 = all fg). Approximate via CSS color-mix string. */
function mix(fg: string, bg: string, weight: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, weight)) * 100)
  return `color-mix(in srgb, ${fg} ${pct}%, ${bg})`
}
