import { createRng } from "@/lib/game-engines/random"
import { resolveCoverDisplayName, resolveCoverSubtitle } from "@/lib/mini-book/cover-name"
import { hashSeed, resolveBookVisualIdentity } from "@/lib/mini-book/visual-identity"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import type { Palette, Style } from "@/lib/supabase/types"
import {
  getArchetype,
  READY_THEME_ARCHETYPE_IDS,
} from "./archetypes"
import {
  countMemoriesExport,
  countUsablePhotosExport,
  quizPersonalAllowed,
  resolveCompositionTargets,
} from "./audience-rules"
import { packCorrections, type CorrectionNeed } from "./corrections"
import { computeCapabilityGaps } from "./gaps"
import { listMemoryContentHints } from "./memory-hints"
import { repairRhythmSequence, type RhythmPageView } from "./rhythm"
import { assignVisualRoles, pickScoredIntent, type ScoredIntent } from "./scoring"
import type {
  BookBlueprintV1,
  BlueprintPageSlot,
  BlueprintSection,
  BlueprintStats,
  CompositionTargets,
  PageFamily,
  VisualRole,
} from "./types"
import { BOOK_BLUEPRINT_VERSION, DEFAULT_TARGET_INTERIOR_PAGES } from "./types"

export interface BuildBookBlueprintInput {
  bookProjectId: string
  seed: string
  profile: BookProfileV1
  richnessLevel: RichnessLevel
  styles: Style[]
  palettes: Palette[]
  targetInteriorPages?: number
}

type DraftIntent = ScoredIntent & { sectionHint?: string }

/**
 * Deterministic Book Blueprint V1 — structure only, no IA, no content generation.
 */
export function buildBookBlueprint(input: BuildBookBlueprintInput): BookBlueprintV1 {
  const targetInteriorPages = input.targetInteriorPages ?? DEFAULT_TARGET_INTERIOR_PAGES
  if (targetInteriorPages < 12) {
    throw new Error("targetInteriorPages must be >= 12")
  }

  const rng = createRng(`blueprint:${input.seed}`)
  const visualIdentity = resolveBookVisualIdentity({
    profile: input.profile,
    seed: input.seed,
    styles: input.styles,
    palettes: input.palettes,
  })

  const targets = resolveCompositionTargets({
    profile: input.profile,
    richnessLevel: input.richnessLevel,
    targetInteriorPages,
  })

  const universes = input.profile.sharedProfile.interestUniverseIds.slice()
  const photos = countUsablePhotosExport(input.profile)
  const memories = countMemoriesExport(input.profile)
  const facts = input.profile.personalFacts?.length ?? 0

  const bag = buildIntentBag({
    targets,
    profile: input.profile,
    richnessLevel: input.richnessLevel,
    universes,
    rng,
    seed: input.seed,
  })

  const sequenced = sequenceIntents(bag, rng)
  const repaired = repairRhythmSequence(
    sequenced.map((s) => ({
      ...s,
      family: s.archetype.family,
      archetypeId: s.archetype.id,
      density: s.archetype.estimatedDensity,
      technicalEngine: s.archetype.technicalEngine,
      universeId: s.universeId,
      gameId: s.archetype.gameId,
    })),
  )

  // Restore full intent objects in repaired order
  const byTemp = new Map(sequenced.map((s) => [s.tempId, s]))
  let orderedIntents = repaired
    .map((r) => byTemp.get((r as DraftIntent).tempId))
    .filter((x): x is DraftIntent => !!x)

  // Fit content so opening + content + corrections + closing == N
  orderedIntents = fitContentForExactTotal({
    content: orderedIntents,
    targetInteriorPages,
    seed: input.seed,
    rng,
    universes,
  })

  const contentWithIds = orderedIntents.map((intent, i) => ({
    ...intent,
    provisionalSlotId: `bp_${input.seed}_c${i}`,
  }))

  const correctionNeeds: CorrectionNeed[] = []
  for (const item of contentWithIds) {
    if (!item.archetype.correctionRequired) continue
    correctionNeeds.push({
      gameSlotId: item.provisionalSlotId,
      weight: item.archetype.correctionWeight,
      label: item.archetype.label,
      gameId: item.archetype.gameId,
    })
  }
  const packed = packCorrections(correctionNeeds)

  const opening = makeOpeningIntent(input.seed)
  const closing = makeClosingIntent(input.seed)

  const assembly: Array<DraftIntent & { provisionalSlotId: string; correctionOf?: string[] }> = [
    { ...opening, provisionalSlotId: `bp_${input.seed}_open` },
    ...contentWithIds,
    ...packed.map((p, i) => ({
      ...makeCorrectionIntent(input.seed, i),
      provisionalSlotId: `bp_${input.seed}_corr${i}`,
      correctionOf: p.corrects,
      reason: p.reason,
    })),
    { ...closing, provisionalSlotId: `bp_${input.seed}_close` },
  ]

  // Safety: if packing estimate drifted, pad/trim non-correction content and rebuild once.
  const finalAssembly = ensureExactTotal(assembly, targetInteriorPages, input.seed, rng, universes)

  const visualRoles = assignVisualRoles(finalAssembly.length, hashSeed(input.seed))
  const pages = toBlueprintPages(finalAssembly, visualRoles, targetInteriorPages)
  const sections = buildSections(pages)
  const stats = computeStats(pages)
  const capabilityGaps = computeCapabilityGaps(pages, input.profile.audience, {
    photos,
    memories,
    personalFacts: facts,
    interests: universes.length,
  })

  return {
    version: BOOK_BLUEPRINT_VERSION,
    bookProjectId: input.bookProjectId,
    seed: input.seed,
    audience: input.profile.audience,
    richnessLevel: input.richnessLevel,
    targetInteriorPages,
    cover: {
      displayName: resolveCoverDisplayName(input.profile),
      subtitle: resolveCoverSubtitle(input.profile),
      outsideInteriorPagination: true,
    },
    visualIdentity,
    sections,
    pages,
    stats,
    capabilityGaps,
    memoryContentHints: listMemoryContentHints(input.profile),
  }
}

