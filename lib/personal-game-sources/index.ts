/**
 * Personal content sources for PERSONAL games — not for editorial pages.
 * Memories stay in the profile; they feed quiz / true-false / crossword / wordsearch.
 */

import type {
  BookProfileV1,
  InsideJoke,
  MemoryEntry,
  PersonalFact,
} from "@/lib/questionnaire/types"
import { extractPersonalSourceFacts, type PersonalSourceFacts } from "@/lib/personal-editorial/facts"
import { buildPersonalEditorialAudienceContext } from "@/lib/personal-editorial/audience-context"
import {
  inferPairRelation,
  type SourceRelation,
} from "@/lib/personal-editorial/relations"

export interface PersonalGameMemorySource {
  sourceMemoryId: string
  text: string
  title?: string | null
  place?: string | null
  participantIds: string[]
  facts: PersonalSourceFacts
}

export interface PersonalGameSources {
  audience: BookProfileV1["audience"]
  participants: Array<{ id: string; firstName: string }>
  creatorFirstName: string | null
  memories: PersonalGameMemorySource[]
  personalFacts: PersonalFact[]
  insideJokes: InsideJoke[]
  interestUniverseIds: string[]
  forbiddenTopics: BookProfileV1["forbiddenTopics"]
  /** Explicit pairwise relations between memory sources (never invented). */
  memoryRelations: SourceRelation[]
}

/**
 * Expose questionnaire personal content for PERSONAL game generators.
 * Does not create editorial pages.
 */
export function getPersonalGameSources(profile: BookProfileV1): PersonalGameSources {
  const ctx = buildPersonalEditorialAudienceContext(profile)
  const memories: PersonalGameMemorySource[] = (profile.memories ?? [])
    .filter((m) => m.text?.trim())
    .map((m: MemoryEntry) => ({
      sourceMemoryId: m.id,
      text: m.text.trim(),
      title: m.title ?? null,
      place: m.place ?? null,
      participantIds: m.participantIds ?? [],
      facts: extractPersonalSourceFacts({
        sourceId: m.id,
        sourceType: "MEMORY",
        rawText: m.text,
        place: m.place,
        title: m.title,
        ctx,
      }),
    }))

  const memoryRelations: SourceRelation[] = []
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const rel = inferPairRelation(memories[i]!.facts, memories[j]!.facts)
      if (rel.type !== "NONE") memoryRelations.push(rel)
    }
  }

  return {
    audience: profile.audience,
    participants: (profile.participants ?? []).map((p) => ({
      id: p.id,
      firstName: p.firstName,
    })),
    creatorFirstName: profile.creator?.firstName?.trim() || null,
    memories,
    personalFacts: profile.personalFacts ?? [],
    insideJokes: profile.insideJokes ?? [],
    interestUniverseIds: profile.sharedProfile?.interestUniverseIds ?? [],
    forbiddenTopics: profile.forbiddenTopics,
    memoryRelations,
  }
}
