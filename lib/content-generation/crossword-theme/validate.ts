import {
  MAX_ANSWER_LENGTH,
  MIN_ANSWER_LENGTH,
  normalizeAnswer,
} from "@/lib/game-engines/crossword/normalize"
import { topicHitsExcluded } from "@/lib/universes/editorial"
import type { CrosswordThemeContext } from "./context"
import type {
  CrosswordThemeEntryIssue,
  CrosswordThemeValidationResult,
  GeneratedCrosswordThemeEntry,
} from "./types"

const ANSWER_ALLOWED_RE = /^[\p{L}\s'\-]+$/u

const GENERIC_NORMALIZED = new Set([
  "MOT",
  "MOTS",
  "CHOSE",
  "JEU",
  "GRILLE",
  "LETTRE",
  "UNIVERS",
  "THEME",
  "COULEUR",
  "MODE",
])

const TEMPORAL_RE =
  /\b(actuellement|cette ann[eé]e|r[eé]cemment|aujourd.?hui|en 202[0-9]|l.?ann[eé]e derni[eè]re|en ce moment)\b/i

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
}

export function topicKeyIsAllowed(topicKey: string, allowedTopics: string[]): boolean {
  if (!allowedTopics.length) return Boolean(topicKey.trim())
  return allowedTopics.includes(topicKey)
}

export function isTrivialInclusion(a: string, b: string): boolean {
  if (a === b) return true
  const short = a.length <= b.length ? a : b
  const long = a.length <= b.length ? b : a
  if (long.startsWith(short) && long.length - short.length <= 1) return true
  return false
}

/** Clue must not embed the normalized answer as a contiguous substring. */
export function clueContainsAnswer(clue: string, normalizedAnswer: string): boolean {
  if (!normalizedAnswer || normalizedAnswer.length < 3) return false
  const clueNorm = normalizeAnswer(clue)
  return clueNorm.includes(normalizedAnswer)
}

