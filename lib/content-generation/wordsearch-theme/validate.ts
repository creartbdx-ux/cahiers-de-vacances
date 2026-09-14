import { ALL_DIRECTIONS } from "@/lib/game-engines/wordsearch/geometry"
import { MIN_WORD_LENGTH, maxPlaceableLength, normalizeWord } from "@/lib/game-engines/wordsearch/normalize"
import { topicHitsExcluded } from "@/lib/universes/editorial"
import type { WordSearchThemeContext } from "./context"
import type {
  GeneratedWordSearchThemeWord,
  WordSearchThemeValidationResult,
  WordSearchThemeWordIssue,
} from "./types"

export const WORDSEARCH_THEME_MAX_NORMALIZED_LENGTH = 14

const DEFAULT_GRID = 12

const DISPLAY_ALLOWED_RE = /^[\p{L}\s'\-]+$/u

const GENERIC_NORMALIZED = new Set([
  "MOT",
  "MOTS",
  "CHOSE",
  "CHOS",
  "JEU",
  "GRILLE",
  "LETTRE",
  "UNIVERS",
  "THEME",
  "COULEUR",
])

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

function maxNormalizedLengthForGrid(): number {
  const engineMax = maxPlaceableLength(ALL_DIRECTIONS, DEFAULT_GRID, DEFAULT_GRID)
  return Math.min(WORDSEARCH_THEME_MAX_NORMALIZED_LENGTH, engineMax)
}

export function isTrivialInclusion(a: string, b: string): boolean {
  if (a === b) return true
  const short = a.length <= b.length ? a : b
  const long = a.length <= b.length ? b : a
  if (long.startsWith(short) && long.length - short.length <= 1) return true
  return false
}

export function evaluateTopicKeyDiversity(input: {
  words: GeneratedWordSearchThemeWord[]
  allowedTopics: string[]
}): { ok: boolean; distinctCount: number; errors: string[] } {
  const errors: string[] = []
  const counts = new Map<string, number>()
  for (const w of input.words) {
    const key = normalizeKey(w.topicKey)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const distinctCount = counts.size

  if (input.allowedTopics.length >= 4 && input.words.length >= 4 && distinctCount < 3) {
    errors.push(
      `Diversité insuffisante des topicKeys (${distinctCount} distincts, minimum 3).`,
    )
  }

  if (input.allowedTopics.length >= 2) {
    for (const [topic, count] of counts) {
      if (count > 5) {
        errors.push(`topicKey « ${topic} » sur-représenté (${count} mots, maximum 5).`)
      }
    }
  }

  return { ok: errors.length === 0, distinctCount, errors }
}

export function validateWordSearchThemeWord(
  w: GeneratedWordSearchThemeWord,
  context: WordSearchThemeContext,
  wordNumber1Based: number,
): string[] {
  const n = wordNumber1Based
  const errors: string[] = []
  const display = w.display?.trim() ?? ""

  if (!display) {
    errors.push(`Mot ${n}: display vide.`)
    return errors
  }

  if (!DISPLAY_ALLOWED_RE.test(display)) {
    errors.push(`Mot ${n}: caractères incompatibles dans « ${display} ».`)
  }

  const normalized = w.normalized || normalizeWord(display)
  if (!normalized) {
    errors.push(`Mot ${n}: normalisation vide pour « ${display} ».`)
    return errors
  }

  const maxLen = maxNormalizedLengthForGrid()
  if (normalized.length < MIN_WORD_LENGTH) {
    errors.push(
      `Mot ${n}: trop court après normalisation (${normalized.length}, minimum ${MIN_WORD_LENGTH}).`,
    )
  }
  if (normalized.length > maxLen) {
    errors.push(
      `Mot ${n}: trop long après normalisation (${normalized.length}, maximum ${maxLen}).`,
    )
  }

  if (GENERIC_NORMALIZED.has(normalized)) {
    errors.push(`Mot ${n}: terme trop générique « ${display} ».`)
  }

  if (!w.topicKey?.trim()) {
    errors.push(`Mot ${n}: topicKey manquant.`)
  } else if (!topicKeyIsAllowed(w.topicKey, context.allowedTopics)) {
    errors.push(
      `Mot ${n}: topicKey « ${w.topicKey} » hors allowedTopics de l'univers.`,
    )
  }

  const hitExcluded = topicHitsExcluded(
    w.topicKey,
    `${display} ${w.topicKey}`,
    context.excludedTopics,
  )
  if (hitExcluded) {
    errors.push(
      `Mot ${n}: contenu hors cadre — sujet exclu détecté : ${hitExcluded}.`,
    )
  }

  return errors
}

export function validateWordSearchThemeGeneration(input: {
  title: string
  words: GeneratedWordSearchThemeWord[]
  context: WordSearchThemeContext
}): WordSearchThemeValidationResult {
  const { title, words, context } = input
  const errors: string[] = []
  const warnings: string[] = []
  const wordIssues: WordSearchThemeWordIssue[] = []
  const target = context.targetWords

  if (!title.trim()) {
    errors.push("Titre manquant.")
  }

  if (words.length !== target) {
    errors.push(`Nombre de mots : reçu ${words.length}, attendu ${target}.`)
  }

  const seenNormalized = new Set<string>()
  const topicKeys: string[] = []

  words.forEach((w, i) => {
    const n = i + 1
    const wErrors = validateWordSearchThemeWord(w, context, n)

    const norm = w.normalized || normalizeWord(w.display)
    if (norm) {
      if (seenNormalized.has(norm)) {
        wErrors.push(`Mot ${n}: doublon après normalisation (${norm}).`)
      }
      seenNormalized.add(norm)
    }

    if (w.topicKey?.trim()) {
      topicKeys.push(w.topicKey)
    }

    if (wErrors.length) {
      wordIssues.push({ index: i, errors: wErrors })
      errors.push(...wErrors)
    }
  })

  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const a = words[i]!.normalized || normalizeWord(words[i]!.display)
      const b = words[j]!.normalized || normalizeWord(words[j]!.display)
      if (a && b && isTrivialInclusion(a, b)) {
        const msg = `Mots ${i + 1} et ${j + 1}: inclusion triviale (${a} / ${b}).`
        errors.push(msg)
        for (const idx of [i, j]) {
          const existing = wordIssues.find((wi) => wi.index === idx)
          if (existing) {
            if (!existing.errors.includes(msg)) existing.errors.push(msg)
          } else {
            wordIssues.push({ index: idx, errors: [msg] })
          }
        }
      }
    }
  }

  const diversity = evaluateTopicKeyDiversity({
    words,
    allowedTopics: context.allowedTopics,
  })
  if (!diversity.ok) {
    errors.push(...diversity.errors)
    for (const e of diversity.errors) {
      if (/sur-représenté/i.test(e)) {
        const m = e.match(/topicKey « ([^»]+) »/)
        const topicNorm = m?.[1] ? normalizeKey(m[1]) : null
        if (topicNorm) {
          words.forEach((w, i) => {
            if (normalizeKey(w.topicKey) === topicNorm) {
              const existing = wordIssues.find((wi) => wi.index === i)
              if (existing) {
                if (!existing.errors.includes(e)) existing.errors.push(e)
              } else {
                wordIssues.push({ index: i, errors: [e] })
              }
            }
          })
        }
      }
    }
  }

  if (errors.length) {
    return { ok: false, errors, warnings, wordIssues }
  }

  const distinctTopicKeys = [...new Set(topicKeys.map(normalizeKey))]

  return {
    ok: true,
    title: title.trim(),
    words,
    topicKeys: distinctTopicKeys,
    topicDistinctCount: diversity.distinctCount,
    topicDiversityOk: diversity.ok,
    warnings,
  }
}
