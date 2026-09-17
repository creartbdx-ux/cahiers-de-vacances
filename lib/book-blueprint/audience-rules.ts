import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import {
  computePersonalizationCapabilities,
  normalizePersonalizationDepth,
  type PersonalizationCapabilities,
  type PersonalizationDepth,
} from "@/lib/questionnaire/capabilities"
import { planPhotoPagesFromProfile } from "@/lib/photo-pages"
import type { CompositionTargets } from "./types"

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function countUsablePhotos(profile: BookProfileV1): number {
  return (profile.photos ?? []).filter(
    (p) => p.useAuthorized && Boolean(p.storagePath?.trim()),
  ).length
}

function countMemories(profile: BookProfileV1): number {
  return (profile.memories ?? []).filter((m) => m.text?.trim()).length
}

function resolveDepth(
  richnessLevel: RichnessLevel,
  caps: PersonalizationCapabilities,
): PersonalizationDepth {
  const fromLevel = normalizePersonalizationDepth(richnessLevel)
  if (caps.depth === "RICH" || fromLevel === "RICH") {
    return caps.depth === "RICH" ? "RICH" : fromLevel === "RICH" ? "RICH" : caps.depth
  }
  if (caps.depth === "PERSONALIZED" || fromLevel === "PERSONALIZED") {
    return "PERSONALIZED"
  }
  return "LIGHT"
}

/**
 * Soft composition targets for ~50 interior pages.
 *
 * Personalization is mostly DIFFUSE (touchBudget on ordinary games).
 * personalBlock / personalGameSlots no longer fill with generic PERSONAL_REFLECTION.
 */
export function resolveCompositionTargets(input: {
  profile: BookProfileV1
  richnessLevel: RichnessLevel
  targetInteriorPages: number
  seed?: string
}): CompositionTargets {
  const { profile, richnessLevel, targetInteriorPages: N } = input
  const caps = computePersonalizationCapabilities(profile)
  const depth = resolveDepth(richnessLevel, caps)
  const scale = N / 50
  const audience = profile.audience
  const photos = countUsablePhotos(profile)
  const memories = countMemories(profile)

  // Main games dominate — personalization lives as touches on these pages
  let mainGames = Math.round(28 * scale)
  let quickLight = Math.round(6 * scale)
  let breathers = Math.round(2 * scale)
  const opening = 1
  const closing = 1
  let estimatedCorrectionPages = Math.round(5 * scale)

  if (audience === "DUO") {
    mainGames = Math.round(26 * scale)
    quickLight = Math.round(6 * scale)
  } else if (audience === "GROUP") {
    mainGames = Math.round(25 * scale)
    quickLight = Math.round(7 * scale)
  }

  // Diffuse touch target: ~12–18 pages for N=50
  let touchBudget = clamp(Math.round(15 * scale), Math.round(10 * scale), Math.round(20 * scale))
  if (depth === "RICH") touchBudget = clamp(touchBudget + Math.round(2 * scale), 10, Math.round(22 * scale))
  if (depth === "LIGHT") touchBudget = clamp(touchBudget - Math.round(1 * scale), Math.round(10 * scale), Math.round(18 * scale))

  // Intentional light-touch mechanics (logic/age, secret word, …) — not generic personal pages
  let touchMechanicSlots = 0
  if (caps.hasAge || caps.hasBirthDate) touchMechanicSlots++
  if (caps.hasRecipientName) touchMechanicSlots++
  if (caps.hasClosePeople || caps.hasFamilyContext) touchMechanicSlots++
  if (caps.hasTraits) touchMechanicSlots++
  touchMechanicSlots = clamp(touchMechanicSlots, 0, Math.round(4 * scale))

  // Photo budget
  let photoSlots = 0
  if (photos === 0 || !caps.hasPhotos) photoSlots = 0
  else if (photos <= 3) photoSlots = clamp(photos, 1, Math.round(4 * scale))
  else photoSlots = clamp(Math.min(photos, Math.round(8 * scale)), 2, Math.round(10 * scale))

  let memorySlots = 0
  if (memories === 0 || !caps.hasMemories) memorySlots = 0
  else if (memories <= 2) memorySlots = memories
  else memorySlots = clamp(Math.min(memories, Math.round(5 * scale)), 2, Math.round(6 * scale))
  if (depth === "RICH" && memories > 0) {
    memorySlots = clamp(memorySlots + 1, 0, Math.round(7 * scale))
  }

  // Dedicated deep / audience games — small, never a reflection fill
  let personalGameSlots = 0
  if (audience === "DUO") personalGameSlots = Math.round(2 * scale)
  else if (audience === "GROUP") personalGameSlots = Math.round(2 * scale)
  else if (depth === "RICH" && (caps.hasMemories || caps.hasPersonalFacts)) {
    personalGameSlots = Math.round(1 * scale)
  }

  const maxReadyThemeGames = clamp(Math.round(14 * scale), 8, 16)

  const planned = planPhotoPagesFromProfile(
    {
      ...profile,
      photos: (profile.photos ?? [])
        .filter((p) => p.useAuthorized && Boolean(p.storagePath?.trim()))
        .slice(0, photoSlots || photos),
    },
    input.seed ?? "composition-targets",
  )
  const photoPageSlots = planned.pages.length
  const personalEditorialSlots = 0

  // personalBlock = photos + deep/audience + touch mechanics (explicit intents only)
  let personalBlock = photoPageSlots + personalGameSlots + touchMechanicSlots
  personalBlock = clamp(personalBlock, 0, Math.round(12 * scale))

  mainGames = clamp(mainGames, Math.round(22 * scale), Math.round(32 * scale))
  quickLight = clamp(quickLight, Math.round(4 * scale), Math.round(8 * scale))
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
      const trimMain = Math.min(need, Math.max(0, mainGames - Math.round(22 * scale)))
      mainGames -= trimMain
      need -= trimMain
      const trimQuick = Math.min(need, Math.max(0, quickLight - Math.round(4 * scale)))
      quickLight -= trimQuick
      need -= trimQuick
      if (need > 0) breathers = Math.max(1, breathers - need)
    }
  }

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
    photoPageSlots,
    personalGameSlots,
    touchBudget,
    touchMechanicSlots,
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

export { resolveDepth }
