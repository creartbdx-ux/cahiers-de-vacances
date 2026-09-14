import {
  topicHitsExcluded,
  topicMatchesAllowed,
} from "@/lib/universes/editorial"
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

/**
 * Independent QUIZ_THEME validator — reuses shared choice / leak helpers.
 */
export function validateQuizThemeGeneration(input: {
  title: string
  questions: GeneratedQuizThemeQuestion[]
  context: QuizThemeContext
}): QuizThemeValidationResult {
  const { title, questions, context } = input
  const errors: string[] = []
  const warnings: string[] = []
  const target = context.targetQuestions

  if (!title.trim()) {
    errors.push("Titre du quiz manquant.")
  }

  if (questions.length !== target) {
    errors.push(`Nombre de questions : reçu ${questions.length}, attendu ${target}.`)
  }

  const seenQuestions = new Set<string>()
  const topics = new Map<string, number>()
  const styles: QuizThemeQuestionStyle[] = []

  questions.forEach((q, i) => {
    const n = i + 1
    if (!q.question?.trim()) {
      errors.push(`Question ${n}: énoncé vide.`)
      return
    }

    const qKey = normalizeKey(q.question)
    if (seenQuestions.has(qKey)) {
      errors.push(`Question ${n}: doublon d'énoncé.`)
    }
    seenQuestions.add(qKey)

    if (!isQuizThemeQuestionStyle(q.questionStyle)) {
      errors.push(
        `Question ${n}: questionStyle invalide ou manquant (« ${String(q.questionStyle ?? "")} »).`,
      )
    } else {
      styles.push(q.questionStyle)
    }

    if (!Array.isArray(q.choices) || q.choices.length !== QUIZ_THEME_CHOICE_COUNT) {
      errors.push(
        `Question ${n}: exactement ${QUIZ_THEME_CHOICE_COUNT} choix requis (reçu ${q.choices?.length ?? 0}).`,
      )
      return
    }

    if (q.choices.some((c) => !c?.trim())) {
      errors.push(`Question ${n}: un choix est vide.`)
    }

    if (!choicesAreSufficientlyDistinct(q.choices)) {
      errors.push(`Question ${n}: choix dupliqués ou trop similaires.`)
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

    if (!q.topic?.trim()) {
      errors.push(`Question ${n}: topic manquant.`)
    } else {
      const tKey = normalizeKey(q.topic)
      topics.set(tKey, (topics.get(tKey) ?? 0) + 1)

      const hitExcluded = topicHitsExcluded(
        q.topic,
        q.question,
        context.excludedTopics,
      )
      if (hitExcluded) {
        errors.push(
          `Question ${n}: topic hors cadre (« ${q.topic} ») — sujet exclu : ${hitExcluded}.`,
        )
      } else if (
        context.allowedTopics.length > 0 &&
        !topicMatchesAllowed(q.topic, context.allowedTopics)
      ) {
        errors.push(
          `Question ${n}: topic « ${q.topic} » non cohérent avec les sujets autorisés de l'univers.`,
        )
      }
    }

    const correct = q.choices[q.correctIndex] ?? ""
    if (questionLeaksCorrectAnswer(q.question, correct)) {
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
  })

  // Topic diversity
  if (questions.length >= 4) {
    const distinct = topics.size
    const minDistinct = Math.max(3, Math.ceil(questions.length / 2))
    if (distinct < minDistinct) {
      errors.push(
        `Diversité insuffisante des topics (${distinct} distincts, minimum ${minDistinct}).`,
      )
    }
    for (const [topic, count] of topics) {
      if (count > Math.ceil(questions.length / 2)) {
        errors.push(`Topic « ${topic} » sur-représenté (${count} questions).`)
      }
    }
  }

  // Form / questionStyle diversity
  if (styles.length === questions.length && questions.length > 0) {
    const styleEval = evaluateQuestionStyleDiversity(styles)
    errors.push(...styleEval.errors)
    warnings.push(...styleEval.warnings)
  }

  if (errors.length) {
    return { ok: false, errors, warnings }
  }

  const styleEval = evaluateQuestionStyleDiversity(styles)
  return {
    ok: true,
    questions,
    title: title.trim(),
    topics: [...topics.keys()],
    styles,
    styleDistinctCount: styleEval.distinctCount,
    styleDiversityOk: true,
    warnings,
  }
}