function makeOpeningIntent(seed: string): DraftIntent {
  const a = getArchetype("OPENING_WELCOME")
  return {
    archetype: a,
    tempId: `${seed}:open`,
    reason: "Ouverture du cahier — hors couverture",
  }
}

function makeClosingIntent(seed: string): DraftIntent {
  const a = getArchetype("CLOSING_PAGE")
  return {
    archetype: a,
    tempId: `${seed}:close`,
    reason: "Clôture éditoriale",
  }
}

function makeCorrectionIntent(seed: string, i: number): DraftIntent {
  const a = getArchetype("COMPACT_CORRECTIONS")
  return {
    archetype: a,
    tempId: `${seed}:corr:${i}`,
    reason: "Bloc de corrections compactes",
  }
}

function buildIntentBag(input: {
  targets: CompositionTargets
  profile: BookProfileV1
  richnessLevel: RichnessLevel
  universes: string[]
  rng: ReturnType<typeof createRng>
  seed: string
}): DraftIntent[] {
  const { targets, profile, universes, rng, seed } = input
  const bag: DraftIntent[] = []
  let seq = 0
  const nextId = () => `${seed}:intent:${seq++}`

  const universePicker = createUniversePicker(universes, rng)

  // --- Main games: READY capped, rest MISSING variety ---
  const readyCount = Math.min(targets.maxReadyThemeGames, targets.mainGames)
  const missingMain = Math.max(0, targets.mainGames - readyCount)
  const readyCycle = rng.shuffle([...READY_THEME_ARCHETYPE_IDS])

  for (let i = 0; i < readyCount; i++) {
    const id = readyCycle[i % readyCycle.length]!
    const archetype = getArchetype(id)
    bag.push({
      archetype,
      tempId: nextId(),
      universeId: universePicker(),
      reason: `Jeu thématique READY (${archetype.label})`,
    })
  }
  for (let i = 0; i < missingMain; i++) {
    bag.push({
      archetype: getArchetype("THEME_VARIETY_GAME"),
      tempId: nextId(),
      universeId: universePicker(),
      reason: "Mécanique thématique manquante — ne pas répéter les 3 moteurs READY",
    })
  }

  // --- Photos ---
  const photoCandidates = (profile.photos ?? []).filter(
    (p) => p.useAuthorized && Boolean(p.storagePath),
  )
  for (let i = 0; i < targets.photoSlots; i++) {
    const photo = photoCandidates[i] ?? profile.photos[i]
    const hasText = Boolean(photo?.caption?.trim() || photo?.anecdote?.trim())
    const chainReady = Boolean(
      photo?.useAuthorized && photo.storagePath && hasText,
    )
    bag.push({
      archetype: getArchetype("PHOTO_MEMORY_PAGE"),
      tempId: nextId(),
      sourceNeeds: ["photo"],
      participantIds: photo?.participantIds,
      reason: chainReady
        ? "Photo autorisée avec légende/anecdote — PHOTO_MEMORY_PAGE READY"
        : "Photo insuffisante pour PHOTO_MEMORY_PAGE (metadata ou storage) — PARTIAL",
      implementationStatusOverride: chainReady ? "READY" : "PARTIAL",
    })
  }

  // --- Memories ---
  for (let i = 0; i < targets.memorySlots; i++) {
    bag.push({
      archetype: getArchetype("MEMORY_TEXT_PAGE"),
      tempId: nextId(),
      sourceNeeds: ["memory"],
      participantIds: profile.memories[i]?.participantIds,
      reason: "Souvenir réparti — éviter les blocs souvenirs",
    })
  }

  // --- Personal games ---
  let personalLeft = targets.personalGameSlots
  const allowQuizPersonal = quizPersonalAllowed(
    profile.audience,
    profile.personalFacts?.length ?? 0,
  )
  if (allowQuizPersonal && personalLeft > 0 && (profile.audience === "DUO" || profile.audience === "GROUP")) {
    bag.push({
      archetype: getArchetype("PERSONAL_QUIZ"),
      tempId: nextId(),
      sourceNeeds: ["personalFacts"],
      reason: "Quiz personnel éligible (Editorial Engine)",
    })
    personalLeft--
  }
  while (personalLeft > 0) {
    if (profile.audience === "DUO" && personalLeft > 0) {
      bag.push({
        archetype: getArchetype("DUO_INTERACTION"),
        tempId: nextId(),
        reason: "Interaction duo — mécanique à développer",
      })
      personalLeft--
      if (personalLeft <= 0) break
    }
    if (profile.audience === "GROUP" && personalLeft > 0) {
      bag.push({
        archetype: getArchetype("GROUP_WHO_IN_THE_BAND"),
        tempId: nextId(),
        reason: "Contenu collectif — mécanique à développer",
      })
      personalLeft--
      if (personalLeft <= 0) break
    }
    bag.push({
      archetype: getArchetype("PERSONAL_REFLECTION"),
      tempId: nextId(),
      reason: "Page personnelle ludique / contemplative (non interrogatoire)",
    })
    personalLeft--
  }

  // Fill remaining personal block with reflection if photos+memories+games < block
  const personalUsed =
    targets.photoSlots + targets.memorySlots + targets.personalGameSlots
  let personalPad = Math.max(0, targets.personalBlock - personalUsed)
  while (personalPad > 0) {
    bag.push({
      archetype: getArchetype("PERSONAL_REFLECTION"),
      tempId: nextId(),
      reason: "Complément personnel non-jeu",
    })
    personalPad--
  }

  // --- Quick / light ---
  let quick = targets.quickLight
  while (quick > 0) {
    if ((profile.audience === "GROUP" || profile.audience === "DUO") && quick > 0 && rng.next() > 0.4) {
      bag.push({
        archetype: getArchetype("GROUP_QUICK_GAME"),
        tempId: nextId(),
        reason: "Jeu rapide collectif manquant",
      })
      quick--
      continue
    }
    if (rng.next() > 0.45) {
      bag.push({
        archetype: getArchetype("PERSONAL_QUICK_GAME"),
        tempId: nextId(),
        reason: "Jeu rapide personnalisé manquant",
      })
    } else {
      bag.push({
        archetype: getArchetype("LIGHT_ACTIVITY"),
        tempId: nextId(),
        reason: "Activité légère manquante",
      })
    }
    quick--
  }

  // --- Breathers ---
  for (let i = 0; i < targets.breathers; i++) {
    bag.push({
      archetype: getArchetype("BREATHER_PAGE"),
      tempId: nextId(),
      reason: "Respiration éditoriale",
    })
  }

  return bag
}