export function evaluateTopicKeyDiversity(input: {
  entries: GeneratedCrosswordThemeEntry[]
  allowedTopics: string[]
}): { ok: boolean; distinctCount: number; errors: string[] } {
  const errors: string[] = []
  const counts = new Map<string, number>()
  for (const e of input.entries) {
    const key = normalizeKey(e.topicKey)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const distinctCount = counts.size

  if (input.allowedTopics.length >= 4 && input.entries.length >= 4 && distinctCount < 3) {
    errors.push(
      `Diversité insuffisante des topicKeys (${distinctCount} distincts, minimum 3).`,
    )
  }

  if (input.allowedTopics.length >= 2) {
    for (const [topic, count] of counts) {
      if (count > 4) {
        errors.push(`topicKey « ${topic} » sur-représenté (${count} entrées, maximum 4).`)
      }
    }
  }

  return { ok: errors.length === 0, distinctCount, errors }
}

export function validateCrosswordThemeEntry(
  e: GeneratedCrosswordThemeEntry,
  context: CrosswordThemeContext,
  entryNumber1Based: number,
): string[] {
  const n = entryNumber1Based
  const errors: string[] = []
  const answer = e.answer?.trim() ?? ""
  const clue = e.clue?.trim() ?? ""

  if (!answer) {
    errors.push(`Entrée ${n}: answer vide.`)
    return errors
  }

  if (!ANSWER_ALLOWED_RE.test(answer)) {
    errors.push(`Entrée ${n}: caractères incompatibles dans « ${answer} ».`)
  }

  const normalized = e.normalized || normalizeAnswer(answer)
  if (!normalized) {
    errors.push(`Entrée ${n}: normalisation vide pour « ${answer} ».`)
    return errors
  }

  if (normalized.length < MIN_ANSWER_LENGTH) {
    errors.push(
      `Entrée ${n}: trop courte après normalisation (${normalized.length}, minimum ${MIN_ANSWER_LENGTH}).`,
    )
  }
  if (normalized.length > MAX_ANSWER_LENGTH) {
    errors.push(
      `Entrée ${n}: trop longue après normalisation (${normalized.length}, maximum ${MAX_ANSWER_LENGTH}).`,
    )
  }

  if (GENERIC_NORMALIZED.has(normalized)) {
    errors.push(`Entrée ${n}: terme trop générique « ${answer} ».`)
  }

  if (!clue) {
    errors.push(`Entrée ${n}: clue vide.`)
  } else {
    if (clue.length < 12) {
      errors.push(`Entrée ${n}: clue trop courte / peu informative.`)
    }
    if (clueContainsAnswer(clue, normalized)) {
      errors.push(`Entrée ${n}: la clue contient directement la réponse.`)
    }
    if (TEMPORAL_RE.test(clue)) {
      errors.push(`Entrée ${n}: clue trop liée à l'actualité / au temps présent.`)
    }
  }

  if (!e.topicKey?.trim()) {
    errors.push(`Entrée ${n}: topicKey manquant.`)
  } else if (!topicKeyIsAllowed(e.topicKey, context.allowedTopics)) {
    errors.push(
      `Entrée ${n}: topicKey « ${e.topicKey} » hors allowedTopics de l'univers.`,
    )
  }

  if (!e.topicLabel?.trim()) {
    errors.push(`Entrée ${n}: topicLabel manquant.`)
  }

  const hitExcluded = topicHitsExcluded(
    e.topicKey,
    `${answer} ${clue} ${e.topicKey} ${e.topicLabel}`,
    context.excludedTopics,
  )
  if (hitExcluded) {
    errors.push(
      `Entrée ${n}: contenu hors cadre — sujet exclu détecté : ${hitExcluded}.`,
    )
  }

  return errors
}

export function validateCrosswordThemeGeneration(input: {
  title: string
  entries: GeneratedCrosswordThemeEntry[]
  context: CrosswordThemeContext
}): CrosswordThemeValidationResult {
  const { title, entries, context } = input
  const errors: string[] = []
  const warnings: string[] = []
  const entryIssues: CrosswordThemeEntryIssue[] = []
  const target = context.targetEntries

  if (!title.trim()) {
    errors.push("Titre manquant.")
  }

  if (entries.length !== target) {
    errors.push(`Nombre d'entrées : reçu ${entries.length}, attendu ${target}.`)
  }

  const seenNormalized = new Set<string>()
  const topicKeys: string[] = []

  entries.forEach((e, i) => {
    const n = i + 1
    const eErrors = validateCrosswordThemeEntry(e, context, n)

    const norm = e.normalized || normalizeAnswer(e.answer)
    if (norm) {
      if (seenNormalized.has(norm)) {
        eErrors.push(`Entrée ${n}: doublon après normalisation (${norm}).`)
      }
      seenNormalized.add(norm)
    }

    if (e.topicKey?.trim()) {
      topicKeys.push(e.topicKey)
    }

    if (eErrors.length) {
      entryIssues.push({ index: i, errors: eErrors })
      errors.push(...eErrors)
    }
  })

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!.normalized || normalizeAnswer(entries[i]!.answer)
      const b = entries[j]!.normalized || normalizeAnswer(entries[j]!.answer)
      if (a && b && isTrivialInclusion(a, b)) {
        const msg = `Entrées ${i + 1} et ${j + 1}: inclusion triviale (${a} / ${b}).`
        errors.push(msg)
        for (const idx of [i, j]) {
          const existing = entryIssues.find((ei) => ei.index === idx)
          if (existing) {
            if (!existing.errors.includes(msg)) existing.errors.push(msg)
          } else {
            entryIssues.push({ index: idx, errors: [msg] })
          }
        }
      }
    }
  }

  const diversity = evaluateTopicKeyDiversity({
    entries,
    allowedTopics: context.allowedTopics,
  })
  if (!diversity.ok) {
    errors.push(...diversity.errors)
    for (const err of diversity.errors) {
      if (/sur-représenté/i.test(err)) {
        const m = err.match(/topicKey « ([^»]+) »/)
        const topicNorm = m?.[1] ? normalizeKey(m[1]) : null
        if (topicNorm) {
          entries.forEach((e, i) => {
            if (normalizeKey(e.topicKey) === topicNorm) {
              const existing = entryIssues.find((ei) => ei.index === i)
              if (existing) {
                if (!existing.errors.includes(err)) existing.errors.push(err)
              } else {
                entryIssues.push({ index: i, errors: [err] })
              }
            }
          })
        }
      }
    }
  }

  if (errors.length) {
    return { ok: false, errors, warnings, entryIssues }
  }

  const distinctTopicKeys = [...new Set(topicKeys.map(normalizeKey))]

  return {
    ok: true,
    title: title.trim(),
    entries,
    topicKeys: distinctTopicKeys,
    topicDistinctCount: diversity.distinctCount,
    topicDiversityOk: diversity.ok,
    warnings,
  }
}

/** Indexes to replace when the crossword engine fails to build a connected grid. */
export function pickEngineRepairIndexes(entryCount: number): number[] {
  if (entryCount <= 1) return entryCount === 1 ? [0] : []
  const replaceCount = Math.min(4, Math.max(2, Math.ceil(entryCount / 3)))
  const start = Math.max(0, entryCount - replaceCount)
  return Array.from({ length: entryCount - start }, (_, i) => start + i)
}
