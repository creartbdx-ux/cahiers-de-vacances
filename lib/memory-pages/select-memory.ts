import { createRng } from "@/lib/game-engines/random"
import type { BookProfileV1, MemoryEntry, QuestionnairePhoto } from "@/lib/questionnaire/types"
import type { MemoryPageSource } from "./types"

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function usablePhotos(profile: BookProfileV1): QuestionnairePhoto[] {
  return (profile.photos ?? []).filter((p) => p.useAuthorized && Boolean(p.storagePath))
}

function linkedPhotoIdsForMemory(
  memory: MemoryEntry,
  photos: QuestionnairePhoto[],
): string[] {
  const memParts = new Set(memory.participantIds ?? [])
  if (!memParts.size) {
    // No participant tag: allow any authorized photo as soft link candidate (first only later).
    return photos.map((p) => p.id)
  }
  const matched = photos.filter((p) => {
    const pp = p.participantIds ?? []
    if (!pp.length) return true
    return pp.some((id) => memParts.has(id))
  })
  return matched.map((p) => p.id)
}

function scoreMemory(memory: MemoryEntry, usedIds: ReadonlySet<string>): number {
  if (usedIds.has(memory.id)) return -1000
  const words = wordCount(memory.text)
  let score = Math.min(40, words * 2)
  if (words >= 25) score += 15
  if (words >= 40) score += 10
  if (memory.title?.trim()) score += 8
  if (memory.place?.trim()) score += 6
  if (words < 8) score -= 25
  return score
}

export function toMemoryPageSource(
  memory: MemoryEntry,
  profile: BookProfileV1,
): MemoryPageSource | null {
  const text = memory.text?.trim()
  if (!text) return null
  const photos = usablePhotos(profile)
  return {
    memoryId: memory.id,
    participantIds: [...(memory.participantIds ?? [])],
    originalText: text,
    title: memory.title?.trim() || undefined,
    place: memory.place?.trim() || undefined,
    linkedPhotoIds: linkedPhotoIdsForMemory(memory, photos),
  }
}

/**
 * Deterministic memory pick for a MEMORY_PAGE slot.
 * Prefers detailed, unused memories; balances participants for DUO/GROUP.
 */
export function selectMemoryForPage(input: {
  profile: BookProfileV1
  seed: string
  /** Already used memory ids in this book / session. */
  usedMemoryIds?: ReadonlySet<string> | string[]
  /** Prefer a memory involving these participants when possible. */
  preferParticipantIds?: string[]
}): MemoryPageSource | null {
  const used = new Set(
    input.usedMemoryIds instanceof Set
      ? [...input.usedMemoryIds]
      : (input.usedMemoryIds ?? []),
  )
  const memories = (input.profile.memories ?? []).filter((m) => m.text?.trim())
  if (!memories.length) return null

  const rng = createRng(`memory-page:${input.seed}`)
  const prefer = new Set(input.preferParticipantIds ?? [])

  const ranked = memories
    .map((m) => {
      let s = scoreMemory(m, used)
      if (prefer.size && (m.participantIds ?? []).some((id) => prefer.has(id))) {
        s += 12
      }
      // Soft random jitter for seed diversity without destroying ranking
      s += rng.next() * 4
      return { m, s }
    })
    .sort((a, b) => b.s - a.s)

  const best = ranked[0]?.m
  if (!best || used.has(best.id) && ranked.every((r) => used.has(r.m.id))) {
    // All used — allow reuse of best unused-or-first
    const fallback = ranked.find((r) => !used.has(r.m.id))?.m ?? ranked[0]?.m
    return fallback ? toMemoryPageSource(fallback, input.profile) : null
  }

  return toMemoryPageSource(best, input.profile)
}

/** Pick several distinct memories for multi-page planning (deterministic). */
export function selectDistinctMemories(input: {
  profile: BookProfileV1
  seed: string
  count: number
}): MemoryPageSource[] {
  const out: MemoryPageSource[] = []
  const used = new Set<string>()
  for (let i = 0; i < input.count; i++) {
    const pick = selectMemoryForPage({
      profile: input.profile,
      seed: `${input.seed}:pick:${i}`,
      usedMemoryIds: used,
    })
    if (!pick) break
    out.push(pick)
    used.add(pick.memoryId)
  }
  return out
}