function createUniversePicker(universes: string[], rng: ReturnType<typeof createRng>) {
  const pool = universes.length ? universes : [null]
  let cursor = 0
  const order = rng.shuffle(pool.map((_, i) => i))
  return (): string | null => {
    const idx = order[cursor % order.length]!
    cursor++
    const u = pool[idx]
    return u == null ? null : u
  }
}

function sequenceIntents(
  bag: DraftIntent[],
  rng: ReturnType<typeof createRng>,
): DraftIntent[] {
  const remaining = bag.slice()
  const history: RhythmPageView[] = []
  const out: DraftIntent[] = []
  const universeUsage = new Map<string, number>()

  while (remaining.length) {
    const pick = pickScoredIntent(remaining, history, universeUsage, rng)
    const idx = remaining.findIndex((r) => r.tempId === pick.tempId)
    remaining.splice(idx, 1)
    out.push(pick)
    history.push({
      family: pick.archetype.family,
      archetypeId: pick.archetype.id,
      density: pick.archetype.estimatedDensity,
      technicalEngine: pick.archetype.technicalEngine,
      universeId: pick.universeId,
      gameId: pick.archetype.gameId,
    })
    if (pick.universeId) {
      universeUsage.set(pick.universeId, (universeUsage.get(pick.universeId) ?? 0) + 1)
    }
  }
  return out
}

