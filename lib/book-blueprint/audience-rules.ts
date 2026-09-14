import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import {
  collectPersonalBlocks,
  composePersonalEditorialPages,
} from "@/lib/personal-editorial"
import type { CompositionTargets } from "./types"

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function countUsablePhotos(profile: BookProfileV1): number {
  return (profile.photos ?? []).filter((p) => p.useAuthorized).length
}

function countMemories(profile: BookProfileV1): number {
  return (profile.memories ?? []).filter((m) => m.text?.trim()).length
}

/**
 * Soft composition targets for ~50 interior pages.
 * Photo/memory slots = block budgets; personalEditorialSlots = real pages after packing.
 */
export function resolveCompositionTargets(input: {
  profile: BookProfileV1
  richnessLevel: RichnessLevel
  targetInteriorPages: number
  /** Seed used to estimate packed personal pages deterministically. */
  seed?: string
}): CompositionTargets {
  const { profile, richnessLevel, targetInteriorPages: N } = input
  const scale = N / 50
  const audience = profile.audience
  const photos = countUsablePhotos(profile)
  const memories = countMemories(profile)
  const facts = profile.personalFacts?.length ?? 0

  let mainGames = Math.round(25 * scale)
  let personalBlock = Math.round(10 * scale)
  let quickLight = Math.round(5 * scale)
  let breathers = Math.round(2 * scale)
  const opening = 1
  const closing = 1
  let estimatedCorrectionPages = Math.round(5 * scale)

  if (audience === "ME" || audience === "OTHER_PERSON") {
    mainGames = Math.round(26 * scale)
    personalBlock = Math.round(9 * scale)
    quickLight = Math.round(5 * scale)
  } else if (audience === "DUO") {
    mainGames = Math.round(22 * scale)
    personalBlock = Math.round(12 * scale)
    quickLight = Math.round(6 * scale)
  } else if (audience === "GROUP") {
    mainGames = Math.round(21 * scale)
    personalBlock = Math.round(13 * scale)
    quickLight = Math.round(6 * scale)
  }

  if (richnessLevel === "RICH") {
    personalBlock += Math.round(2 * scale)
    mainGames -= Math.round(1 * scale)
  } else if (richnessLevel === "INSUFFICIENT") {
    personalBlock = Math.max(2, personalBlock - Math.round(4 * scale))
    mainGames += Math.round(2 * scale)
  }

  // Block budgets (not pages)
  let photoSlots = 0
  if (photos === 0) photoSlots = 0
  else if (photos <= 3) photoSlots = clamp(photos, 1, Math.round(3 * scale))
  else photoSlots = clamp(Math.min(photos, Math.round(6 * scale)), 2, Math.round(7 * scale))

  let memorySlots = 0
  if (memories === 0) memorySlots = 0
  else if (memories <= 2) memorySlots = memories
  else memorySlots = clamp(Math.min(memories, Math.round(5 * scale)), 2, Math.round(6 * scale))

  if (richnessLevel === "RICH" && memories > 0) {
    memorySlots = clamp(memorySlots + 1, 0, Math.round(7 * scale))
  }

  let personalGameSlots = 0
  if (audience === "ME" || audience === "OTHER_PERSON") {
    personalGameSlots = richnessLevel === "RICH" ? Math.round(2 * scale) : Math.round(1 * scale)
  } else if (audience === "DUO") {
    personalGameSlots = Math.round(4 * scale)
  } else {
    personalGameSlots = Math.round(5 * scale)
  }

  const maxReadyThemeGames = clamp(Math.round(12 * scale), 8, 15)

  // Compose blocks → real personal editorial page count
  const blocks = collectPersonalBlocks({
    profile,
    maxMemories: memorySlots || memories,
    maxPhotos: photoSlots || photos,
  })
  const composed = composePersonalEditorialPages(
    blocks,
    input.seed ?? "composition-targets",
  )
  const personalEditorialSlots = composed.length

  const personalCore = personalEditorialSlots + personalGameSlots
  if (personalCore > personalBlock) {
    personalBlock = personalCore
  }

  mainGames = clamp(mainGames, Math.round(20 * scale), Math.round(28 * scale))
  personalBlock = clamp(personalBlock, Math.round(6 * scale), Math.round(14 * scale))
  quickLight = clamp(quickLight, Math.round(4 * scale), Math.round(7 * scale))
  breathers = clamp(breathers, Math.round(1 * scale), Math.round(3 * scale))
  estimatedCorrectionPages = clamp(
    estimatedCorrectionPages,
    Math.round(4 * scale),
    Math.round(7 * scale),
  )

  const fixed = opening + closing
  let content = mainGames + personalBlock + quickLight + breathers
  const room = N - fixed - estimatedCorrectionPages
  if (content !== room) {
    const delta = room - content
    if (delta > 0) {
      mainGames += delta
    } else {
      let need = -delta
      const trimMain = Math.min(need, Math.max(0, mainGames - Math.round(20 * scale)))
      mainGames -= trimMain
      need -= trimMain
      const trimQuick = Math.min(need, Math.max(0, quickLight - Math.round(4 * scale)))
      quickLight -= trimQuick
      need -= trimQuick
      if (need > 0) breathers = Math.max(1, breathers - need)
    }
  }

  void facts

  return {
    opening,
    closing,
    mainGames,
    personalBlock,
    quickLight,
    breathers,
    estimatedCorrectionPages,
    maxReadyThemeGames,
    photoSlots,
    memorySlots,
    personalEditorialSlots,
    personalGameSlots,
  }
}

export function quizPersonalAllowed(
  audience: BookProfileV1["audience"],
  personalFactCount: number,
): boolean {
  if (audience === "ME" || audience === "OTHER_PERSON") return false
  return personalFactCount >= 4
}

export function countUsablePhotosExport(profile: BookProfileV1): number {
  return countUsablePhotos(profile)
}

export function countMemoriesExport(profile: BookProfileV1): number {
  return countMemories(profile)
}
