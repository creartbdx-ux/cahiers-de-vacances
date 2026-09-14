/** Internal editorial question shapes for QUIZ_THEME (not exposed to the QUIZ engine). */

export const QUIZ_THEME_QUESTION_STYLES = [
  "FUNCTION",
  "IDENTIFICATION",
  "DIFFERENCE",
  "ORIGIN_HISTORY",
  "VOCABULARY",
  "FACT_CURIOSITY",
  "SEQUENCE_USAGE",
  "ASSOCIATION",
] as const

export type QuizThemeQuestionStyle = (typeof QUIZ_THEME_QUESTION_STYLES)[number]

export function isQuizThemeQuestionStyle(value: unknown): value is QuizThemeQuestionStyle {
  return (
    typeof value === "string" &&
    (QUIZ_THEME_QUESTION_STYLES as readonly string[]).includes(value)
  )
}

export const QUIZ_THEME_STYLE_GUIDANCE: Record<QuizThemeQuestionStyle, string> = {
  FUNCTION: "rôle / utilité (« À quoi sert… », « Quel est le rôle de… ») — jamais évident à difficulté ≥ 3",
  IDENTIFICATION: "reconnaître un terme, objet, notion, produit ou référence",
  DIFFERENCE: "distinguer deux concepts proches du même domaine",
  ORIGIN_HISTORY: "origine, histoire ou évolution d'une pratique / produit / notion",
  VOCABULARY: "définition ou sens précis d'un terme du domaine",
  FACT_CURIOSITY: "fait remarquable ou petite curiosité stable (pas d'actualité)",
  SEQUENCE_USAGE: "ordre, moment ou étape d'utilisation / de pratique",
  ASSOCIATION: "associer un concept à un produit, lieu, œuvre, personne ou usage selon l'univers",
}

/**
 * Diversity rules for a quiz of N questions (V1 calibrated on 6).
 * - max 2 of the same style
 * - at least 3 distinct styles when N >= 6
 * - no two identical styles in a row
 */
export function evaluateQuestionStyleDiversity(styles: Array<QuizThemeQuestionStyle | string>): {
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

  if (n >= 6) {
    if (distinctCount < 3) {
      errors.push(
        `Diversité de formes insuffisante : ${distinctCount} style(s) distinct(s), minimum 3 pour ${n} questions.`,
      )
    }
    for (const [style, count] of Object.entries(counts)) {
      if (count > 2) {
        errors.push(
          `Style ${style} surutilisé (${count}×) — maximum 2 questions du même questionStyle.`,
        )
      }
    }
  } else if (n >= 4) {
    const maxAllowed = Math.max(2, Math.ceil(n / 2))
    for (const [style, count] of Object.entries(counts)) {
      if (count > maxAllowed) {
        errors.push(`Style ${style} surutilisé (${count}×).`)
      }
    }
  }

  for (let i = 1; i < styles.length; i++) {
    if (styles[i] === styles[i - 1]) {
      errors.push(
        `Questions ${i} et ${i + 1}: même questionStyle (${styles[i]}) consécutif — alternez les formes.`,
      )
    }
  }

  return { ok: errors.length === 0, errors, warnings, distinctCount, counts }
}