/** Adjust content size so opening(1)+content+corrections+closing(1) == target. */
function fitContentForExactTotal(input: {
  content: DraftIntent[]
  targetInteriorPages: number
  seed: string
  rng: ReturnType<typeof createRng>
  universes: string[]
}): DraftIntent[] {
  const content = input.content.slice()
  let n = 0
  const padId = () => `${input.seed}:fit:${n++}`

  for (let guard = 0; guard < 40; guard++) {
    const needs: CorrectionNeed[] = content
      .filter((c) => c.archetype.correctionRequired)
      .map((c, i) => ({
        gameSlotId: `tmp${i}`,
        weight: c.archetype.correctionWeight,
        label: c.archetype.label,
      }))
    const corrCount = packCorrections(needs).length
    const total = 1 + content.length + corrCount + 1
    if (total === input.targetInteriorPages) return content
    if (total > input.targetInteriorPages) {
      const idx = findRemovableContentIndex(content)
      if (idx < 0) break
      content.splice(idx, 1)
    } else {
      // Prefer non-correction pads so corr page count stays stable
      const pad = makePadIntent(input.rng, input.universes, padId())
      // Avoid pads that require corrections when we're already near target
      if (pad.archetype.correctionRequired && total + 1 + 0 >= input.targetInteriorPages) {
        content.push({
          archetype: getArchetype("BREATHER_PAGE"),
          tempId: padId(),
          reason: "Ajustement longueur — respiration",
        })
      } else {
        content.push(pad)
      }
    }
  }
  return content
}

function makePadIntent(
  rng: ReturnType<typeof createRng>,
  universes: string[],
  tempId: string,
): DraftIntent {
  const roll = rng.next()
  if (roll < 0.4) {
    return {
      archetype: getArchetype("BREATHER_PAGE"),
      tempId,
      reason: "Ajustement longueur — respiration",
    }
  }
  if (roll < 0.75) {
    return {
      archetype: getArchetype("LIGHT_ACTIVITY"),
      tempId,
      reason: "Ajustement longueur — activité légère manquante",
    }
  }
  return {
    archetype: getArchetype("THEME_VARIETY_GAME"),
    tempId,
    universeId: universes.length ? universes[rng.int(universes.length)]! : null,
    reason: "Ajustement longueur — mécanique thématique manquante",
  }
}

