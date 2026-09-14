import type { VisualRole } from "@/lib/book-blueprint/types"
import {
  isHeroLayout,
  layoutPreferenceRank,
  pickEditorialFamily,
  pickPersonalEditorialLayout,
} from "./layouts"
import type { PersonalBlockV1, PersonalEditorialPageV1 } from "./types"
import {
  PERSONAL_PAGE_CAPACITY,
  PERSONAL_PAGE_MAX_BLOCKS,
  PERSONAL_PAGE_MAX_PHOTOS,
} from "./types"
import {
  blockWeight,
  heroReasonForBlock,
  isTrueHeroCandidate,
  pageFillScore,
  photoCount,
  totalWeight,
} from "./weights"
import {
  groupCompatibilityScore,
  isNeutralGrouping,
  semanticCompatibilityScore,
} from "./compatibility"
import { buildPageTheme } from "./theme"
import { categoriesClash } from "./semantic"

const VISUAL_ROLES: VisualRole[] = ["LIGHT", "SECONDARY", "ACCENT", "NEUTRAL"]
const SEARCH_LIMIT = 12

function blockId(b: PersonalBlockV1): string {
  return b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId
}

export function canAddBlock(
  current: PersonalBlockV1[],
  candidate: PersonalBlockV1,
): boolean {
  if (current.length >= PERSONAL_PAGE_MAX_BLOCKS) return false
  if (
    candidate.type === "PHOTO_MEMORY" &&
    photoCount(current) >= PERSONAL_PAGE_MAX_PHOTOS
  ) {
    return false
  }
  if (totalWeight(current) + blockWeight(candidate) > PERSONAL_PAGE_CAPACITY) {
    return false
  }
  if (isTrueHeroCandidate(candidate) && candidate.type === "PHOTO_MEMORY") {
    return current.length === 0
  }
  if (current.some((b) => isTrueHeroCandidate(b) && b.type === "PHOTO_MEMORY")) {
    return false
  }
  if (isTrueHeroCandidate(candidate) && candidate.type === "MEMORY") {
    return current.length === 0 || (current.length === 1 && blockWeight(current[0]!) <= 1)
  }
  if (current.some((b) => isTrueHeroCandidate(b) && b.type === "MEMORY")) {
    return blockWeight(candidate) <= 1 && current.length < 2
  }
  return true
}

function groupIsValid(blocks: PersonalBlockV1[]): boolean {
  if (!blocks.length || blocks.length > PERSONAL_PAGE_MAX_BLOCKS) return false
  if (photoCount(blocks) > PERSONAL_PAGE_MAX_PHOTOS) return false
  if (totalWeight(blocks) > PERSONAL_PAGE_CAPACITY) return false
  const acc: PersonalBlockV1[] = []
  for (const b of blocks) {
    if (!canAddBlock(acc, b)) return false
    acc.push(b)
  }
  return true
}

