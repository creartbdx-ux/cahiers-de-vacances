import { createRng } from "@/lib/game-engines/random"
import type { BookProfileV1, DifficultyLevel } from "@/lib/questionnaire/types"
import { evaluateEligibility } from "./eligibility"
import {
  buildContentRequirements,
  targetPersonalRatio,
  templateForEngine,
} from "./requirements"
import { pickUniverse, scoreCandidate, type ScoreContext } from "./scoring"
import { buildSourceInventory } from "./sources"
import type {
  BuildEditorialPlanInput,
  EditorialGameSlot,
  EditorialPlanV1,
  EditorialV1GameId,
  SourceCandidate,
  SourceInventory,
} from "./types"
import { EDITORIAL_PLAN_VERSION } from "./types"

const DEFAULT_MAX_SLOTS = 8

function clampDifficulty(d: number): DifficultyLevel {
  if (d <= 1) return 1
  if (d === 2) return 2
  if (d === 3) return 3
  return 4
}

function pickSources(
  inventory: SourceInventory,
  gameId: EditorialV1GameId,
  usedFactIds: Set<string>,
  usedMemoryIds: Set<string>,
  _usedJokeIds: Set<string>,
  usedParticipantIds: Map<string, number>,
  rng: ReturnType<typeof createRng>,
): {
  factIds: string[]
  memoryIds: string[]
  jokeIds: string[]
  participantIds: string[]
  interestIds: string[]
} {
  const rank = (items: SourceCandidate[], isUsed: (c: SourceCandidate) => boolean) => {
    const fresh = items.filter((c) => !isUsed(c))
    const reused = items.filter((c) => isUsed(c))
    return [...rng.shuffle(fresh), ...rng.shuffle(reused)]
  }

  const collect = (picked: SourceCandidate[]) => {
    const factIds: string[] = []
    const memoryIds: string[] = []
    const jokeIds: string[] = []
    const participantIds = new Set<string>()
    for (const c of picked) {
      for (const pid of c.participantIds) participantIds.add(pid)
      if (c.kind === "fact") factIds.push(c.id)
      else if (c.kind === "memory") memoryIds.push(c.id.split(":")[0]!)
      else if (c.kind === "joke") jokeIds.push(c.id)
      else if (c.kind === "participant" && c.participantIds[0]) {
        participantIds.add(c.participantIds[0])
      }
    }
    if (inventory.participants.length > 2) {
      const loads = inventory.participants
        .map((p) => ({ id: p.id, n: usedParticipantIds.get(p.id) ?? 0 }))
        .sort((a, b) => a.n - b.n)
      for (const p of loads.slice(0, 2)) participantIds.add(p.id)
    }
    return {
      factIds: [...new Set(factIds)],
      memoryIds: [...new Set(memoryIds)],
      jokeIds: [...new Set(jokeIds)],
      participantIds: [...participantIds],
      interestIds: [] as string[],
    }
  }

  if (gameId === "CROSSWORD_PERSONAL") {
    return collect(
      rank(inventory.crosswordAnswers, (c) => usedFactIds.has(c.id)).slice(0, 10),
    )
  }
  if (gameId === "WORDSEARCH_PERSONAL") {
    return collect(
      rank(inventory.wordsearchWords, (c) => {
        if (c.kind === "fact") return usedFactIds.has(c.id)
        if (c.kind === "memory") return usedMemoryIds.has(c.id.split(":")[0]!)
        return false
      }).slice(0, 12),
    )
  }
  if (gameId === "QUIZ_PERSONAL") {
    return collect(
      rank(inventory.quizFacts, (c) => {
        if (c.kind === "fact") return usedFactIds.has(c.id)
        if (c.kind === "memory") return usedMemoryIds.has(c.id)
        return false
      }).slice(0, 8),
    )
  }
  if (gameId === "TRUE_FALSE_PERSONAL") {
    return collect(
      rank(inventory.trueFalseFacts, (c) => usedFactIds.has(c.id)).slice(0, 8),
    )
  }
  return { factIds: [], memoryIds: [], jokeIds: [], participantIds: [], interestIds: [] }
}

