import { COLOR_SLOTS, TECHNICAL_COLORS, TECHNICAL_HEX_TO_SLOT, type ColorSlot } from "@/lib/svg/colors"

export interface SvgCheck {
  id: string
  label: string
  ok: boolean
  detail?: string
}

export interface SvgAnalysis {
  /** No blocking security/format error. */
  ok: boolean
  /** ok AND (non-recolorable OR every color maps to a technical slot). */
  canValidate: boolean
  hasSvgElement: boolean
  colorsUsed: string[]
  colorSlots: ColorSlot[]
  unknownColors: string[]
  errors: string[]
  warnings: string[]
  checks: SvgCheck[]
}

const IGNORED_COLORS = new Set([
  "none",
  "transparent",
  "currentcolor",
  "inherit",
  "context-fill",
  "context-stroke",
])

/** Normalize a raw color token to an uppercase #RRGGBB, or null if not a solid color. */
export function normalizeColor(raw: string): string | null {
  let c = raw.trim().toLowerCase()
  if (!c || IGNORED_COLORS.has(c)) return null

  if (c.startsWith("#")) {
    const hex = c.slice(1)
    if (/^[0-9a-f]{3}$/.test(hex)) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase()
    }
    if (/^[0-9a-f]{4}$/.test(hex)) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase()
    }
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`.toUpperCase()
    if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`.toUpperCase()
    return null
  }

  const rgb = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
  if (rgb) {
    const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
    return `#${toHex(Number(rgb[1]))}${toHex(Number(rgb[2]))}${toHex(Number(rgb[3]))}`.toUpperCase()
  }

  // Named color (e.g. "red", "white"). Keep as-is; treated as unknown for recolorable assets.
  if (/^[a-z]+$/.test(c)) return c
  return null
}

/** Collect every solid color referenced by fill/stroke/stop-color/style. */
export function extractColors(svg: string): string[] {
  const found = new Set<string>()
  const re =
    /(?:fill|stroke|stop-color|flood-color|lighting-color)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(svg))) {
    const norm = normalizeColor(m[1])
    if (norm) found.add(norm)
  }
  return [...found]
}

export function analyzeSvg(rawSvg: string, recolorable: boolean): SvgAnalysis {
  const svg = rawSvg ?? ""
  const errors: string[] = []
  const warnings: string[] = []

  const hasSvgElement = /<svg[\s>]/i.test(svg)
  const hasScript = /<script[\s>]/i.test(svg) || /\son[a-z]+\s*=/i.test(svg)
  const hasImageEl = /<image[\s>]/i.test(svg)
  const hasBitmapData = /data:image\//i.test(svg) || /;base64,/i.test(svg)
  const hasForeignObject = /<foreignObject[\s>]/i.test(svg)
  const hasExternalRef =
    /(?:xlink:href|href)\s*=\s*["']\s*https?:/i.test(svg) || /url\(\s*["']?\s*https?:/i.test(svg)

  if (!hasSvgElement) errors.push("Le fichier ne contient pas d'élément <svg> valide.")
  if (hasScript) errors.push("Le fichier contient un script ou un gestionnaire d'événement.")
  if (hasImageEl || hasBitmapData) errors.push("Le fichier contient une image bitmap intégrée (interdit).")
  if (hasForeignObject) errors.push("Le fichier contient un <foreignObject> (interdit).")
  if (hasExternalRef) errors.push("Le fichier référence une ressource externe (interdit).")

  const colorsUsed = extractColors(svg)
  const technicalHexes = COLOR_SLOTS.map((s) => TECHNICAL_COLORS[s].toUpperCase())
  const colorSlots = COLOR_SLOTS.filter((s) => colorsUsed.includes(TECHNICAL_COLORS[s].toUpperCase()))
  const unknownColors = colorsUsed.filter((c) => !technicalHexes.includes(c))

  // Opaque full-canvas background heuristic (warning only).
  const opaqueBackground = /<rect[^>]*\bwidth\s*=\s*["']100%["'][^>]*\bheight\s*=\s*["']100%["'][^>]*>/i.test(svg)
  const bgTransparent = !opaqueBackground

  if (recolorable && unknownColors.length > 0) {
    warnings.push(
      `Couleurs hors convention détectées : ${unknownColors.join(", ")}. Corrigez le SVG avant validation.`,
    )
  }
  if (!bgTransparent) {
    warnings.push("Un fond plein occupe toute la zone : préférez un fond transparent.")
  }

  const checks: SvgCheck[] = [
    { id: "svg", label: "Élément <svg> valide", ok: hasSvgElement },
    { id: "script", label: "Aucun script ni gestionnaire d'événement", ok: !hasScript },
    { id: "bitmap", label: "Aucune image bitmap / base64", ok: !hasImageEl && !hasBitmapData },
    { id: "external", label: "Aucune ressource externe", ok: !hasExternalRef && !hasForeignObject },
    { id: "background", label: "Fond transparent", ok: bgTransparent },
  ]
  if (recolorable) {
    checks.push({
      id: "colors",
      label: "Couleurs conformes aux 5 slots techniques",
      ok: unknownColors.length === 0,
      detail: unknownColors.length > 0 ? unknownColors.join(", ") : undefined,
    })
  }

  const ok = errors.length === 0
  const canValidate = ok && hasSvgElement && (!recolorable || unknownColors.length === 0)

  return { ok, canValidate, hasSvgElement, colorsUsed, colorSlots, unknownColors, errors, warnings, checks }
}
