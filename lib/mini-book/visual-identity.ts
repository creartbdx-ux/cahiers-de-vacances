import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { Palette, Style } from "@/lib/supabase/types"
import type { MiniBookVisualIdentity } from "./types"

/** Simple deterministic hash for stable AUTO picks. */
export function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickBySeed<T>(items: T[], seed: string, salt: string): T | null {
  if (!items.length) return null
  const idx = hashSeed(`${seed}:${salt}`) % items.length
  return items[idx]!
}

/**
 * Resolve style + palette once for the whole mini-cahier.
 * AUTO is resolved deterministically from seed — never per-page.
 */
export function resolveBookVisualIdentity(input: {
  profile: BookProfileV1
  seed: string
  styles: Style[]
  palettes: Palette[]
}): MiniBookVisualIdentity {
  const activeStyles = input.styles.filter((s) => s.active)
  const activePalettes = input.palettes.filter((p) => p.active)
  const stylePool = activeStyles.length ? activeStyles : input.styles
  const palettePool = activePalettes.length ? activePalettes : input.palettes

  const prefStyle = input.profile.visualPreferences.styleId
  const prefPalette = input.profile.visualPreferences.paletteId

  let styleFromAuto = false
  let paletteFromAuto = false
  let styleId: string
  let paletteId: string

  if (prefStyle && prefStyle !== "AUTO" && stylePool.some((s) => s.id === prefStyle)) {
    styleId = prefStyle
  } else {
    styleFromAuto = true
    styleId = pickBySeed(stylePool, input.seed, "style")?.id ?? "RETRO"
  }

  if (prefPalette && prefPalette !== "AUTO" && palettePool.some((p) => p.id === prefPalette)) {
    paletteId = prefPalette
  } else {
    paletteFromAuto = true
    paletteId = pickBySeed(palettePool, input.seed, "palette")?.id ?? "ORANGE"
  }

  return {
    styleId,
    paletteId,
    styleFromAuto,
    paletteFromAuto,
  }
}
