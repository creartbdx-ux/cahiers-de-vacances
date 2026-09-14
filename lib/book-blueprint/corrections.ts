import { getArchetype, MAX_CORRECTION_PAGE_DENSITY } from "./archetypes"

export type CorrectionNeed = {
  gameSlotId: string
  weight: number
  label: string
  gameId?: string
}

export type PackedCorrectionPage = {
  corrects: string[]
  totalWeight: number
  reason: string
}

/**
 * Pack game corrections into compact pages.
 * Never 1 game = 1 full correction page.
 */
export function packCorrections(needs: CorrectionNeed[]): PackedCorrectionPage[] {
  if (!needs.length) return []

  const pages: PackedCorrectionPage[] = []
  let current: PackedCorrectionPage = { corrects: [], totalWeight: 0, reason: "" }

  for (const need of needs) {
    const would = current.totalWeight + need.weight
    if (current.corrects.length > 0 && would > MAX_CORRECTION_PAGE_DENSITY) {
      current.reason = `Corrections compactes (${current.corrects.length} jeux)`
      pages.push(current)
      current = { corrects: [], totalWeight: 0, reason: "" }
    }
    current.corrects.push(need.gameSlotId)
    current.totalWeight += need.weight
  }

  if (current.corrects.length) {
    current.reason = `Corrections compactes (${current.corrects.length} jeux)`
    pages.push(current)
  }

  return pages
}

export function correctionWeightForArchetype(archetypeId: string): number {
  return getArchetype(archetypeId).correctionWeight
}