function stableSortIds(blocks: PersonalBlockV1[]): PersonalBlockV1[] {
  return [...blocks].sort((a, b) => blockId(a).localeCompare(blockId(b)))
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function makePage(
  blocks: PersonalBlockV1[],
  seed: string,
  index: number,
): PersonalEditorialPageV1 {
  const ordered = stableSortIds(blocks)
  const layoutId = pickPersonalEditorialLayout(ordered)
  const isHero = isHeroLayout(layoutId)
  const editorialFamily = pickEditorialFamily(ordered, layoutId)
  const theme = buildPageTheme(ordered, {
    isHero,
    isSingle:
      layoutId === "SINGLE_MEMORY" || layoutId === "SINGLE_PHOTO_MEMORY",
  })
  const roleIndex =
    Math.abs(hash(`${seed}:page:${index}:${layoutId}`)) % VISUAL_ROLES.length
  const fill = pageFillScore(ordered)
  const heroReason =
    isHero && ordered.length === 1 ? heroReasonForBlock(ordered[0]!) : null
  const layoutVariant =
    layoutId === "PHOTO_PLUS_MEMORY"
      ? Math.abs(hash(`${seed}:ppm-variant:${index}`)) % 2 === 0
        ? "STACK"
        : "ASYMMETRIC"
      : null
  return {
    pageKey: `pep:${seed}:${index}`,
    layoutId,
    editorialFamily,
    theme,
    blocks: ordered,
    visualRole: VISUAL_ROLES[roleIndex]!,
    weight: totalWeight(ordered),
    packingFillScore: fill,
    pageFillScore: fill,
    isHero,
    heroReason,
    layoutVariant,
    compatibilityScore: groupCompatibilityScore(ordered),
  }
}

/**
 * Priorities: provenance → editorial coherence → readability → visual fill → page economy.
 */
function scoreComposition(groups: PersonalBlockV1[][], seed: string): number {
  let score = 0
  const layouts = groups.map((g) => pickPersonalEditorialLayout(stableSortIds(g)))

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!
    const fill = pageFillScore(g)
    const fillPct = fill * 100
    const layout = layouts[i]!
    const compat = groupCompatibilityScore(g)

    score += compat * 80
    if (compat >= 0.7) score += 25
    else if (compat < 0.45 && g.length > 1) score -= 45

    for (let a = 0; a < g.length; a++) {
      for (let b = a + 1; b < g.length; b++) {
        if (categoriesClash(g[a]!.semanticCategory, g[b]!.semanticCategory)) {
          score -= 40
        }
        score += (semanticCompatibilityScore(g[a]!, g[b]!) - 0.45) * 20
      }
    }

    if (fillPct >= 60) score += 12
    else if (fillPct < 40 && !isHeroLayout(layout)) score -= 20

    const hasPhoto = g.some((b) => b.type === "PHOTO_MEMORY")
    const hasMemory = g.some((b) => b.type === "MEMORY")
    if (hasPhoto && hasMemory && compat >= 0.5) score += 16

    score += (4 - layoutPreferenceRank(layout)) * 2

    if (layout === "PHOTO_PLUS_TWO_SNIPPETS" && compat >= 0.55) score += 30
    if (layout === "PHOTO_PLUS_MEMORY" && compat >= 0.5) score += 12
    if (g.length > 1 && isNeutralGrouping(g)) score += 4

    if (g.length === 1) {
      const alone = g[0]!
      if (isTrueHeroCandidate(alone)) score += 10
      else if (alone.density === "SHORT") score -= 55
      else if (alone.density === "MEDIUM") score -= 30
      else score -= 15
    } else {
      score += g.length * 4
    }
  }

  score -= layouts.filter((l) => isHeroLayout(l)).length * 20
  score -=
    layouts.filter((l) => l === "SINGLE_MEMORY" || l === "SINGLE_PHOTO_MEMORY")
      .length * 20

  for (let i = 1; i < layouts.length; i++) {
    if (isHeroLayout(layouts[i - 1]!) && isHeroLayout(layouts[i]!)) score -= 30
  }

  // Page economy last and lighter — coherence > compression
  score -= groups.length * 12
  score += (hash(`${seed}:${groups.length}:${layouts.join(",")}`) % 7) * 0.01
  return score
}

function bestPartitionSearch(
  blocks: PersonalBlockV1[],
  seed: string,
): PersonalBlockV1[][] {
  const ordered = stableSortIds(blocks)
  const memo = new Map<string, { groups: PersonalBlockV1[][]; score: number }>()
  let nodes = 0
  const MAX_NODES = 80_000

  function keyOf(remaining: PersonalBlockV1[]): string {
    return remaining.map(blockId).join("\0")
  }

  function bestFor(remaining: PersonalBlockV1[]): {
    groups: PersonalBlockV1[][]
    score: number
  } {
    if (!remaining.length) return { groups: [], score: scoreComposition([], seed) }
    const k = keyOf(remaining)
    const hit = memo.get(k)
    if (hit) return hit
    if (++nodes > MAX_NODES) {
      const g = greedyPack(remaining, `${seed}:overflow`)
      const result = { groups: g, score: scoreComposition(g, seed) }
      memo.set(k, result)
      return result
    }

    const head = remaining[0]!
    const rest = remaining.slice(1)
    const candidates: PersonalBlockV1[][] = [[head]]

    for (let i = 0; i < rest.length; i++) {
      const a = rest[i]!
      if (groupIsValid([head, a])) candidates.push([head, a])
      for (let j = i + 1; j < rest.length; j++) {
        const b = rest[j]!
        if (groupIsValid([head, a, b])) candidates.push([head, a, b])
      }
    }

    candidates.sort((x, y) => {
      const cx = groupCompatibilityScore(x) + pageFillScore(x) * 0.3
      const cy = groupCompatibilityScore(y) + pageFillScore(y) * 0.3
      if (Math.abs(cy - cx) > 0.01) return cy > cx ? 1 : -1
      return y.length - x.length
    })

    let bestLocal: { groups: PersonalBlockV1[][]; score: number } | null = null
    for (const group of candidates) {
      const ids = new Set(group.map(blockId))
      const nextRem = remaining.filter((b) => !ids.has(blockId(b)))
      const sub = bestFor(nextRem)
      const groups = [group, ...sub.groups]
      const score = scoreComposition(groups, seed)
      if (!bestLocal || score > bestLocal.score) bestLocal = { groups, score }
    }

    const result = bestLocal ?? { groups: remaining.map((b) => [b]), score: -Infinity }
    memo.set(k, result)
    return result
  }

  return bestFor(ordered).groups
}

