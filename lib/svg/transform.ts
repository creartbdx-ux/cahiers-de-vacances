import { paletteColorMap } from "@/lib/svg/colors"
import type { Palette } from "@/lib/supabase/types"

/**
 * Defensive sanitizer applied to every SVG before it is rendered in the
 * browser. Uploads are also analyzed, but DRAFT files may still contain unsafe
 * nodes, so we always strip scripts, bitmaps, external refs and event handlers
 * at render time.
 */
export function sanitizeSvg(rawSvg: string): string {
  if (!rawSvg) return ""
  let out = rawSvg
  out = out.replace(/<\?xml[\s\S]*?\?>/gi, "")
  out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, "")
  out = out.replace(/<!--[\s\S]*?-->/g, "")
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "")
  out = out.replace(/<script[\s\S]*?\/>/gi, "")
  out = out.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
  out = out.replace(/<image[\s\S]*?(?:\/>|<\/image>)/gi, "")
  // Strip inline event handlers (onload, onclick, ...).
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
  // Neutralize dangerous href targets (javascript:, data:, external http).
  out = out.replace(/\s(?:xlink:href|href)\s*=\s*"(?:\s*(?:javascript:|data:|https?:))[^"]*"/gi, "")
  out = out.replace(/\s(?:xlink:href|href)\s*=\s*'(?:\s*(?:javascript:|data:|https?:))[^']*'/gi, "")
  return out.trim()
}

/**
 * Recolor a master SVG by swapping each technical color for the matching
 * palette color. Done as an in-memory string substitution so we keep a single
 * master file and stay fully vectorial. Always sanitizes first.
 */
export function recolorSvg(rawSvg: string, palette: Palette): string {
  const svg = sanitizeSvg(rawSvg)
  const map = paletteColorMap(palette)
  return svg.replace(/#[0-9a-fA-F]{6}/g, (match) => {
    const upper = match.toUpperCase()
    return map[upper] ?? match
  })
}
