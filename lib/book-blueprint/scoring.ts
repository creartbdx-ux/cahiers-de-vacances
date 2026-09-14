import type { Rng } from "@/lib/game-engines/random"
import {
  consecutiveHeavyCount,
  denseGameStreak,
  sameEngineStreak,
  type RhythmPageView,
} from "./rhythm"
import type { ImplementationStatus, PageArchetype } from "./types"

export type ScoredIntent = {
  archetype: PageArchetype
  universeId?: string | null
  participantIds?: string[]
  sourceNeeds?: string[]
  reason: string
  /** Temporary id before final slotId assignment. */
  tempId: string
  /** Optional override (e.g. weak photo chain => PARTIAL). */
  implementationStatusOverride?: ImplementationStatus
  personalLayoutId?: string
  sourceMemoryIds?: string[]
  sourcePhotoIds?: string[]
}

/**
 * Score a candidate intent given recent history. Higher = better.
 * Soft penalties — planner picks among top scores with RNG.
 */
export function scoreIntentPlacement(
  candidate: ScoredIntent,
  history: RhythmPageView[],
  universeUsage: Map<string, number>,
): number {
  const prev = history[history.length - 1] ?? null
  const a = candidate.archetype
  let score = 100

  if (prev?.family === "PHOTO" && a.family === "PHOTO") score -= 120
  if (prev?.family === "MEMORY" && a.family === "MEMORY") score -= 120
  if (prev?.family === "PERSONAL_EDITORIAL" && a.family === "PERSONAL_EDITORIAL") score -= 50
  if (prev?.archetypeId === a.id) score -= 40
  if (prev?.technicalEngine && a.technicalEngine && prev.technicalEngine === a.technicalEngine) {
    score -= 55
  }
  if (sameEngineStreak(history, a.technicalEngine) >= 1 && a.technicalEngine) score -= 25

  if (a.estimatedDensity === "HEAVY" && consecutiveHeavyCount(history) >= 2) score -= 90
  if (a.estimatedDensity === "HEAVY" && consecutiveHeavyCount(history) >= 1) score -= 35

  if (denseGameStreak(history) >= 2 && (a.family === "THEME_GAME" || a.family === "PERSONAL_GAME")) {
    score -= 45
  }
  if (
    denseGameStreak(history) >= 2 &&
    (a.family === "MEMORY" || a.family === "PHOTO" || a.family === "BREATHER" || a.family === "QUICK_GAME")
  ) {
    score += 35
  }

  // Universe rotation
  const uid = candidate.universeId
  if (uid) {
    const used = universeUsage.get(uid) ?? 0
    score -= used * 12
    if (prev?.universeId === uid) score -= 28
  }

  // Prefer light after heavy
  if (prev?.density === "HEAVY" && a.estimatedDensity === "LIGHT") score += 20
  if (prev?.density === "HEAVY" && a.estimatedDensity === "HEAVY") score -= 40

  // Spread personal content
  if (a.personalizationType === "PERSONAL") {
    const recentPersonal = history.slice(-4).filter((h) =>
      ["MEMORY", "PHOTO", "PERSONAL_GAME"].includes(h.family),
    ).length
    if (recentPersonal >= 2) score -= 25
    else score += 10
  }

  return score
}

/** Pick among candidates within a soft score band of the best. */
export function pickScoredIntent(
  candidates: ScoredIntent[],
  history: RhythmPageView[],
  universeUsage: Map<string, number>,
  rng: Rng,
): ScoredIntent {
  if (!candidates.length) throw new Error("No blueprint candidates left")
  const scored = candidates.map((c) => ({
    c,
    s: scoreIntentPlacement(c, history, universeUsage),
  }))
  scored.sort((a, b) => b.s - a.s)
  const best = scored[0]!.s
  const band = scored.filter((x) => x.s >= best - 18)
  return band[rng.int(band.length)]!.c
}

export const VISUAL_ROLE_CYCLE = [
  "PRIMARY",
  "LIGHT",
  "SECONDARY",
  "NEUTRAL",
  "ACCENT",
  "LIGHT",
  "PRIMARY",
  "NEUTRAL",
  "SECONDARY",
  "ACCENT",
] as const

export function assignVisualRoles(
  count: number,
  seedHash: number,
): Array<"PRIMARY" | "SECONDARY" | "ACCENT" | "LIGHT" | "NEUTRAL"> {
  const roles: Array<"PRIMARY" | "SECONDARY" | "ACCENT" | "LIGHT" | "NEUTRAL"> = []
  let offset = seedHash % VISUAL_ROLE_CYCLE.length
  for (let i = 0; i < count; i++) {
    let role = VISUAL_ROLE_CYCLE[(offset + i) % VISUAL_ROLE_CYCLE.length]!
    // Avoid 3 identical consecutive roles
    if (roles.length >= 2 && roles[roles.length - 1] === role && roles[roles.length - 2] === role) {
      role = VISUAL_ROLE_CYCLE[(offset + i + 3) % VISUAL_ROLE_CYCLE.length]!
    }
    roles.push(role)
  }
  return roles
}
