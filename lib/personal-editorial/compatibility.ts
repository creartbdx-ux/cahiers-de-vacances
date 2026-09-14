import type { PersonalBlockV1 } from "./types"
import { categoriesClash } from "./semantic"

function blockId(b: PersonalBlockV1): string {
  return b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId
}

/**
 * Pairwise semantic compatibility in [0, 1].
 * Bonus: shared trip/location/category/tags.
 * Penalty: clear category clash that a themed page would falsely link.
 */
export function semanticCompatibilityScore(
  a: PersonalBlockV1,
  b: PersonalBlockV1,
): number {
  let score = 0.45 // neutral baseline

  if (a.semanticCategory === b.semanticCategory && a.semanticCategory !== "OTHER") {
    score += 0.18
  }

  const locOverlap = a.locations.filter((l) =>
    b.locations.some((x) => x.toLowerCase() === l.toLowerCase()),
  )
  if (locOverlap.length) score += 0.2

  const tripOverlap = a.trips.filter((t) =>
    b.trips.some((x) => x.toLowerCase() === t.toLowerCase()),
  )
  if (tripOverlap.length) score += 0.22

  const tagOverlap = a.semanticTags.filter((t) => b.semanticTags.includes(t))
  if (tagOverlap.length) score += 0.08 * Math.min(2, tagOverlap.length)

  // Explicit Australia trip + Tokyo escale: both travel + voyage/escale tags
  const travelBridge =
    a.semanticCategory === "TRAVEL" &&
    b.semanticCategory === "TRAVEL" &&
    (a.semanticTags.includes("voyage") || a.trips.length > 0) &&
    (b.semanticTags.includes("escale") ||
      b.locations.some((l) => /tokyo|japon/i.test(l)) ||
      a.locations.some((l) => /tokyo|japon/i.test(l)))
  if (travelBridge) score += 0.12

  if (categoriesClash(a.semanticCategory, b.semanticCategory)) {
    score -= 0.35
  }

  // Participant overlap slight bonus
  const partOverlap = a.participantIds.filter((id) => b.participantIds.includes(id))
  if (partOverlap.length) score += 0.05

  return Math.max(0, Math.min(1, score))
}

export function groupCompatibilityScore(blocks: PersonalBlockV1[]): number {
  if (blocks.length <= 1) return 1
  let sum = 0
  let n = 0
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      sum += semanticCompatibilityScore(blocks[i]!, blocks[j]!)
      n++
    }
  }
  return n ? sum / n : 1
}

/** True when the group should NOT claim a thematic title. */
export function isNeutralGrouping(blocks: PersonalBlockV1[]): boolean {
  if (blocks.length <= 1) return false
  return groupCompatibilityScore(blocks) < 0.55
}

export function groupSourceIds(blocks: PersonalBlockV1[]): string[] {
  return blocks.map(blockId)
}