/**
 * Build a deterministic EditorialPlanV1 from a BookProfileV1.
 * No AI, no game content generation.
 */
export function buildEditorialPlan(input: BuildEditorialPlanInput): EditorialPlanV1 {
  const { profile, games, richnessLevel } = input
  const seed = String(input.seed)
  const maxSlots = input.maxSlots ?? DEFAULT_MAX_SLOTS
  const rng = createRng(`editorial:${seed}`)
  const inventory = buildSourceInventory(profile)
  const { eligible, rejected } = evaluateEligibility(profile, inventory, games)

  const selected: EditorialGameSlot[] = []
  const usedFactIds = new Set<string>()
  const usedMemoryIds = new Set<string>()
  const usedJokeIds = new Set<string>()
  const usedParticipantIds = new Map<string, number>()
  const usedUniverses: string[] = []
  let consecutiveAvoided = 0
  let universeRepetitions = 0

  const softRejected = [...rejected]

  while (selected.length < maxSlots) {
    const personalCount = selected.filter((s) => s.personalizationType === "PERSONAL").length
    const themeCount = selected.filter((s) => s.personalizationType === "THEME").length

    const ctxBase: Omit<
      ScoreContext,
      "proposedUniverseId" | "proposedFactIds" | "proposedMemoryIds" | "proposedParticipantIds"
    > = {
      richnessLevel,
      selectedPersonal: personalCount,
      selectedTheme: themeCount,
      selectedGameIds: selected.map((s) => s.gameId),
      selectedEngines: selected.map((s) => s.technicalEngine),
      usedUniverses: [...usedUniverses],
      usedFactIds,
      usedMemoryIds,
      usedParticipantIds,
    }

    type Scored = {
      candidate: (typeof eligible)[number]
      score: number
      universeId: string | null
      sources: ReturnType<typeof pickSources>
    }

    const scored: Scored[] = []

    for (const candidate of eligible) {
      const usedCount = selected.filter((s) => s.gameId === candidate.gameId).length
      if (usedCount >= candidate.maxPerBook) continue

      const universeId =
        candidate.personalizationType === "THEME"
          ? pickUniverse(inventory.interests, usedUniverses, rng)
          : null

      if (candidate.personalizationType === "THEME" && !universeId) continue

      const sources = pickSources(
        inventory,
        candidate.gameId,
        usedFactIds,
        usedMemoryIds,
        usedJokeIds,
        usedParticipantIds,
        rng,
      )

      if (candidate.personalizationType === "THEME") {
        sources.interestIds = universeId ? [universeId] : []
      }

      const score = scoreCandidate(
        candidate,
        {
          ...ctxBase,
          proposedUniverseId: universeId,
          proposedFactIds: sources.factIds,
          proposedMemoryIds: sources.memoryIds,
          proposedParticipantIds: sources.participantIds,
        },
        rng,
      )

      scored.push({ candidate, score, universeId, sources })
    }

    if (!scored.length) break

    scored.sort((a, b) => b.score - a.score)
    let best = scored[0]!

    // If top pick repeats previous gameId and an alternative exists, skip it.
    const lastGameId = selected[selected.length - 1]?.gameId
    if (lastGameId && best.candidate.gameId === lastGameId) {
      const alt = scored.find((s) => s.candidate.gameId !== lastGameId)
      if (alt) {
        best = alt
        consecutiveAvoided += 1
      }
    }

    const templateId = templateForEngine(best.candidate.technicalEngine)
    if (!templateId) {
      softRejected.push({
        gameId: best.candidate.gameId,
        reason: "Template manquant pour le moteur technique.",
      })
      // Remove from eligible to avoid loop
      const idx = eligible.findIndex((e) => e.gameId === best.candidate.gameId)
      if (idx >= 0) eligible.splice(idx, 1)
      continue
    }

    if (
      best.universeId &&
      usedUniverses.includes(best.universeId)
    ) {
      universeRepetitions += 1
    }

    const slotIndex = selected.length + 1
    const slotSeed = `${seed}:slot:${slotIndex}:${best.candidate.gameId}`
    const requirements = buildContentRequirements(
      best.candidate.gameId,
      best.candidate.personalizationType,
      best.universeId,
    )

    const slot: EditorialGameSlot = {
      slotId: `slot_${slotIndex}`,
      gameId: best.candidate.gameId,
      gameName: best.candidate.gameName,
      technicalEngine: best.candidate.technicalEngine,
      personalizationType: best.candidate.personalizationType,
      templateId,
      universeId: best.universeId,
      difficulty: clampDifficulty(profile.gamePreferences.difficulty),
      sourceParticipantIds: best.sources.participantIds,
      sourceMemoryIds: best.sources.memoryIds,
      sourceFactIds: best.sources.factIds,
      sourceInterestIds: best.sources.interestIds,
      sourceJokeIds: best.sources.jokeIds,
      contentRequirements: requirements,
      reason: best.candidate.reason,
      priority: slotIndex,
      seed: slotSeed,
    }

    selected.push(slot)

    for (const id of slot.sourceFactIds) usedFactIds.add(id)
    for (const id of slot.sourceMemoryIds) usedMemoryIds.add(id)
    for (const id of slot.sourceJokeIds) usedJokeIds.add(id)
    for (const id of slot.sourceParticipantIds) {
      usedParticipantIds.set(id, (usedParticipantIds.get(id) ?? 0) + 1)
    }
    if (slot.universeId) usedUniverses.push(slot.universeId)

    // If max_per_book reached, remove from eligible pool
    const count = selected.filter((s) => s.gameId === slot.gameId).length
    if (count >= best.candidate.maxPerBook) {
      const idx = eligible.findIndex((e) => e.gameId === slot.gameId)
      if (idx >= 0) eligible.splice(idx, 1)
    }
  }

  // Remaining eligible not selected
  for (const e of eligible) {
    if (!selected.some((s) => s.gameId === e.gameId)) {
      softRejected.push({
        gameId: e.gameId,
        reason: "Éligible mais non retenu (cap de slots / diversité).",
      })
    }
  }

  const personalCount = selected.filter((s) => s.personalizationType === "PERSONAL").length
  const themeCount = selected.filter((s) => s.personalizationType === "THEME").length
  const slotCount = selected.length

  return {
    version: EDITORIAL_PLAN_VERSION,
    seed,
    profileSummary: {
      audience: profile.audience,
      participantCount: profile.participants.length,
      richnessLevel,
      interestUniverseIds: [...profile.sharedProfile.interestUniverseIds],
      factCount: profile.personalFacts.filter((f) => f.value.trim()).length,
      memoryCount: profile.memories.filter((m) => m.text.trim()).length,
      difficulty: clampDifficulty(profile.gamePreferences.difficulty),
      hasForbiddenTopics: profile.forbiddenTopics.hasRestrictions,
    },
    selectedGames: selected,
    rejectedGames: dedupeRejected(softRejected),
    stats: {
      slotCount,
      personalCount,
      themeCount,
      personalRatio: slotCount ? personalCount / slotCount : 0,
      targetPersonalRatio: targetPersonalRatio(richnessLevel),
      universesUsed: [...new Set(usedUniverses)],
      personalSourcesUsed: {
        factIds: [...usedFactIds],
        memoryIds: [...usedMemoryIds],
        participantIds: [...usedParticipantIds.keys()],
        jokeIds: [...usedJokeIds],
      },
      consecutiveSameGameAvoided: consecutiveAvoided,
      universeRepetitions,
    },
    forbiddenTopics: profile.forbiddenTopics,
  }
}

function dedupeRejected(
  items: { gameId: string; reason: string }[],
): { gameId: string; reason: string }[] {
  const map = new Map<string, string>()
  for (const item of items) {
    if (!map.has(item.gameId)) map.set(item.gameId, item.reason)
  }
  return [...map.entries()].map(([gameId, reason]) => ({ gameId, reason }))
}
