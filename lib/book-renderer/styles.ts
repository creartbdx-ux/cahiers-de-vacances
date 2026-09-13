/**
 * Style registry. A style defines the GRAPHIC LANGUAGE — typography, borders,
 * radii, badges, decorative density and small shapes — and NEVER the colors.
 * Colors always come from the palette (via CSS vars), so any style works with
 * any palette. Tokens expose structure/typography classes and numeric shape
 * metrics; components apply palette colors on top through inline vars.
 */
export interface BookStyleTokens {
  id: string
  label: string
  titleClassName: string
  gameLabelClassName: string
  instructionClassName: string
  clueHeadingClassName: string
  clueNumberClassName: string
  /** px */
  frameRadius: number
  /** px */
  frameBorderWidth: number
  /** px */
  badgeRadius: number
  decorDensity: "low" | "medium" | "high"
}

const RETRO: BookStyleTokens = {
  id: "RETRO",
  label: "Rétro",
  titleClassName: "font-serif font-black uppercase tracking-tight leading-[0.95]",
  gameLabelClassName: "font-serif font-bold uppercase tracking-[0.25em]",
  instructionClassName: "font-sans italic leading-relaxed",
  clueHeadingClassName: "font-serif font-bold uppercase tracking-[0.15em]",
  clueNumberClassName: "font-serif font-black",
  frameRadius: 18,
  frameBorderWidth: 3,
  badgeRadius: 999,
  decorDensity: "high",
}

/** Neutral fallback so any Supabase style still renders before it is designed. */
const DEFAULT_STYLE: BookStyleTokens = {
  id: "DEFAULT",
  label: "Standard",
  titleClassName: "font-sans font-bold tracking-tight leading-tight",
  gameLabelClassName: "font-sans font-semibold uppercase tracking-widest",
  instructionClassName: "font-sans leading-relaxed",
  clueHeadingClassName: "font-sans font-semibold uppercase tracking-wide",
  clueNumberClassName: "font-sans font-bold",
  frameRadius: 8,
  frameBorderWidth: 2,
  badgeRadius: 8,
  decorDensity: "low",
}

const STYLE_TOKENS: Record<string, BookStyleTokens> = {
  RETRO,
}

export function getStyleTokens(styleId: string | null | undefined): BookStyleTokens {
  if (!styleId) return DEFAULT_STYLE
  return STYLE_TOKENS[styleId] ?? DEFAULT_STYLE
}
