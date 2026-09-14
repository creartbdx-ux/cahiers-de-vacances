import type { VisualRole } from "@/lib/book-blueprint/types"
import {
  isHeroLayout,
  layoutPreferenceRank,
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
  // True RICH photo hero: alone only (don't crush with companions)
  if (isTrueHeroCandidate(candidate) && candidate.type === "PHOTO_MEMORY") {
    return current.length === 0
  }
  if (current.some((b) => isTrueHeroCandidate(b) && b.type === "PHOTO_MEMORY")) {
    return false
  }
  // True RICH memory: alone, or with at most one SHORT companion if capacity allows
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
  // Rebuild incrementally to reuse canAdd rules
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
  const roleIndex =
    Math.abs(hash(`${seed}:page:${index}:${layoutId}`)) % VISUAL_ROLES.length
  let heroReason: string | null = null
  if (isHero && ordered.length === 1) {
    heroReason = heroReasonForBlock(ordered[0]!) ?? "Raison HERO : bloc isolé (aucune combinaison restante)"
  }
  return {
    pageKey: `pep:${seed}:${index}`,
    layoutId,
    blocks: ordered,
    visualRole: VISUAL_ROLES[roleIndex]!,
    weight: totalWeight(ordered),
    pageFillScore: pageFillScore(ordered),
    isHero,
    heroReason,
  }
}

function scoreComposition(groups: PersonalBlockV1[][], seed: string): number {
  let score = 0
  const layouts = groups.map((g) => pickPersonalEditorialLayout(stableSortIds(g)))

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!
    const fill = pageFillScore(g)
    const fillPct = fill * 100
    const layout = layouts[i]!

    if (fillPct >= 70 && fillPct <= 90) score += 35
    else if (fillPct > 90 && fillPct <= 100) score += 28
    else if (fillPct >= 60) score += 12
    else score -= 55

    const hasPhoto = g.some((b) => b.type === "PHOTO_MEMORY")
    const hasMemory = g.some((b) => b.type === "MEMORY")
    if (hasPhoto && hasMemory) score += 18

    score += (4 - layoutPreferenceRank(layout)) * 3

    if (g.length === 1) {
      const alone = g[0]!
      if (isTrueHeroCandidate(alone)) {
        score += 8
      } else if (alone.density === "SHORT") {
        score -= 90
      } else if (alone.density === "MEDIUM") {
        score -= 55
      } else {
        score -= 25
      }
    } else {
      score += g.length * 6
    }
  }

  const heroCount = layouts.filter((l) => isHeroLayout(l)).length
  score -= heroCount * 30

  for (let i = 1; i < layouts.length; i++) {
    if (isHeroLayout(layouts[i - 1]!) && isHeroLayout(layouts[i]!)) score -= 40
    if (layouts[i] === layouts[i - 1] && !isHeroLayout(layouts[i]!)) score -= 8
  }

  const uniqueLayouts = new Set(layouts).size
  score += uniqueLayouts * 4

  // Prefer fewer pages (print efficiency)
  score -= groups.length * 22

  // Tiny seed-stable tie-break
  score += (hash(`${seed}:${groups.length}:${layouts.join(",")}`) % 7) * 0.01

  return score
}

/**
 * Enumerate partitions for small n — compose first, isolate last.
 */
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
      // Fallback slice: greedy from here
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

    // Prefer fuller groups when exploring (still evaluate all)
    candidates.sort((x, y) => {
      const fd = pageFillScore(y) - pageFillScore(x)
      if (Math.abs(fd) > 0.01) return fd > 0 ? 1 : -1
      return y.length - x.length
    })

    let bestLocal: { groups: PersonalBlockV1[][]; score: number } | null = null

    for (const group of candidates) {
      const ids = new Set(group.map(blockId))
      const nextRem = remaining.filter((b) => !ids.has(blockId(b)))
      const sub = bestFor(nextRem)
      const groups = [group, ...sub.groups]
      const score = scoreComposition(groups, seed)
      if (!bestLocal || score > bestLocal.score) {
        bestLocal = { groups, score }
      }
    }

    const result = bestLocal ?? { groups: remaining.map((b) => [b]), score: -Infinity }
    memo.set(k, result)
    return result
  }

  return bestFor(ordered).groups
}

/**
 * Greedy fallback for larger sets: pack for fill, never force HERO from fullPageRecommended.
 */
function greedyPack(blocks: PersonalBlockV1[], seed: string): PersonalBlockV1[][] {
  const remaining = stableSortIds(blocks)
  // Heavier first for packing density
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
      // Prefer candidate that maximizes resulting fill without exceeding
      let bestIdx = -1
      let bestFill = pageFillScore(pageBlocks)
      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i]!
        if (!canAddBlock(pageBlocks, cand)) continue
        const trial = [...pageBlocks, cand]
        const fill = pageFillScore(trial)
        if (fill > bestFill || (fill === bestFill && bestIdx < 0)) {
          bestFill = fill
          bestIdx = i
        }
      }
      if (bestIdx >= 0) {
        pageBlocks.push(remaining.splice(bestIdx, 1)[0]!)
        progressed = true
      }
    }
    // If fill < 60% and remaining items could have helped but didn't fit this group,
    // leave as-is — next iteration packs them.
    void seed
    groups.push(pageBlocks)
  }
  return groups
}

/**
 * Pack personal editorial blocks into composite pages.
 * Deterministic. No IA. Compose first; HERO only for true RICH content or leftovers.
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

  // Soft reorder: avoid consecutive heroes when a swap helps (stable, local)
  const reordered = avoidConsecutiveHeroes(groups)

  return reordered.map((g, i) => makePage(g, seed, i))
}

function avoidConsecutiveHeroes(groups: PersonalBlockV1[][]): PersonalBlockV1[][] {
  const out = groups.map((g) => [...g])
  for (let i = 1; i < out.length; i++) {
    const prevHero = out[i - 1]!.length === 1 && isTrueHeroCandidate(out[i - 1]![0]!)
    const curHero = out[i]!.length === 1 && isTrueHeroCandidate(out[i]![0]!)
    if (prevHero && curHero) {
      // swap with next non-hero if any
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
