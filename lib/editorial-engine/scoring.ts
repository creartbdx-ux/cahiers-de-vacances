import type { Rng } from "@/lib/game-engines/random"
import type { RichnessLevel } from "@/lib/questionnaire/types"
import type { EligibilityResult } from "./eligibility"
import { targetPersonalRatio } from "./requirements"

export interface ScoreContext {
  richnessLevel: RichnessLevel
  selectedPersonal: number
  selectedTheme: number
  selectedGameIds: string[]
  selectedEngines: string[]
  usedUniverses: string[]
  usedFactIds: Set<string>
  usedMemoryIds: Set<string>
  usedParticipantIds: Map<string, number>
  proposedUniverseId: string | null
  proposedFactIds: string[]
  proposedMemoryIds: string[]
  proposedParticipantIds: string[]
}

/**
 * Higher is better. Includes diversity / ratio / reuse penalties.
 */
export function scoreCandidate(
  candidate: EligibilityResult,
  ctx: ScoreContext,
  rng: Rng,
): number {
  let score = 50 + candidate.strength * 40

  const selected = ctx.selectedPersonal + ctx.selectedTheme
  const target = targetPersonalRatio(ctx.richnessLevel)
  const currentPersonalRatio = selected === 0 ? target : ctx.selectedPersonal / selected

  if (candidate.personalizationType === "PERSONAL") {
    if (currentPersonalRatio < target) score += 18
    else if (currentPersonalRatio > target + 0.15) score -= 22
    else score += 6
  } else {
    if (currentPersonalRatio > target) score += 16
    else if (currentPersonalRatio < target - 0.15) score -= 10
    else score += 4
  }

  // Never push toward 100% personal even on RICH.
  if (
    candidate.personalizationType === "PERSONAL" &&
    selected >= 2 &&
    ctx.selectedTheme === 0
  ) {
    score -= 25
  }

  const lastGame = ctx.selectedGameIds[ctx.selectedGameIds.length - 1]
  const lastEngine = ctx.selectedEngines[ctx.selectedEngines.length - 1]
  if (lastGame === candidate.gameId) score -= 80
  if (lastEngine === candidate.technicalEngine) score -= 28

  const alreadyCount = ctx.selectedGameIds.filter((id) => id === candidate.gameId).length
  if (alreadyCount >= candidate.maxPerBook) score -= 1000

  if (candidate.personalizationType === "THEME" && ctx.proposedUniverseId) {
    const repeats = ctx.usedUniverses.filter((u) => u === ctx.proposedUniverseId).length
    score -= repeats * 18
    if (!ctx.usedUniverses.includes(ctx.proposedUniverseId)) score += 12
  }

  // Source reuse penalty
  for (const id of ctx.proposedFactIds) {
    if (ctx.usedFactIds.has(id)) score -= 8
  }
  for (const id of ctx.proposedMemoryIds) {
    if (ctx.usedMemoryIds.has(id)) score -= 8
  }

  // GROUP/DUO balance: prefer less-used participants
  if (ctx.proposedParticipantIds.length) {
    const loads = ctx.proposedParticipantIds.map((id) => ctx.usedParticipantIds.get(id) ?? 0)
    const avg = loads.reduce((a, b) => a + b, 0) / loads.length
    score -= avg * 6
  }

  // Tiny deterministic jitter so close scores can vary by seed
  score += rng.next() * 4

  return score
}

export function pickUniverse(
  interests: string[],
  usedUniverses: string[],
  rng: Rng,
): string | null {
  if (!interests.length) return null
  const fresh = interests.filter((id) => !usedUniverses.includes(id))
  const pool = fresh.length ? fresh : interests
  return pool[rng.int(pool.length)] ?? null
}
