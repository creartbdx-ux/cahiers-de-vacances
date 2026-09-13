/**
 * Deterministic seeded pseudo-random generator.
 *
 * The engine NEVER calls Math.random(). All randomness flows through a seeded
 * PRNG so the same entries + same seed always produce exactly the same grid.
 * We use xmur3 to hash the string seed into a 32-bit state and mulberry32 as
 * the generator — both are tiny, well-known, and fully deterministic.
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [0, max). */
  int(max: number): number
  /** Returns a new deterministic shuffle of the array (does not mutate input). */
  shuffle<T>(arr: readonly T[]): T[]
}

export function createRng(seed: string | number): Rng {
  const seedStr = String(seed)
  const seedFn = xmur3(seedStr)
  const rand = mulberry32(seedFn())

  const next = () => rand()
  const int = (max: number) => Math.floor(rand() * max)
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const copy = arr.slice()
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  return { next, int, shuffle }
}