function findRemovableContentIndex(content: DraftIntent[]): number {
  for (let i = content.length - 1; i >= 0; i--) {
    const a = content[i]!.archetype
    if (a.id === "THEME_VARIETY_GAME" || a.family === "BREATHER" || a.id === "PERSONAL_REFLECTION") {
      return i
    }
  }
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i]!.archetype.implementationStatus !== "READY") return i
  }
  return content.length > 8 ? content.length - 1 : -1
}

function ensureExactTotal(
  assembly: Array<DraftIntent & { provisionalSlotId: string; correctionOf?: string[] }>,
  target: number,
  seed: string,
  rng: ReturnType<typeof createRng>,
  universes: string[],
): Array<DraftIntent & { provisionalSlotId: string; correctionOf?: string[] }> {
  if (assembly.length === target) return assembly

  // Rebuild from parts: open | content | corr | close
  const opening = assembly[0]!
  const closing = assembly[assembly.length - 1]!
  const middle = assembly.slice(1, -1)
  const content = middle.filter((p) => p.archetype.family !== "CORRECTION")
  let fitted = content.map(({ provisionalSlotId: _id, correctionOf: _c, ...rest }) => rest as DraftIntent)
  fitted = fitContentForExactTotal({
    content: fitted,
    targetInteriorPages: target,
    seed: `${seed}:ensure`,
    rng,
    universes,
  })

  const withIds = fitted.map((intent, i) => ({
    ...intent,
    provisionalSlotId: `bp_${seed}_e${i}`,
  }))
  const needs: CorrectionNeed[] = withIds
    .filter((c) => c.archetype.correctionRequired)
    .map((c) => ({
      gameSlotId: c.provisionalSlotId,
      weight: c.archetype.correctionWeight,
      label: c.archetype.label,
      gameId: c.archetype.gameId,
    }))
  const packed = packCorrections(needs)
  const rebuilt: Array<DraftIntent & { provisionalSlotId: string; correctionOf?: string[] }> = [
    opening,
    ...withIds,
    ...packed.map((p, i) => ({
      ...makeCorrectionIntent(seed, i),
      provisionalSlotId: `bp_${seed}_ecorr${i}`,
      correctionOf: p.corrects,
      reason: p.reason,
    })),
    closing,
  ]

  // Last-resort hard trim/pad without breaking open/close
  while (rebuilt.length > target) {
    const idx = rebuilt.findIndex(
      (p, i) =>
        i > 0 &&
        i < rebuilt.length - 1 &&
        p.archetype.family !== "CORRECTION" &&
        (p.archetype.family === "BREATHER" || p.archetype.id === "LIGHT_ACTIVITY"),
    )
    if (idx < 0) break
    rebuilt.splice(idx, 1)
  }
  while (rebuilt.length < target) {
    const insertAt = Math.max(1, rebuilt.length - 1 - packed.length)
    const intent = makePadIntent(rng, universes, `bp_${seed}:hardpad:${rebuilt.length}`)
    rebuilt.splice(insertAt, 0, {
      ...intent,
      provisionalSlotId: `bp_${seed}_hp${rebuilt.length}`,
    })
  }
  return rebuilt.slice(0, target)
}

function toBlueprintPages(
  assembly: Array<DraftIntent & { provisionalSlotId: string; correctionOf?: string[] }>,
  visualRoles: VisualRole[],
  _target: number,
): BlueprintPageSlot[] {
  const total = assembly.length
  return assembly.map((item, i) => {
    const pageNumber = i + 1
    const section = sectionForIndex(i, total, item.archetype.family)
    return {
      slotId: item.provisionalSlotId,
      pageNumber,
      family: item.archetype.family,
      archetypeId: item.archetype.id,
      label: item.archetype.label,
      personalizationType: item.archetype.personalizationType,
      gameId: item.archetype.gameId,
      technicalEngine: item.archetype.technicalEngine,
      universeId: item.universeId ?? null,
      participantIds: item.participantIds,
      sourceNeeds: item.sourceNeeds,
      implementationStatus:
        item.implementationStatusOverride ?? item.archetype.implementationStatus,
      correctionOf: item.correctionOf,
      visualRole: visualRoles[i]!,
      density: item.archetype.estimatedDensity,
      section,
      reason: item.reason,
    }
  })
}

