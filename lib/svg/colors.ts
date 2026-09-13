import type { Palette } from "@/lib/supabase/types"

/**
 * Technical color convention used by the generation engine. Recolorable SVGs
 * must only paint with these five values; the engine swaps each one for the
 * matching palette color at render time.
 */
export const TECHNICAL_COLORS = {
  PRIMARY: "#FF6A00",
  SECONDARY: "#00A7A0",
  ACCENT: "#FFD54A",
  DARK: "#3E2C26",
  LIGHT: "#FFF4E8",
} as const

export type ColorSlot = keyof typeof TECHNICAL_COLORS

/** Deterministic slot order used everywhere we list slots. */
export const COLOR_SLOTS: ColorSlot[] = ["PRIMARY", "SECONDARY", "ACCENT", "DARK", "LIGHT"]

export const SLOT_LABELS: Record<ColorSlot, string> = {
  PRIMARY: "Principale",
  SECONDARY: "Secondaire",
  ACCENT: "Accent",
  DARK: "Foncé",
  LIGHT: "Clair",
}

/** How each technical slot maps onto a palette row's columns. */
export const SLOT_TO_PALETTE_KEY: Record<ColorSlot, keyof Palette> = {
  PRIMARY: "primary_color",
  SECONDARY: "secondary_color",
  ACCENT: "accent_color",
  DARK: "text_color",
  LIGHT: "background_color",
}

/** Normalized (uppercase 6-digit) technical hex -> slot, for quick lookup. */
export const TECHNICAL_HEX_TO_SLOT: Record<string, ColorSlot> = Object.fromEntries(
  COLOR_SLOTS.map((slot) => [TECHNICAL_COLORS[slot].toUpperCase(), slot]),
) as Record<string, ColorSlot>

/**
 * Resolve the concrete color for each technical slot from a palette row.
 * Returns an uppercase-hex keyed map from technical color -> palette color.
 */
export function paletteColorMap(palette: Palette): Record<string, string> {
  const map: Record<string, string> = {}
  for (const slot of COLOR_SLOTS) {
    map[TECHNICAL_COLORS[slot].toUpperCase()] = palette[SLOT_TO_PALETTE_KEY[slot]] as string
  }
  return map
}
