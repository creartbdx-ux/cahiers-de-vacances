import type { PersonalBlockV1 } from "./types"
import {
  blockPairCompatibility,
  groupEditorialCompatibility,
  type EditorialRelationLevel,
  type SourceRelation,
} from "./relations"

export type { EditorialRelationLevel, SourceRelation }

function blockId(b: PersonalBlockV1): string {
  return b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId
}

/**
 * Pairwise semantic compatibility in [0, 1], derived from editorial relations.
 * STRONG ≫ NEUTRAL ≫ CONFLICT. Same participants alone stay NEUTRAL (~0.5).
 */
export function semanticCompatibilityScore(
  a: PersonalBlockV1,
  b: PersonalBlockV1,
): number {
  const { level } = blockPairCompatibility(a, b)
  if (level === "STRONG") return 0.88
  if (level === "CONFLICT") return 0.08
  return 0.5
}

export function pairRelationLevel(
  a: PersonalBlockV1,
  b: PersonalBlockV1,
): EditorialRelationLevel {
  return blockPairCompatibility(a, b).level
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

export function groupRelationMeta(blocks: PersonalBlockV1[]): {
  level: EditorialRelationLevel
  reason: string
  relations: SourceRelation[]
} {
  return groupEditorialCompatibility(blocks)
}

/** True when the group should NOT claim a thematic title. */
export function isNeutralGrouping(blocks: PersonalBlockV1[]): boolean {
  if (blocks.length <= 1) return false
  return groupRelationMeta(blocks).level === "NEUTRAL"
}

/** Groups containing a CONFLICT pair must never be packed. */
export function groupHasConflict(blocks: PersonalBlockV1[]): boolean {
  if (blocks.length <= 1) return false
  return groupRelationMeta(blocks).level === "CONFLICT"
}

export function groupSourceIds(blocks: PersonalBlockV1[]): string[] {
  return blocks.map(blockId)
}