function greedyPack(blocks: PersonalBlockV1[], seed: string): PersonalBlockV1[][] {
  const remaining = stableSortIds(blocks)
  remaining.sort((a, b) => {
    const dw = blockWeight(b) - blockWeight(a)
    if (dw !== 0) return dw
    return blockId(a).localeCompare(blockId(b))
  })

  const groups: PersonalBlockV1[][] = []
  while (remaining.length) {
    const pageBlocks: PersonalBlockV1[] = [remaining.shift()!]
    let progressed = true
    while (progressed && pageBlocks.length < PERSONAL_PAGE_MAX_BLOCKS) {
      progressed = false
      let bestIdx = -1
      let bestScore = -Infinity
      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i]!
        if (!canAddBlock(pageBlocks, cand)) continue
        const trial = [...pageBlocks, cand]
        const s = groupCompatibilityScore(trial) * 2 + pageFillScore(trial)
        if (s > bestScore) {
          bestScore = s
          bestIdx = i
        }
      }
      if (bestIdx >= 0) {
        pageBlocks.push(remaining.splice(bestIdx, 1)[0]!)
        progressed = true
      }
    }
    void seed
    groups.push(pageBlocks)
  }
  return groups
}

/**
 * Pack editorialized blocks into pages.
 * Deterministic. Coherence before compression.
 */
export function composePersonalEditorialPages(
  blocks: PersonalBlockV1[],
  seed: string,
): PersonalEditorialPageV1[] {
  if (!blocks.length) return []

  const groups =
    blocks.length <= SEARCH_LIMIT
      ? bestPartitionSearch(blocks, seed)
      : greedyPack(blocks, seed)

  const absorbed = absorbNonHeroOrphans(groups)
  const reordered = avoidConsecutiveHeroes(absorbed)
  return reordered.map((g, i) => makePage(g, seed, i))
}

function absorbNonHeroOrphans(groups: PersonalBlockV1[][]): PersonalBlockV1[][] {
  const out = groups.map((g) => [...g])
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < out.length; i++) {
      const g = out[i]!
      if (g.length !== 1) continue
      const alone = g[0]!
      if (isTrueHeroCandidate(alone)) continue
      let bestJ = -1
      let bestScore = -Infinity
      for (let j = 0; j < out.length; j++) {
        if (i === j) continue
        if (!canAddBlock(out[j]!, alone)) continue
        const trial = [...out[j]!, alone]
        let s = groupCompatibilityScore(trial) + pageFillScore(trial) * 0.4
        const layout = pickPersonalEditorialLayout(stableSortIds(trial))
        if (layout === "PHOTO_PLUS_TWO_SNIPPETS") s += 0.3
        // Don't absorb into a strongly clashing page
        if (groupCompatibilityScore(trial) < 0.35) continue
        if (s > bestScore) {
          bestScore = s
          bestJ = j
        }
      }
      if (bestJ >= 0) {
        out[bestJ] = [...out[bestJ]!, alone]
        out.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return out
}

function avoidConsecutiveHeroes(groups: PersonalBlockV1[][]): PersonalBlockV1[][] {
  const out = groups.map((g) => [...g])
  for (let i = 1; i < out.length; i++) {
    const prevHero = out[i - 1]!.length === 1 && isTrueHeroCandidate(out[i - 1]![0]!)
    const curHero = out[i]!.length === 1 && isTrueHeroCandidate(out[i]![0]!)
    if (prevHero && curHero) {
      for (let j = i + 1; j < out.length; j++) {
        const jHero = out[j]!.length === 1 && isTrueHeroCandidate(out[j]![0]!)
        if (!jHero) {
          const tmp = out[i]!
          out[i] = out[j]!
          out[j] = tmp
          break
        }
      }
    }
  }
  return out
}

export function estimatePersonalEditorialPageCount(
  blocks: PersonalBlockV1[],
  seed: string,
): number {
  return composePersonalEditorialPages(blocks, seed).length
}

export function pageProvenance(page: PersonalEditorialPageV1): {
  sourceMemoryIds: string[]
  sourcePhotoIds: string[]
} {
  const sourceMemoryIds: string[] = []
  const sourcePhotoIds: string[] = []
  for (const b of page.blocks) {
    if (b.type === "MEMORY") sourceMemoryIds.push(b.sourceMemoryId)
    else sourcePhotoIds.push(b.sourcePhotoId)
  }
  return { sourceMemoryIds, sourcePhotoIds }
}
