/** Internal editorial statement shapes for TRUE_FALSE_THEME (not shown to players). */

export const TRUE_FALSE_THEME_STATEMENT_STYLES = [
  "FACT",
  "ORIGIN_HISTORY",
  "VOCABULARY",
  "COMPARISON",
  "SURPRISING_FACT",
  "FUNCTION",
  "NUMBER_FACT",
  "CLASSIFICATION",
] as const

export type TrueFalseThemeStatementStyle = (typeof TRUE_FALSE_THEME_STATEMENT_STYLES)[number]

export function isTrueFalseThemeStatementStyle(
  value: unknown,
): value is TrueFalseThemeStatementStyle {
  return (
    typeof value === "string" &&
    (TRUE_FALSE_THEME_STATEMENT_STYLES as readonly string[]).includes(value)
  )
}

export const TRUE_FALSE_THEME_STYLE_GUIDANCE: Record<TrueFalseThemeStatementStyle, string> = {
  FACT: "fait général stable du domaine",
  ORIGIN_HISTORY: "origine / histoire d'une pratique, produit ou notion",
  VOCABULARY: "définition ou sens précis d'un terme",
  COMPARISON: "différence entre deux notions proches",
  SURPRISING_FACT: "fait étonnant mais établi (pas d'actualité)",
  FUNCTION: "usage / rôle / fonction",
  NUMBER_FACT: "nombre ou quantité stable — seulement si réellement fiable",
  CLASSIFICATION: "appartient / n'appartient pas à une catégorie",
}

/**
 * Diversity for N statements (V1 calibrated on 8):
 * - at least 4 distinct styles when N >= 8
 * - max 3 of the same style
 * - no two identical styles in a row
 */
export function evaluateStatementStyleDiversity(
  styles: Array<TrueFalseThemeStatementStyle | string>,
): {
  ok: boolean
  errors: string[]
  warnings: string[]
  distinctCount: number
  counts: Record<string, number>
} {
  const errors: string[] = []
  const warnings: string[] = []
  const counts: Record<string, number> = {}

  for (const style of styles) {
    counts[style] = (counts[style] ?? 0) + 1
  }

  const distinctCount = Object.keys(counts).length
  const n = styles.length

  if (n >= 8) {
    if (distinctCount < 4) {
      errors.push(
        `Diversité de formes insuffisante : ${distinctCount} style(s) distinct(s), minimum 4 pour ${n} affirmations.`,
      )
    }
    for (const [style, count] of Object.entries(counts)) {
      if (count > 3) {
        errors.push(`Style ${style} surutilisé (${count}×) — maximum 3 du même statementStyle.`)
      }
    }
  } else if (n >= 4) {
    if (distinctCount < 3) {
      errors.push(`Diversité de formes insuffisante : ${distinctCount} style(s), minimum 3.`)
    }
    for (const [style, count] of Object.entries(counts)) {
      if (count > 3) {
        errors.push(`Style ${style} surutilisé (${count}×).`)
      }
    }
  }

  for (let i = 1; i < styles.length; i++) {
    if (styles[i] === styles[i - 1]) {
      errors.push(
        `Affirmations ${i} et ${i + 1}: même statementStyle (${styles[i]}) consécutif — alternez.`,
      )
    }
  }

  return { ok: errors.length === 0, errors, warnings, distinctCount, counts }
}
