import type { BookProfileV1, ForbiddenTopicsAnswer, PersonalFact } from "@/lib/questionnaire/types"
import type { SourceCandidate, SourceInventory } from "./types"

const SHORT_MIN = 3
const SHORT_MAX = 12

/** Categories that tend to yield short crossword/wordsearch answers. */
const SHORT_FACT_CATEGORIES = new Set([
  "FOOD",
  "DRINK",
  "MUSIC",
  "MOVIE_SERIES",
  "BOOK",
  "ACTIVITY",
  "PLACE",
  "HABIT",
  "EXPRESSION",
  "OBJECT",
  "OTHER",
])

export function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, "")
}

export function isShortAnswer(value: string): boolean {
  const token = normalizeToken(value)
  return token.length >= SHORT_MIN && token.length <= SHORT_MAX
}

function splitNeedles(text: string | undefined): string[] {
  if (!text?.trim()) return []
  return text
    .split(/[,;\n/|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2)
}

export function buildForbiddenNeedles(forbidden: ForbiddenTopicsAnswer): string[] {
  if (!forbidden.hasRestrictions) return []
  return [...splitNeedles(forbidden.text), ...splitNeedles(forbidden.peopleToAvoid)]
}

export function textHitsForbidden(text: string, needles: string[]): boolean {
  if (!needles.length) return false
  const hay = text.toLowerCase()
  return needles.some((n) => hay.includes(n))
}

export function filterForbiddenText(text: string, forbidden: ForbiddenTopicsAnswer): boolean {
  return textHitsForbidden(text, buildForbiddenNeedles(forbidden))
}

function factParticipants(fact: PersonalFact, profile: BookProfileV1): string[] {
  if (fact.participantIds?.length) return fact.participantIds
  return profile.participants.map((p) => p.id)
}

/**
 * Build filtered source inventory for eligibility / scoring.
 * Long memories are never treated as crossword answers.
 */
export function buildSourceInventory(profile: BookProfileV1): SourceInventory {
  const needles = buildForbiddenNeedles(profile.forbiddenTopics)
  const participants = profile.participants
    .filter((p) => !textHitsForbidden(p.firstName, needles))
    .map((p) => ({ id: p.id, firstName: p.firstName }))

  const crosswordAnswers: SourceCandidate[] = []
  const wordsearchWords: SourceCandidate[] = []
  const quizFacts: SourceCandidate[] = []
  const trueFalseFacts: SourceCandidate[] = []

  for (const fact of profile.personalFacts) {
    if (!fact.value.trim()) continue
    if (textHitsForbidden(fact.value, needles)) continue
    const participantIds = factParticipants(fact, profile).filter((id) =>
      participants.some((p) => p.id === id),
    )
    const short = SHORT_FACT_CATEGORIES.has(fact.category) && isShortAnswer(fact.value)
    const candidate: SourceCandidate = {
      kind: "fact",
      id: fact.id,
      label: fact.value.trim(),
      participantIds,
      shortAnswer: short,
    }
    if (short) {
      crosswordAnswers.push(candidate)
      wordsearchWords.push(candidate)
    } else if (isShortAnswer(fact.value)) {
      wordsearchWords.push({ ...candidate, shortAnswer: true })
    }
    // DISLIKE / sensitive-ish still usable for quiz if not forbidden
    quizFacts.push(candidate)
    if (fact.category !== "DISLIKE") {
      trueFalseFacts.push(candidate)
    }
  }

  for (const memory of profile.memories) {
    if (!memory.text.trim()) continue
    if (textHitsForbidden(memory.text, needles)) continue
    if (memory.title && textHitsForbidden(memory.title, needles)) continue
    const participantIds = (memory.participantIds?.length
      ? memory.participantIds
      : profile.participants.map((p) => p.id)
    ).filter((id) => participants.some((p) => p.id === id))

    const quizCandidate: SourceCandidate = {
      kind: "memory",
      id: memory.id,
      label: memory.title?.trim() || memory.text.trim().slice(0, 80),
      participantIds,
      shortAnswer: false,
    }
    quizFacts.push(quizCandidate)

    if (memory.place?.trim() && !textHitsForbidden(memory.place, needles) && isShortAnswer(memory.place)) {
      const placeCandidate: SourceCandidate = {
        kind: "memory",
        id: `${memory.id}:place`,
        label: memory.place.trim(),
        participantIds,
        shortAnswer: true,
      }
      wordsearchWords.push(placeCandidate)
      crosswordAnswers.push(placeCandidate)
    }
  }

  for (const joke of profile.insideJokes) {
    if (!joke.text.trim()) continue
    if (textHitsForbidden(joke.text, needles)) continue
    if (!isShortAnswer(joke.text)) continue
    const participantIds = (joke.participantIds?.length
      ? joke.participantIds
      : profile.participants.map((p) => p.id)
    ).filter((id) => participants.some((p) => p.id === id))
    const candidate: SourceCandidate = {
      kind: "joke",
      id: joke.id,
      label: joke.text.trim(),
      participantIds,
      shortAnswer: true,
    }
    wordsearchWords.push(candidate)
    quizFacts.push(candidate)
  }

  for (const p of participants) {
    if (isShortAnswer(p.firstName)) {
      wordsearchWords.push({
        kind: "participant",
        id: `participant:${p.id}`,
        label: p.firstName,
        participantIds: [p.id],
        shortAnswer: true,
      })
    }
  }

  for (const ind of profile.individualProfiles) {
    if (!ind.personalTrait?.trim()) continue
    if (textHitsForbidden(ind.personalTrait, needles)) continue
    if (!participants.some((p) => p.id === ind.participantId)) continue
    const candidate: SourceCandidate = {
      kind: "trait",
      id: `trait:${ind.participantId}`,
      label: ind.personalTrait.trim(),
      participantIds: [ind.participantId],
      shortAnswer: isShortAnswer(ind.personalTrait),
    }
    quizFacts.push(candidate)
    if (candidate.shortAnswer) wordsearchWords.push(candidate)
  }

  const interests = profile.sharedProfile.interestUniverseIds.filter(
    (id) => !textHitsForbidden(id, needles),
  )

  return {
    crosswordAnswers: dedupeByLabel(crosswordAnswers),
    wordsearchWords: dedupeByLabel(wordsearchWords),
    quizFacts: dedupeById(quizFacts),
    trueFalseFacts: dedupeById(trueFalseFacts),
    interests,
    participants,
  }
}

function dedupeByLabel(items: SourceCandidate[]): SourceCandidate[] {
  const seen = new Set<string>()
  const out: SourceCandidate[] = []
  for (const item of items) {
    const key = normalizeToken(item.label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function dedupeById(items: SourceCandidate[]): SourceCandidate[] {
  const seen = new Set<string>()
  const out: SourceCandidate[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}
