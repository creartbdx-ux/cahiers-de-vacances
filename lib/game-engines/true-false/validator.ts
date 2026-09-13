import type { TrueFalseStatement, TrueFalseStatementInput, TrueFalseValidation } from "./types"

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Independently validate true/false statements. Does not invent content.
 */
export function validateTrueFalseStatements(inputs: TrueFalseStatementInput[]): {
  statements: TrueFalseStatement[]
  validation: TrueFalseValidation
} {
  const errors: string[] = []
  const statements: TrueFalseStatement[] = []
  const seen = new Set<string>()

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return {
      statements: [],
      validation: { ok: false, errors: ["Aucune affirmation fournie."] },
    }
  }

  inputs.forEach((raw, i) => {
    const n = i + 1
    const statement = (raw?.statement ?? "").trim()
    if (!statement) {
      errors.push(`Affirmation ${n}: énoncé vide.`)
      return
    }

    if (typeof raw.correctAnswer !== "boolean") {
      errors.push(`Affirmation ${n}: correctAnswer obligatoire (boolean).`)
      return
    }

    const key = normalizeKey(statement)
    if (seen.has(key)) {
      errors.push(`Affirmation ${n}: doublon de « ${statement} ».`)
      return
    }
    seen.add(key)

    const explanation = raw.explanation?.trim()
    statements.push({
      index: statements.length,
      statement,
      correctAnswer: raw.correctAnswer,
      ...(explanation ? { explanation } : {}),
    })
  })

  return {
    statements,
    validation: { ok: errors.length === 0 && statements.length > 0, errors },
  }
}
