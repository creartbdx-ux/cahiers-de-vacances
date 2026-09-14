import type { GeneratedQuizPersonalQuestion } from "./types"
import type { QuizPersonalSourceContext } from "../types"

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Significant tokens from an answer (skip tiny words). */
export function significantAnswerTokens(answer: string): string[] {
  return normalize(answer)
    .split(" ")
    .filter((t) => t.length >= 4)
}

/**
 * True when the correct choice is essentially spoiled by the question wording
 * (e.g. "expérience japonaise" → "Japon").
 */
export function questionLeaksCorrectAnswer(
  question: string,
  correctChoice: string,
): boolean {
  const q = normalize(question)
  const tokens = significantAnswerTokens(correctChoice)
  if (!tokens.length) {
    const short = normalize(correctChoice)
    return short.length >= 3 && q.includes(short)
  }
  // All significant tokens of the answer appear in the question
  if (tokens.every((t) => q.includes(t))) return true
  // Long answer substring (≥5) appears in question
  const ans = normalize(correctChoice)
  if (ans.length >= 5 && q.includes(ans)) return true
  return false
}

const DIRECT_PREFERENCE_RE =
  /\b(quelle?|quel|quels|quelles)\b.{0,40}\b(couleur|s[eé]rie|chanteur|artiste|musique|plat|nourriture|boisson|film|livre)\b.{0,40}\b(pr[eé]f[eé]r[eé]e?|favori|favorite)\b/i

const PREFERENCE_OF_NAME_RE =
  /\b(couleur|s[eé]rie|chanteur|artiste|musique|plat|nourriture|boisson|film|livre)\b.{0,30}\b(pr[eé]f[eé]r[eé]e?|favori|favorite)\b.{0,20}\b(de|d'|du)\b/i

/**
 * School-like / form-field question about a preference — weak for a holiday book.
 */
export function isDirectPreferenceInterrogation(question: string): boolean {
  const q = question.trim()
  if (DIRECT_PREFERENCE_RE.test(q)) return true
  if (PREFERENCE_OF_NAME_RE.test(q)) return true
  if (
    /\bquelle est (la|le|l')\b.{0,20}\b(couleur|s[eé]rie|artiste|chanteur|plat)\b/i.test(q)
  ) {
    return true
  }
  return false
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * OTHER_PERSON / ME: talking about the reader in 3rd person by first name
 * ("Quelle série Emma…") is usually the wrong perspective.
 */
export function usesTargetNameInThirdPerson(
  question: string,
  targetNames: string[],
): boolean {
  const q = question.trim()
  for (const name of targetNames) {
    const n = name.trim()
    if (n.length < 2) continue
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i")
    if (!re.test(q)) continue
    // Direct address / possessive with name is rarer; flag classic 3rd-person quiz tone
    if (
      new RegExp(
        `\\b(quelle?|quel|quels|quelles|comment|quand|o[uù]|dans quelle)\\b.{0,60}\\b${escapeRegExp(n)}\\b`,
        "i",
      ).test(q)
    ) {
      return true
    }
    if (
      new RegExp(`\\b${escapeRegExp(n)}\\b.{0,40}\\b(a-t-elle|a-t-il|pourrait-elle|pourrait-il|aime|adore)\\b`, "i").test(
        q,
      )
    ) {
      return true
    }
  }
  return false
}

/**
 * Editorial quality checks (independent of LLM). Fact validity is checked elsewhere.
 */
export function collectEditorialQualityErrors(
  questions: GeneratedQuizPersonalQuestion[],
  context: QuizPersonalSourceContext,
): string[] {
  const errors: string[] = []
  const audience = context.audience
  const targetNames = context.targetParticipantNames
  let thirdPersonHits = 0

  questions.forEach((q, i) => {
    const n = i + 1
    const correct = q.choices[q.correctIndex] ?? ""

    if (questionLeaksCorrectAnswer(q.question, correct)) {
      errors.push(
        `Question ${n}: la bonne réponse est trop clairement révélée dans l'énoncé.`,
      )
    }

    if (isDirectPreferenceInterrogation(q.question)) {
      errors.push(
        `Question ${n}: formulation trop directe / administrative sur une préférence. Preférer une mise en situation ludique.`,
      )
    }

    if (
      (audience === "OTHER_PERSON" || audience === "ME") &&
      usesTargetNameInThirdPerson(q.question, targetNames)
    ) {
      thirdPersonHits += 1
      errors.push(
        `Question ${n}: perspective incorrecte — éviter de parler du lecteur à la 3e personne (${targetNames.join(", ")}).`,
      )
    }
  })

  // Soft aggregate: if MOST questions use the name in 3rd person, already covered per-question
  if (audience === "OTHER_PERSON" && thirdPersonHits >= Math.max(2, Math.ceil(questions.length / 2))) {
    errors.push(
      "Trop de questions à la 3e personne sur le destinataire : le quiz est lu PAR cette personne.",
    )
  }

  return errors
}
