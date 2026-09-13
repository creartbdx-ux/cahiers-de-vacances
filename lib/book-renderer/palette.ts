import type { CSSProperties } from "react"
import type { Palette } from "@/lib/supabase/types"

/**
 * Palette helpers for the renderer. A palette drives colors ONLY — it is kept
 * completely separate from the graphic style. We expose the five palette slots
 * as CSS custom properties on the page root so every child (titles, frames,
 * badges, decorative shapes, recolorable SVGs) reads the same source of truth
 * and the whole page recolors instantly when the palette changes.
 *
 * Slot -> palette column mapping (identical to the SVG technical convention):
 *   PRIMARY   -> primary_color
 *   SECONDARY -> secondary_color
 *   ACCENT    -> accent_color
 *   DARK      -> text_color
 *   LIGHT     -> background_color
 */
export const BOOK_COLOR_VARS = {
  primary: "--book-primary",
  secondary: "--book-secondary",
  accent: "--book-accent",
  dark: "--book-dark",
  light: "--book-light",
} as const

export function paletteToVars(palette: Palette): CSSProperties {
  return {
    [BOOK_COLOR_VARS.primary]: palette.primary_color,
    [BOOK_COLOR_VARS.secondary]: palette.secondary_color,
    [BOOK_COLOR_VARS.accent]: palette.accent_color,
    [BOOK_COLOR_VARS.dark]: palette.text_color,
    [BOOK_COLOR_VARS.light]: palette.background_color,
  } as CSSProperties
}

/** Shorthand for referencing a book color var in inline styles. */
export const bookColor = {
  primary: "var(--book-primary)",
  secondary: "var(--book-secondary)",
  accent: "var(--book-accent)",
  dark: "var(--book-dark)",
  light: "var(--book-light)",
} as const
