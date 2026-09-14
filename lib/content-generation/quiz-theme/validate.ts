import { topicHitsExcluded } from "@/lib/universes/editorial"
import { choicesAreSufficientlyDistinct } from "../validators"
import { questionLeaksCorrectAnswer } from "../quiz-personal/quality"
import { QUIZ_THEME_CHOICE_COUNT } from "./schema"
import {
  evaluateQuestionStyleDiversity,
  isQuizThemeQuestionStyle,
  type QuizThemeQuestionStyle,
} from "./styles"
import type { QuizThemeContext } from "./context"
import type {
  GeneratedQuizThemeQuestion,
  QuizThemeQuestionIssue,
  QuizThemeValidationResult,
} from "./types"

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
}

const TRIVIAL_THEME_RE =
  /\b(quelle couleur|quel animal vit|associ[ée]e?\s+(à|a)\s+la\s+nature|dans la for[eê]t)\b/i

const TEMPORAL_RE =
  /\b(actuellement|cette ann[eé]e|r[eé]cemment|aujourd.?hui|en 202[0-9]|l.?ann[eé]e derni[eè]re|en ce moment)\b/i

export function isTrivialThemeQuestion(question: string): boolean {
  return TRIVIAL_THEME_RE.test(question.trim())
}

export function looksTemporalOrNewsy(text: string): boolean {
  return TEMPORAL_RE.test(text)
}

/** Exact membership in allowedTopics when the list is non-empty. */
export function topicKeyIsAllowed(topicKey: string, allowedTopics: string[]): boolean {
  if (!allowedTopics.length) return Boolean(topicKey.trim())
  return allowedTopics.includes(topicKey)
}

/**
 * Validate a single question (structural + thematic). Returns error strings.
 */
export function validateQuizThemeQuestion(
  q: GeneratedQuizThemeQuestion,
  context: QuizThemeContext,
  questionNumber1Based: number,
): string[] {
  const n = questionNumber1Based
  const errors: string[] = []

  if (!q.question?.trim()) {
    errors.push(`Question ${n}: énoncé vide.`)
    return errors
  }

  if (!isQuizThemeQuestionStyle(q.questionStyle)) {
    errors.push(
      `Question ${n}: questionStyle invalide ou manquant (« ${String(q.questionStyle ?? "")} »).`,
    )
  }

  if (!Array.isArray(q.choices) || q.choices.length !== QUIZ_THEME_CHOICE_COUNT) {
    errors.push(
      `Question ${n}: exactement ${QUIZ_THEME_CHOICE_COUNT} choix requis (reçu ${q.choices?.length ?? 0}).`,
    )
  } else {
    if (q.choices.some((c) => !c?.trim())) {
      errors.push(`Question ${n}: un choix est vide.`)
    }
    if (!choicesAreSufficientlyDistinct(q.choices)) {
      errors.push(`Question ${n}: choix dupliqués ou trop similaires.`)
    }
  }

  if (
    !Number.isInteger(q.correctIndex) ||
    q.correctIndex < 0 ||
    q.correctIndex > 3
  ) {
    errors.push(`Question ${n}: correctIndex invalide.`)
  }

  if (!q.explanation?.trim()) {
    errors.push(`Question ${n}: explanation obligatoire.`)
  }

  if (!q.topicKey?.trim()) {
    errors.push(`Question ${n}: topicKey manquant.`)
  } else if (!topicKeyIsAllowed(q.topicKey, context.allowedTopics)) {
    errors.push(
      `Question ${n}: topicKey « ${q.topicKey} » hors allowedTopics de l'univers.`,
    )
  }

  if (!q.topicLabel?.trim()) {
    errors.push(`Question ${n}: topicLabel manquant.`)
  }

  const hitExcluded = topicHitsExcluded(
    q.topicLabel || q.topicKey,
    `${q.question} ${q.explanation} ${q.topicLabel}`,
    context.excludedTopics,
  )
  if (hitExcluded) {
    errors.push(
      `Question ${n}: contenu hors cadre — sujet exclu détecté : ${hitExcluded}.`,
    )
  }

  const correct = q.choices[q.correctIndex] ?? ""
  if (q.choices.length === QUIZ_THEME_CHOICE_COUNT && questionLeaksCorrectAnswer(q.question, correct)) {
    errors.push(
      `Question ${n}: la bonne réponse est trop clairement révélée dans l'énoncé.`,
    )
  }

  if (isTrivialThemeQuestion(q.question)) {
    errors.push(`Question ${n}: formulation trop triviale pour un quiz thématique.`)
  }

  const blob = `${q.question} ${q.explanation}`
  if (looksTemporalOrNewsy(blob)) {
    errors.push(
      `Question ${n}: formulation trop liée à l'actualité / au temps présent — privilégier des faits stables.`,
    )
  }

  return errors
}

