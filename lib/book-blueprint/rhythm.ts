import type { PageDensity } from "./types"

export type RhythmPageView = {
  family: string
  archetypeId: string
  density: PageDensity
  technicalEngine?: string
  universeId?: string | null
  gameId?: string
}

/** Hard-ish rhythm constraints used by scoring and local repair. */
export function violatesPhotoConsecutive(prev: RhythmPageView | null, next: RhythmPageView): boolean {
  return prev?.family === "PHOTO" && next.family === "PHOTO"
}

export function violatesMemoryConsecutive(prev: RhythmPageView | null, next: RhythmPageView): boolean {
  return prev?.family === "MEMORY" && next.family === "MEMORY"
}

export function consecutiveHeavyCount(history: RhythmPageView[]): number {
  let n = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.density !== "HEAVY") break
    n++
  }
  return n
}

export function sameEngineStreak(history: RhythmPageView[], engine?: string): number {
  if (!engine) return 0
  let n = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.technicalEngine !== engine) break
    n++
  }
  return n
}

export function denseGameStreak(history: RhythmPageView[]): number {
  let n = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const f = history[i]!.family
    if (f !== "THEME_GAME" && f !== "PERSONAL_GAME") break
    if (history[i]!.density === "LIGHT") break
    n++
  }
  return n
}

/**
 * Local repair: swap adjacent violating pairs when a safer swap exists.
 * Deterministic — only swaps i with i+1 when a clear improvement.
 */
export function repairRhythmSequence<T extends RhythmPageView>(pages: T[]): T[] {
  const out = pages.slice()
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i]!
      const b = out[i + 1]!
      const badPhoto = a.family === "PHOTO" && b.family === "PHOTO"
      const badMemory = a.family === "MEMORY" && b.family === "MEMORY"
      const badHeavy =
        a.density === "HEAVY" &&
        b.density === "HEAVY" &&
        i > 0 &&
        out[i - 1]!.density === "HEAVY"
      if (!badPhoto && !badMemory && !badHeavy) continue

      // Find a later page to swap with b
      for (let j = i + 2; j < Math.min(out.length, i + 8); j++) {
        const c = out[j]!
        if (badPhoto && c.family !== "PHOTO") {
          ;[out[i + 1], out[j]] = [out[j]!, out[i + 1]!]
          break
        }
        if (badMemory && c.family !== "MEMORY") {
          ;[out[i + 1], out[j]] = [out[j]!, out[i + 1]!]
          break
        }
        if (badHeavy && c.density !== "HEAVY") {
          ;[out[i + 1], out[j]] = [out[j]!, out[i + 1]!]
          break
        }
      }
    }
  }
  return out
}
