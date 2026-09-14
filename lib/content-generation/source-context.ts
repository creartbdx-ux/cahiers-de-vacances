import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import {
  forbiddenTopicsForPrompt,
  type AllowedSourceIds,
  type QuizPersonalSourceContext,
} from "./types"

/**
 * Resolve ONLY the source IDs listed on the editorial slot into a minimal
 * context. Never copies the full BookProfile (no email, user ids, photos, etc.).
 */
export function buildAllowedSourceIds(slot: EditorialGameSlot): AllowedSourceIds {
  return {
    factIds: new Set(slot.sourceFactIds),
    memoryIds: new Set(slot.sourceMemoryIds),
    jokeIds: new Set(slot.sourceJokeIds),
    participantIds: new Set(slot.sourceParticipantIds),
    interestIds: new Set(slot.sourceInterestIds),
  }
}

export function buildQuizPersonalSourceContext(input: {
  profile: BookProfileV1
  slot: EditorialGameSlot
}): QuizPersonalSourceContext {
  const { profile, slot } = input
  const allowed = buildAllowedSourceIds(slot)

  const participants = profile.participants
    .filter((p) => allowed.participantIds.has(p.id))
    .map((p) => ({
      id: p.id,
      firstName: p.firstName.trim() || "Participant",
    }))

  const facts = profile.personalFacts
    .filter((f) => allowed.factIds.has(f.id) && f.value.trim())
    .map((f) => ({
      id: f.id,
      text: f.value.trim(),
      subjectParticipantIds: f.participantIds?.length
        ? [...f.participantIds]
        : profile.participants.map((p) => p.id),
    }))

  // Traits may appear as synthetic fact ids in some inventories.
  for (const id of allowed.factIds) {
    if (!id.startsWith("trait:")) continue
    if (facts.some((f) => f.id === id)) continue
    const participantId = id.slice("trait:".length)
    const ind = profile.individualProfiles.find((x) => x.participantId === participantId)
    const trait = ind?.personalTrait?.trim()
    if (!trait) continue
    facts.push({
      id,
      text: trait,
      subjectParticipantIds: [participantId],
    })
  }

  const memories = profile.memories
    .filter((m) => allowed.memoryIds.has(m.id) && m.text.trim())
    .map((m) => ({
      id: m.id,
      text: m.text.trim(),
      ...(m.title?.trim() ? { title: m.title.trim() } : {}),
      ...(m.place?.trim() ? { place: m.place.trim() } : {}),
      participantIds: m.participantIds?.length
        ? [...m.participantIds]
        : profile.participants.map((p) => p.id),
    }))

  const jokes = profile.insideJokes
    .filter((j) => allowed.jokeIds.has(j.id) && j.text.trim())
    .map((j) => ({
      id: j.id,
      text: j.text.trim(),
      participantIds: j.participantIds?.length
        ? [...j.participantIds]
        : profile.participants.map((p) => p.id),
    }))

  const interests = profile.sharedProfile.interestUniverseIds
    .filter((id) => allowed.interestIds.has(id))
    .map((id) => ({ id }))

  return {
    audience: profile.audience,
    participantNames: participants.map((p) => p.firstName),
    participants,
    facts,
    memories,
    jokes,
    interests,
    forbiddenTopics: forbiddenTopicsForPrompt(profile.forbiddenTopics),
  }
}

export function countSourceUnits(ctx: QuizPersonalSourceContext): number {
  return ctx.facts.length + ctx.memories.length + ctx.jokes.length
}

/** Target question window for QUIZ_PERSONAL V1. */
export function quizPersonalQuestionRange(sourceCount: number): { min: number; max: number } {
  if (sourceCount <= 0) return { min: 0, max: 0 }
  if (sourceCount < 6) return { min: Math.min(4, sourceCount), max: sourceCount }
  return { min: 6, max: Math.min(8, sourceCount) }
}

export function summarizeSourceContext(ctx: QuizPersonalSourceContext): {
  factCount: number
  memoryCount: number
  jokeCount: number
  participantNames: string[]
} {
  return {
    factCount: ctx.facts.length,
    memoryCount: ctx.memories.length,
    jokeCount: ctx.jokes.length,
    participantNames: [...ctx.participantNames],
  }
}

export function lookupSourceText(
  ctx: QuizPersonalSourceContext,
  type: "FACT" | "MEMORY" | "PARTICIPANT" | "JOKE",
  id: string,
): string | null {
  if (type === "FACT") {
    const f = ctx.facts.find((x) => x.id === id)
    return f?.text ?? null
  }
  if (type === "MEMORY") {
    const m = ctx.memories.find((x) => x.id === id)
    if (!m) return null
    return m.title ? `${m.title} — ${m.text}` : m.text
  }
  if (type === "JOKE") {
    return ctx.jokes.find((x) => x.id === id)?.text ?? null
  }
  return ctx.participants.find((x) => x.id === id)?.firstName ?? null
}
