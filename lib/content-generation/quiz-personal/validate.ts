import type { AllowedSourceIds, QuizPersonalSourceContext, SourceRef } from "../types"
import { choicesAreSufficientlyDistinct, textMentionsForbidden } from "../validators"
import { quizPersonalQuestionRange } from "../source-context"
import {
  lookupSourceQuizValue,
  maxPrimaryUsesForValue,
} from "./editorial-value"
import { collectEditorialQualityErrors } from "./quality"
import { QUIZ_PERSONAL_CHOICE_COUNT } from "./schema"
import type {
  GeneratedQuizPersonalQuestion,
  QuizPersonalValidationResult,
} from "./types"

function isAllowedRef(ref: SourceRef, allowed: AllowedSourceIds): boolean {
  if (!ref.id) return false
  if (ref.type === "FACT") return allowed.factIds.has(ref.id)
  if (ref.type === "MEMORY") return allowed.memoryIds.has(ref.id)
  if (ref.type === "JOKE") return allowed.jokeIds.has(ref.id)
  if (ref.type === "PARTICIPANT") return allowed.participantIds.has(ref.id)
  return false
}

function refExistsInContext(ref: SourceRef, ctx: QuizPersonalSourceContext): boolean {
  if (ref.type === "FACT") return ctx.facts.some((f) => f.id === ref.id)
  if (ref.type === "MEMORY") return ctx.memories.some((m) => m.id === ref.id)
  if (ref.type === "JOKE") return ctx.jokes.some((j) => j.id === ref.id)
  if (ref.type === "PARTICIPANT") return ctx.participants.some((p) => p.id === ref.id)
  return false
}

function primaryContentRefs(q: GeneratedQuizPersonalQuestion): string[] {
  return q.sourceRefs
    .filter((r) => r.type === "FACT" || r.type === "MEMORY" || r.type === "JOKE")
    .map((r) => `${r.type}:${r.id}`)
}

/**
 * Independent business + editorial quality validator — does not trust the LLM.
 * Unused sources are allowed. Rich HIGH sources may appear at most twice.
 */
export function validateQuizPersonalGeneration(input: {
  questions: GeneratedQuizPersonalQuestion[]
  context: QuizPersonalSourceContext
  allowed: AllowedSourceIds
}): QuizPersonalValidationResult {
  const { questions, context, allowed } = input
  const errors: string[] = []
  const warnings: string[] = []
  const sourceCount = context.facts.length + context.memories.length + context.jokes.length
  const range = quizPersonalQuestionRange(sourceCount)

  if (range.max === 0) {
    return { ok: false, errors: ["Aucune source autorisée pour générer un quiz."], warnings }
  }

  if (questions.length < range.min || questions.length > range.max) {
    errors.push(
      `Nombre de questions hors plage : reçu ${questions.length}, attendu ${range.min}–${range.max}.`,
    )
  }

  const seenPrimary = new Map<string, number>()

  questions.forEach((q, i) => {
    const n = i + 1
    if (!q.question?.trim()) {
      errors.push(`Question ${n}: énoncé vide.`)
      return
    }

    if (!Array.isArray(q.choices) || q.choices.length !== QUIZ_PERSONAL_CHOICE_COUNT) {
      errors.push(
        `Question ${n}: exactement ${QUIZ_PERSONAL_CHOICE_COUNT} choix requis (reçu ${q.choices?.length ?? 0}).`,
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

    if (!Array.isArray(q.sourceRefs) || q.sourceRefs.length === 0) {
      errors.push(`Question ${n}: au moins un sourceRef est requis.`)
    } else {
      for (const ref of q.sourceRefs) {
        if (!["FACT", "MEMORY", "PARTICIPANT", "JOKE"].includes(ref.type)) {
          errors.push(`Question ${n}: type de sourceRef invalide (${ref.type}).`)
          continue
        }
        if (!isAllowedRef(ref, allowed)) {
          errors.push(
            `Question ${n}: sourceRef non autorisée pour ce slot (${ref.type}:${ref.id}).`,
          )
          continue
        }
        if (!refExistsInContext(ref, context)) {
          errors.push(`Question ${n}: sourceRef inconnue (${ref.type}:${ref.id}).`)
        }
      }
    }

    const texts = [q.question, ...q.choices, q.explanation ?? ""]
    for (const t of texts) {
      if (textMentionsForbidden(t, context.forbiddenTopics)) {
        errors.push(`Question ${n}: contenu lié à un sujet interdit.`)
        break
      }
    }

    for (const key of primaryContentRefs(q)) {
      seenPrimary.set(key, (seenPrimary.get(key) ?? 0) + 1)
    }
  })

  for (const [key, count] of seenPrimary.entries()) {
    const [type, id] = key.split(":") as ["FACT" | "MEMORY" | "JOKE", string]
    const value = lookupSourceQuizValue(context, type, id)
    const maxUses = maxPrimaryUsesForValue(value)
    if (count > maxUses) {
      errors.push(
        `La source ${key} (valeur ${value}) est utilisée ${count} fois (max ${maxUses}).`,
      )
    }
  }

  errors.push(...collectEditorialQualityErrors(questions, context))

  const unusedPrimaries =
    context.facts.length +
    context.memories.length +
    context.jokes.length -
    seenPrimary.size
  if (unusedPrimaries > 0) {
    warnings.push(
      `${unusedPrimaries} source(s) autorisée(s) non utilisée(s) — c'est acceptable si la qualité du quiz est meilleure.`,
    )
  }

  if (errors.length) {
    return { ok: false, errors, warnings }
  }

  const used = {
    factIds: new Set<string>(),
    memoryIds: new Set<string>(),
    jokeIds: new Set<string>(),
    participantIds: new Set<string>(),
  }
  for (const q of questions) {
    for (const ref of q.sourceRefs) {
      if (ref.type === "FACT") used.factIds.add(ref.id)
      if (ref.type === "MEMORY") used.memoryIds.add(ref.id)
      if (ref.type === "JOKE") used.jokeIds.add(ref.id)
      if (ref.type === "PARTICIPANT") used.participantIds.add(ref.id)
    }
  }

  return {
    ok: true,
    questions,
    usedSourceIds: {
      factIds: [...used.factIds],
      memoryIds: [...used.memoryIds],
      jokeIds: [...used.jokeIds],
      participantIds: [...used.participantIds],
    },
    unusedSourceIds: {
      factIds: context.facts.map((f) => f.id).filter((id) => !used.factIds.has(id)),
      memoryIds: context.memories.map((m) => m.id).filter((id) => !used.memoryIds.has(id)),
      jokeIds: context.jokes.map((j) => j.id).filter((id) => !used.jokeIds.has(id)),
      participantIds: context.participants
        .map((p) => p.id)
        .filter((id) => !used.participantIds.has(id)),
    },
    warnings,
  }
}