function sectionForIndex(i: number, total: number, family: PageFamily): BlueprintPageSlot["section"] {
  if (family === "OPENING") return "OPENING"
  if (family === "CLOSING") return "CLOSING"
  if (family === "CORRECTION") return "CORRECTIONS"
  const contentEnd = total - 1 // before closing; corrections may sit near end
  // Approximate thirds of non-edge content
  const rel = i / Math.max(1, contentEnd)
  if (rel < 0.34) return "PART_1"
  if (rel < 0.67) return "PART_2"
  return "PART_3"
}

function buildSections(pages: BlueprintPageSlot[]): BlueprintSection[] {
  const kinds: BlueprintSection["kind"][] = [
    "OPENING",
    "PART_1",
    "PART_2",
    "PART_3",
    "CORRECTIONS",
    "CLOSING",
  ]
  const labels: Record<BlueprintSection["kind"], string> = {
    OPENING: "Ouverture",
    PART_1: "Partie 1",
    PART_2: "Partie 2",
    PART_3: "Partie 3",
    CORRECTIONS: "Corrections",
    CLOSING: "Clôture",
  }
  return kinds
    .map((kind) => ({
      kind,
      label: labels[kind],
      pageNumbers: pages.filter((p) => p.section === kind).map((p) => p.pageNumber),
    }))
    .filter((s) => s.pageNumbers.length > 0)
}

function computeStats(pages: BlueprintPageSlot[]): BlueprintStats {
  const emptyFamily = {
    OPENING: 0,
    THEME_GAME: 0,
    PERSONAL_GAME: 0,
    MEMORY: 0,
    PHOTO: 0,
    QUICK_GAME: 0,
    BREATHER: 0,
    CORRECTION: 0,
    CLOSING: 0,
  } satisfies Record<PageFamily, number>

  const byFamily = { ...emptyFamily }
  const byStatus = { READY: 0, PARTIAL: 0, MISSING: 0 }
  const byPersonalization = { THEME: 0, PERSONAL: 0, NONE: 0 }
  const byDensity = { LIGHT: 0, MEDIUM: 0, HEAVY: 0 }
  const byVisualRole: Record<VisualRole, number> = {
    PRIMARY: 0,
    SECONDARY: 0,
    ACCENT: 0,
    LIGHT: 0,
    NEUTRAL: 0,
  }
  const universeCounts: Record<string, number> = {}

  for (const p of pages) {
    byFamily[p.family]++
    byStatus[p.implementationStatus]++
    byPersonalization[p.personalizationType]++
    byDensity[p.density]++
    byVisualRole[p.visualRole]++
    if (p.universeId) {
      universeCounts[p.universeId] = (universeCounts[p.universeId] ?? 0) + 1
    }
  }

  const n = pages.length || 1
  const themePages = byPersonalization.THEME
  const personalPages = byPersonalization.PERSONAL
  const readyThemeGamePages = pages.filter(
    (p) =>
      p.family === "THEME_GAME" &&
      p.implementationStatus === "READY" &&
      !!p.gameId,
  ).length
  const missingMechanicPages = pages.filter(
    (p) => p.archetypeId === "THEME_VARIETY_GAME" || p.family === "QUICK_GAME",
  ).length

  return {
    interiorPageCount: pages.length,
    byFamily,
    byStatus,
    byPersonalization,
    byDensity,
    byVisualRole,
    universeCounts,
    themePercent: Math.round((themePages / n) * 100),
    personalPercent: Math.round((personalPages / n) * 100),
    readyPercent: Math.round((byStatus.READY / n) * 100),
    missingPercent: Math.round((byStatus.MISSING / n) * 100),
    photoPages: byFamily.PHOTO,
    memoryPages: byFamily.MEMORY,
    mainGamePages: byFamily.THEME_GAME,
    quickGamePages: byFamily.QUICK_GAME,
    correctionPages: byFamily.CORRECTION,
    readyThemeGamePages,
    missingMechanicPages,
  }
}