/**
 * Independent QUIZ_THEME validator — topicKey exact + style diversity + quality.
 */
export function validateQuizThemeGeneration(input: {
  title: string
  questions: GeneratedQuizThemeQuestion[]
  context: QuizThemeContext
}): QuizThemeValidationResult {
  const { title, questions, context } = input
  const errors: string[] = []
  const warnings: string[] = []
  const questionIssues: QuizThemeQuestionIssue[] = []
  const target = context.targetQuestions

  if (!title.trim()) {
    errors.push("Titre du quiz manquant.")
  }

  if (questions.length !== target) {
    errors.push(`Nombre de questions : reçu ${questions.length}, attendu ${target}.`)
  }

  const seenQuestions = new Set<string>()
  const topicKeys = new Map<string, number>()
  const styles: QuizThemeQuestionStyle[] = []

  questions.forEach((q, i) => {
    const n = i + 1
    const qErrors = validateQuizThemeQuestion(q, context, n)

    const qKey = normalizeKey(q.question)
    if (q.question?.trim()) {
      if (seenQuestions.has(qKey)) {
        qErrors.push(`Question ${n}: doublon d'énoncé.`)
      }
      seenQuestions.add(qKey)
    }

    if (q.topicKey?.trim()) {
      const tKey = normalizeKey(q.topicKey)
      topicKeys.set(tKey, (topicKeys.get(tKey) ?? 0) + 1)
    }

    if (isQuizThemeQuestionStyle(q.questionStyle)) {
      styles.push(q.questionStyle)
    }

    if (qErrors.length) {
      questionIssues.push({ index: i, errors: qErrors })
      errors.push(...qErrors)
    }
  })

  // topicKey diversity (canonical keys)
  if (questions.length >= 4) {
    const distinct = topicKeys.size
    const minDistinct = Math.max(3, Math.ceil(questions.length / 2))
    if (distinct < minDistinct) {
      errors.push(
        `Diversité insuffisante des topicKeys (${distinct} distincts, minimum ${minDistinct}).`,
      )
    }
    for (const [topic, count] of topicKeys) {
      if (count > Math.ceil(questions.length / 2)) {
        errors.push(`topicKey « ${topic} » sur-représenté (${count} questions).`)
        // Attribute to questions using that key (for targeted repair)
        questions.forEach((q, i) => {
          if (normalizeKey(q.topicKey) === topic) {
            const existing = questionIssues.find((qi) => qi.index === i)
            const msg = `Question ${i + 1}: topicKey « ${q.topicKey} » sur-représenté dans le quiz.`
            if (existing) {
              if (!existing.errors.includes(msg)) existing.errors.push(msg)
            } else {
              questionIssues.push({ index: i, errors: [msg] })
            }
          }
        })
      }
    }
  }

  // Form / questionStyle diversity
  if (styles.length === questions.length && questions.length > 0) {
    const styleEval = evaluateQuestionStyleDiversity(styles)
    for (const e of styleEval.errors) {
      errors.push(e)
      // Attribute consecutive / overused styles to question indexes
      if (/consécutif/i.test(e)) {
        const m = e.match(/Questions (\d+) et (\d+)/i)
        if (m) {
          for (const num of [Number(m[1]), Number(m[2])]) {
            const idx = num - 1
            const msg = e
            const existing = questionIssues.find((qi) => qi.index === idx)
            if (existing) {
              if (!existing.errors.includes(msg)) existing.errors.push(msg)
            } else {
              questionIssues.push({ index: idx, errors: [msg] })
            }
          }
        }
      } else if (/surutilisé/i.test(e)) {
        const m = e.match(/Style (\w+) surutilisé/i)
        const style = m?.[1]
        if (style) {
          questions.forEach((q, i) => {
            if (q.questionStyle === style) {
              const msg = e
              const existing = questionIssues.find((qi) => qi.index === i)
              if (existing) {
                if (!existing.errors.includes(msg)) existing.errors.push(msg)
              } else {
                questionIssues.push({ index: i, errors: [msg] })
              }
            }
          })
        }
      } else if (/formes insuffisante/i.test(e)) {
        // Attribute to all — repair may need several replacements; mark none-specific
        // by leaving as global only (questionIssues may stay empty for this alone)
      }
    }
    warnings.push(...styleEval.warnings)
  }

  if (errors.length) {
    return { ok: false, errors, warnings, questionIssues }
  }

  const styleEval = evaluateQuestionStyleDiversity(styles)
  return {
    ok: true,
    questions,
    title: title.trim(),
    topics: [...topicKeys.keys()],
    styles,
    styleDistinctCount: styleEval.distinctCount,
    styleDiversityOk: true,
    warnings,
  }
}
