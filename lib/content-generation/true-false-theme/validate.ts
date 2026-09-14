import { topicHitsExcluded } from "@/lib/universes/editorial"
import {
  evaluateStatementStyleDiversity,
  isTrueFalseThemeStatementStyle,
  type TrueFalseThemeStatementStyle,
} from "./styles"
import type { TrueFalseThemeContext } from "./context"
import type {
  GeneratedTrueFalseThemeStatement,
  TrueFalseThemeStatementIssue,
  TrueFalseThemeValidationResult,
} from "./types"

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
}

const TEMPORAL_RE =
  /\b(actuellement|cette ann[eé]e|r[eé]cemment|aujourd.?hui|en 202[0-9]|l.?ann[eé]e derni[eè]re|en ce moment)\b/i

const DOUBLE_NEGATION_RE =
  /\b(il n'?est pas faux|n'?est pas inexact|pas impossible que|ne \w+ pas (?:jamais|rien|aucun))\b/i

const TRIVIAL_RE =
  /\b(le ciel est bleu|l'?eau est humide|le feu est chaud)\b/i

const WEAK_FALSE_EXPLANATION_RE =
  /^(cette affirmation est fausse\.?|c'?est faux\.?|incorrect\.?)$/i

export function looksTemporalOrNewsy(text: string): boolean {
  return TEMPORAL_RE.test(text)
}

export function hasObviousDoubleNegation(text: string): boolean {
  return DOUBLE_NEGATION_RE.test(text)
}

export function topicKeyIsAllowed(topicKey: string, allowedTopics: string[]): boolean {
  if (!allowedTopics.length) return Boolean(topicKey.trim())
  return allowedTopics.includes(topicKey)
}

export function validateTrueFalseThemeStatement(
  s: GeneratedTrueFalseThemeStatement,
  context: TrueFalseThemeContext,
  statementNumber1Based: number,
): string[] {
  const n = statementNumber1Based
  const errors: string[] = []

  if (!s.statement?.trim()) {
    errors.push(`Affirmation ${n}: énoncé vide.`)
    return errors
  }

  if (typeof s.answer !== "boolean") {
    errors.push(`Affirmation ${n}: answer boolean invalide.`)
  }

  if (!s.explanation?.trim()) {
    errors.push(`Affirmation ${n}: explanation obligatoire.`)
  } else if (s.answer === false && WEAK_FALSE_EXPLANATION_RE.test(s.explanation.trim())) {
    errors.push(
      `Affirmation ${n}: explanation trop faible pour un faux — doit rétablir le fait correct.`,
    )
  }

  if (!isTrueFalseThemeStatementStyle(s.statementStyle)) {
    errors.push(
      `Affirmation ${n}: statementStyle invalide (« ${String(s.statementStyle ?? "")} »).`,
    )
  }

  if (!s.topicKey?.trim()) {
    errors.push(`Affirmation ${n}: topicKey manquant.`)
  } else if (!topicKeyIsAllowed(s.topicKey, context.allowedTopics)) {
    errors.push(
      `Affirmation ${n}: topicKey « ${s.topicKey} » hors allowedTopics de l'univers.`,
    )
  }

  if (!s.topicLabel?.trim()) {
    errors.push(`Affirmation ${n}: topicLabel manquant.`)
  }

  const hitExcluded = topicHitsExcluded(
    s.topicLabel || s.topicKey,
    `${s.statement} ${s.explanation} ${s.topicLabel}`,
    context.excludedTopics,
  )
  if (hitExcluded) {
    errors.push(
      `Affirmation ${n}: contenu hors cadre — sujet exclu détecté : ${hitExcluded}.`,
    )
  }

  if (hasObviousDoubleNegation(s.statement)) {
    errors.push(`Affirmation ${n}: double négation / formulation piège détectée.`)
  }

  if (TRIVIAL_RE.test(s.statement)) {
    errors.push(`Affirmation ${n}: formulation trop triviale pour un vrai/faux thématique.`)
  }

  if (context.difficulty >= 3 && s.statement.trim().split(/\s+/).length < 6) {
    errors.push(`Affirmation ${n}: formulation trop triviale pour la difficulté.`)
  }

  const blob = `${s.statement} ${s.explanation}`
  if (looksTemporalOrNewsy(blob)) {
    errors.push(
      `Affirmation ${n}: formulation trop liée à l'actualité — privilégier des faits stables.`,
    )
  }

  return errors
}

/**
 * Independent TRUE_FALSE_THEME validator.
 */
export function validateTrueFalseThemeGeneration(input: {
  title: string
  statements: GeneratedTrueFalseThemeStatement[]
  context: TrueFalseThemeContext
}): TrueFalseThemeValidationResult {
  const { title, statements, context } = input
  const errors: string[] = []
  const warnings: string[] = []
  const statementIssues: TrueFalseThemeStatementIssue[] = []
  const target = context.targetStatements

  if (!title.trim()) {
    errors.push("Titre manquant.")
  }

  if (statements.length !== target) {
    errors.push(`Nombre d'affirmations : reçu ${statements.length}, attendu ${target}.`)
  }

  const seen = new Set<string>()
  const topicKeys = new Map<string, number>()
  const styles: TrueFalseThemeStatementStyle[] = []
  let trueCount = 0
  let falseCount = 0

  statements.forEach((s, i) => {
    const n = i + 1
    const sErrors = validateTrueFalseThemeStatement(s, context, n)

    const key = normalizeKey(s.statement)
    if (s.statement?.trim()) {
      if (seen.has(key)) sErrors.push(`Affirmation ${n}: doublon d'énoncé.`)
      seen.add(key)
    }

    if (s.topicKey?.trim()) {
      const tKey = normalizeKey(s.topicKey)
      topicKeys.set(tKey, (topicKeys.get(tKey) ?? 0) + 1)
    }

    if (isTrueFalseThemeStatementStyle(s.statementStyle)) {
      styles.push(s.statementStyle)
    }

    if (s.answer === true) trueCount++
    else if (s.answer === false) falseCount++

    if (sErrors.length) {
      statementIssues.push({ index: i, errors: sErrors })
      errors.push(...sErrors)
    }
  })

  // Balance true/false — prefer 4/4 for 8; allow 3/5 or 5/3; reject extremes
  if (statements.length === target && target >= 6) {
    const minSide = Math.floor(target / 2) - 1
    const maxSide = Math.ceil(target / 2) + 1
    if (trueCount < minSide || falseCount < minSide || trueCount > maxSide || falseCount > maxSide) {
      errors.push(
        `Équilibre VRAI/FAUX insuffisant : ${trueCount} vraies / ${falseCount} fausses (viser ~${Math.floor(target / 2)}/${Math.ceil(target / 2)}).`,
      )
    }
    if (trueCount === 0 || falseCount === 0) {
      errors.push("Toutes les affirmations ont la même réponse — équilibre VRAI/FAUX requis.")
    }
  }

  const styleDiv = evaluateStatementStyleDiversity(styles)
  if (!styleDiv.ok) errors.push(...styleDiv.errors)
  warnings.push(...styleDiv.warnings)

  if (context.allowedTopics.length >= 4 && statements.length >= 6) {
    if (topicKeys.size < 3) {
      errors.push(
        `Diversité topicKey insuffisante : ${topicKeys.size} distinct(s), minimum 3.`,
      )
    }
    for (const [k, count] of topicKeys) {
      if (count > 4) {
        errors.push(`topicKey « ${k} » surutilisé (${count}×) — maximum 4.`)
      }
    }
  }

  if (errors.length) {
    return { ok: false, errors, warnings, statementIssues }
  }

  return {
    ok: true,
    statements,
    title: title.trim(),
    topics: [...topicKeys.keys()],
    styles,
    styleDistinctCount: styleDiv.distinctCount,
    trueCount,
    falseCount,
    styleDiversityOk: true,
    warnings,
  }
}
