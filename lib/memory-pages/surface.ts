import type { Palette } from "@/lib/supabase/types"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { MiniBookPageSurface } from "@/lib/mini-book/page-colors"

/**
 * Memory pages prefer LIGHT / SECONDARY / ACCENT — not always the same wash.
 */
export function resolveMemoryPageSurface(
  palette: Palette,
  visualRole: VisualRole = "LIGHT",
): MiniBookPageSurface {
  const p = palette.primary_color
  const s = palette.secondary_color
  const a = palette.accent_color
  const light = palette.background_color

  switch (visualRole) {
    case "PRIMARY":
      return {
        background: mix(p, light, 0.1),
        panel: mix(p, light, 0.16),
        band: p,
      }
    case "SECONDARY":
      return {
        background: mix(s, light, 0.12),
        panel: mix(s, light, 0.2),
        band: s,
      }
    case "ACCENT":
      return {
        background: mix(a, light, 0.1),
        panel: mix(a, light, 0.18),
        band: a,
      }
    case "NEUTRAL":
      return {
        background: light,
        panel: mix(s, light, 0.06),
        band: s,
      }
    case "LIGHT":
    default:
      return {
        background: mix(s, light, 0.05),
        panel: mix(a, light, 0.08),
        band: s,
      }
  }
}

function mix(fg: string, bg: string, weight: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, weight)) * 100)
  return `color-mix(in srgb, ${fg} ${pct}%, ${bg})`
}
