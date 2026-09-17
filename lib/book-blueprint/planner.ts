import { createRng } from "@/lib/game-engines/random"
import { resolveCoverDisplayName, resolveCoverSubtitle } from "@/lib/mini-book/cover-name"
import { hashSeed, resolveBookVisualIdentity } from "@/lib/mini-book/visual-identity"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import {
  buildPersonalizationTouches,
  canSatisfyDataNeed,
  computePersonalizationCapabilities,
  normalizePersonalizationDepth,
  type PersonalizationCapabilities,
} from "@/lib/questionnaire/capabilities"
import type { Palette, Style } from "@/lib/supabase/types"
import {
  planPhotoPagesFromProfile,
  type PhotoPageV1,
} from "@/lib/photo-pages"
import { getPersonalGameSources } from "@/lib/personal-game-sources"
import {
  getArchetype,
  READY_THEME_ARCHETYPE_IDS,
} from "./archetypes"
import {
  countMemoriesExport,
  countUsablePhotosExport,
  quizPersonalAllowed,
  resolveCompositionTargets,
  resolveDepth,
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
  PageDataNeed,
  PageFamily,
  PersonalizationTouch,
  VisualRole,
} from "./types"
import { BOOK_BLUEPRINT_VERSION, DEFAULT_TARGET_INTERIOR_PAGES } from "./types"
import {
  availableTouchTypes,
  pageCountsAsPersonalized,
  touch,
  type PersonalizationTouchType,
} from "./personalization-touches"

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

  const caps = computePersonalizationCapabilities(input.profile)
  const depth = resolveDepth(input.richnessLevel, caps)
  const touches = buildPersonalizationTouches(input.profile)
  void touches // available for future title/label personalization without changing engines

  const targets = resolveCompositionTargets({
    profile: input.profile,
    richnessLevel: input.richnessLevel,
    targetInteriorPages,
    seed: input.seed,
  })

  const universes = input.profile.sharedProfile.interestUniverseIds.slice()
  const photos = countUsablePhotosExport(input.profile)
  const memories = countMemoriesExport(input.profile)
  const facts = input.profile.personalFacts?.length ?? 0

  const bag = buildIntentBag({
    targets,
    profile: input.profile,
    richnessLevel: input.richnessLevel,
    caps,
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
    richnessLevel: normalizePersonalizationDepth(input.richnessLevel),
    personalizationDepth: depth,
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

function intentFromPhotoPage(
  page: PhotoPageV1,
  nextId: () => string,
): ScoredIntent {
  const sourcePhotoIds = page.photos.map((p) => p.sourcePhotoId)
  const participantIds = [
    ...new Set(page.photos.flatMap((p) => p.participantIds)),
  ]
  if (page.kind === "TIMELINE") {
    return {
      archetype: getArchetype("PHOTO_TIMELINE_PAGE"),
      tempId: nextId(),
      sourceNeeds: ["photo"],
      participantIds,
      sourcePhotoIds,
      photoTemplateId: page.templateId,
      reason: `Timeline photo (${page.photos.length} photo(s)${page.templateId ? `, ${page.templateId}` : ""})`,
    }
  }
  return {
    archetype: getArchetype("PHOTO_COLLAGE_PAGE"),
    tempId: nextId(),
    sourceNeeds: ["photo"],
    participantIds,
    photoLayoutId: page.layoutId,
    photoTemplateId: page.templateId,
    sourcePhotoIds,
    reason: `Album photo ${page.templateId ?? page.layoutId} (${page.photos.length} photo(s))`,
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
  caps: PersonalizationCapabilities
  universes: string[]
  rng: ReturnType<typeof createRng>
  seed: string
}): DraftIntent[] {
  const { targets, profile, caps, universes, rng, seed } = input
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

  // --- Photo album pages — only when capabilities allow ---
  if (canSatisfyDataNeed("PHOTO", caps) && targets.photoSlots > 0) {
    const photoPlan = planPhotoPagesFromProfile(
      {
        ...profile,
        photos: (profile.photos ?? [])
          .filter((p) => p.useAuthorized && Boolean(p.storagePath?.trim()))
          .slice(0, targets.photoSlots || (profile.photos?.length ?? 0)),
      },
      `${seed}:photo-pages`,
    )
    for (const page of photoPlan.pages) {
      bag.push(intentFromPhotoPage(page, nextId))
    }
  }

  // Memories feed personal games (sources), not dedicated pages
  void getPersonalGameSources(profile)

  // --- Dedicated deep / audience games (small) — NEVER fill with PERSONAL_REFLECTION ---
  let personalLeft = targets.personalGameSlots
  const allowQuizPersonal =
    canSatisfyDataNeed("DEEP_PERSONAL", caps) &&
    quizPersonalAllowed(profile.audience, profile.personalFacts?.length ?? 0)

  if (allowQuizPersonal && personalLeft > 0 && (profile.audience === "DUO" || profile.audience === "GROUP")) {
    bag.push({
      archetype: getArchetype("PERSONAL_QUIZ"),
      tempId: nextId(),
      sourceNeeds: ["personalFacts", "memories"],
      personalizationTouches: [
        touch("PERSONAL_FACT", "question"),
        ...(caps.hasMemories ? [touch("MEMORY", "question")] : []),
      ],
      reason: "Quiz personnel (DEEP) — facts / souvenirs",
    })
    personalLeft--
  }

  if (profile.audience === "DUO" && personalLeft > 0) {
    bag.push({
      archetype: getArchetype("DUO_INTERACTION"),
      tempId: nextId(),
      personalizationTouches: caps.hasRecipientName
        ? [touch("RECIPIENT_NAME", "context")]
        : undefined,
      reason: "Interaction duo — mécanique à développer",
    })
    personalLeft--
  }
  if (profile.audience === "GROUP" && personalLeft > 0) {
    bag.push({
      archetype: getArchetype("GROUP_WHO_IN_THE_BAND"),
      tempId: nextId(),
      personalizationTouches: [touch("CLOSE_PEOPLE_NAMES", "label")],
      reason: "Contenu collectif — mécanique à développer",
    })
    personalLeft--
  }
  // leftover personalLeft intentionally unused — do not pad with reflection

  // --- Intentional light-touch mechanics (explicit MISSING intents) ---
  pushTouchMechanicIntents({
    bag,
    caps,
    slots: targets.touchMechanicSlots,
    nextId,
  })

  // --- Quick / light — neutral by default; optional light-touch enrich ---
  let quick = targets.quickLight
  while (quick > 0) {
    if ((profile.audience === "GROUP" || profile.audience === "DUO") && quick > 0 && rng.next() > 0.55) {
      bag.push({
        archetype: getArchetype("GROUP_QUICK_GAME"),
        tempId: nextId(),
        reason: "Jeu rapide collectif — mécanique à venir",
      })
      quick--
      continue
    }
    bag.push({
      archetype: getArchetype("LIGHT_ACTIVITY"),
      tempId: nextId(),
      reason: "Activité légère / neutre",
    })
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

  // Diffuse personalization touches across ordinary games (THEME / quick)
  applyDiffuseTouches(bag, caps, targets.touchBudget, rng)

  return bag
}

function pushTouchMechanicIntents(input: {
  bag: DraftIntent[]
  caps: PersonalizationCapabilities
  slots: number
  nextId: () => string
}) {
  const { bag, caps, nextId } = input
  let left = input.slots
  const candidates: Array<{
    id: string
    ok: boolean
    touches: PersonalizationTouch[]
    reason: string
  }> = [
    {
      id: "LOGIC_AGE_GAME",
      ok: caps.hasAge || caps.hasBirthDate,
      touches: [
        ...(caps.hasAge ? [touch("RECIPIENT_AGE", "theme")] : []),
        ...(caps.hasBirthDate ? [touch("BIRTH_DATE", "theme")] : []),
      ],
      reason: "Jeu logique personnalisé par l'âge",
    },
    {
      id: "SECRET_WORD_NAME_GAME",
      ok: caps.hasRecipientName,
      touches: [touch("RECIPIENT_NAME", "solution")],
      reason: "Mot secret personnalisé par le prénom",
    },
    {
      id: "LOGIC_CLOSE_PEOPLE_GAME",
      ok: caps.hasClosePeople || caps.hasFamilyContext,
      touches: [
        ...(caps.hasClosePeople ? [touch("CLOSE_PEOPLE_NAMES", "label")] : []),
        ...(caps.hasFamilyContext ? [touch("FAMILY_CONTEXT", "context")] : []),
      ],
      reason: "Jeu de logique avec proches",
    },
    {
      id: "PERSONALITY_TEST_TRAITS",
      ok: caps.hasTraits,
      touches: [
        touch("TRAITS", "result_copy"),
        ...(caps.hasFamilyContext ? [touch("FAMILY_CONTEXT", "context")] : []),
      ],
      reason: "Test contextualisé par traits",
    },
  ]

  for (const c of candidates) {
    if (left <= 0) break
    if (!c.ok) continue
    bag.push({
      archetype: getArchetype(c.id),
      tempId: nextId(),
      personalizationTouches: c.touches,
      reason: c.reason,
    })
    left--
  }
}

/** Decorate theme/quick pages with PersonalizationTouches up to touchBudget. */
function applyDiffuseTouches(
  bag: DraftIntent[],
  caps: PersonalizationCapabilities,
  touchBudget: number,
  rng: ReturnType<typeof createRng>,
) {
  const available = availableTouchTypes(caps)
  if (!available.length || touchBudget <= 0) return

  let touched = bag.filter((b) => (b.personalizationTouches?.length ?? 0) > 0).length
  if (touched >= touchBudget) return

  const decorateable = bag.filter((b) => {
    if ((b.personalizationTouches?.length ?? 0) > 0) return false
    const fam = b.archetype.family
    return fam === "THEME_GAME" || fam === "QUICK_GAME"
  })

  // Prefer READY theme games (especially wordsearch when close people exist), then others
  const ranked = decorateable.slice().sort((a, b) => {
    const score = (x: DraftIntent) => {
      let s = 0
      if (x.archetype.implementationStatus === "READY") s += 10
      if (x.archetype.id === "THEME_WORDSEARCH" && caps.hasClosePeople) s += 8
      if (x.archetype.id === "THEME_QUIZ") s += 2
      if (x.archetype.family === "THEME_GAME") s += 3
      return s
    }
    return score(b) - score(a)
  })
  // Soft shuffle within score bands via rng for determinism with seed
  void rng

  for (const intent of ranked) {
    if (touched >= touchBudget) break
    const suggested = intent.archetype.suggestedTouchTypes ?? []
    const picks = pickTouchesForArchetype(intent.archetype.id, suggested, available)
    if (!picks.length) continue
    intent.personalizationTouches = picks
    intent.reason = `${intent.reason} · touches: ${picks.map((t) => t.type).join(", ")}`
    touched++
  }
}

function pickTouchesForArchetype(
  archetypeId: string,
  suggested: PersonalizationTouchType[],
  available: PersonalizationTouchType[],
): PersonalizationTouch[] {
  const pool = (suggested.length ? suggested : available).filter((t) => available.includes(t))
  if (!pool.length) return []

  const usageFor = (type: PersonalizationTouchType): PersonalizationTouch["usage"] => {
    if (archetypeId.includes("WORDSEARCH")) {
      if (type === "CLOSE_PEOPLE_NAMES" || type === "TRAITS" || type === "RECIPIENT_NAME") {
        return "word_list"
      }
    }
    if (archetypeId.includes("SECRET")) return "solution"
    if (archetypeId.includes("LOGIC") && type === "RECIPIENT_AGE") return "theme"
    if (type === "TRAITS") return "result_copy"
    if (type === "INTERESTS") return "theme"
    if (type === "CLOSE_PEOPLE_NAMES") return "label"
    if (type === "RECIPIENT_NAME") return "title"
    return "context"
  }

  // Prefer 1–2 touches per page
  const selected = pool.slice(0, Math.min(2, pool.length))
  return selected.map((t) => touch(t, usageFor(t)))
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
      dataNeed: item.archetype.dataNeed,
      ...(item.personalizationTouches?.length
        ? { personalizationTouches: item.personalizationTouches }
        : {}),
      ...(item.personalLayoutId ? { personalLayoutId: item.personalLayoutId } : {}),
      ...(item.photoLayoutId ? { photoLayoutId: item.photoLayoutId } : {}),
      ...(item.photoTemplateId ? { photoTemplateId: item.photoTemplateId } : {}),
      ...(item.sourceMemoryIds?.length ? { sourceMemoryIds: item.sourceMemoryIds } : {}),
      ...(item.sourcePhotoIds?.length ? { sourcePhotoIds: item.sourcePhotoIds } : {}),
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
    PERSONAL_EDITORIAL: 0,
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
  const readyThemeGamePages = pages.filter(
    (p) =>
      p.family === "THEME_GAME" &&
      p.implementationStatus === "READY" &&
      !!p.gameId,
  ).length
  const missingMechanicPages = pages.filter(
    (p) =>
      p.archetypeId === "THEME_VARIETY_GAME" ||
      p.archetypeId === "LOGIC_AGE_GAME" ||
      p.archetypeId === "SECRET_WORD_NAME_GAME" ||
      p.archetypeId === "LOGIC_CLOSE_PEOPLE_GAME" ||
      p.archetypeId === "PERSONALITY_TEST_TRAITS" ||
      p.archetypeId === "LIGHT_ACTIVITY",
  ).length

  const photoAlbum = pages.filter(
    (p) =>
      p.archetypeId === "PHOTO_COLLAGE_PAGE" ||
      p.archetypeId === "PHOTO_TIMELINE_PAGE",
  )
  const personalEditorial = pages.filter((p) => p.archetypeId === "PERSONAL_EDITORIAL_PAGE")
  const photoPages = photoAlbum.length
  const memoryPages = pages.filter(
    (p) =>
      p.archetypeId === "MEMORY_TEXT_PAGE" ||
      (p.sourceMemoryIds?.length ?? 0) > 0,
  ).length

  const byDataNeed: Record<PageDataNeed, number> = {
    NEUTRAL: 0,
    THEME: 0,
    LIGHT_PERSONAL: 0,
    DEEP_PERSONAL: 0,
    PHOTO: 0,
  }
  for (const p of pages) {
    const need = p.dataNeed ?? getArchetype(p.archetypeId).dataNeed ?? inferDataNeed(p)
    byDataNeed[need]++
  }

  const pagesWithTouches = pages.filter((p) => (p.personalizationTouches?.length ?? 0) > 0).length
  const personalizedCount = pages.filter((p) =>
    pageCountsAsPersonalized({
      personalizationTouches: p.personalizationTouches,
      dataNeed: p.dataNeed ?? getArchetype(p.archetypeId).dataNeed,
      family: p.family,
    }),
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
    personalPercent: Math.round((personalizedCount / n) * 100),
    pagesWithTouches,
    readyPercent: Math.round((byStatus.READY / n) * 100),
    missingPercent: Math.round((byStatus.MISSING / n) * 100),
    photoPages,
    memoryPages,
    personalEditorialPages: personalEditorial.length,
    mainGamePages: byFamily.THEME_GAME,
    quickGamePages: byFamily.QUICK_GAME,
    correctionPages: byFamily.CORRECTION,
    readyThemeGamePages,
    missingMechanicPages,
    byDataNeed,
  }
}

function inferDataNeed(p: BlueprintPageSlot): PageDataNeed {
  if (p.family === "PHOTO") return "PHOTO"
  if (p.family === "THEME_GAME") return "THEME"
  if (p.personalizationType === "PERSONAL") return "LIGHT_PERSONAL"
  return "NEUTRAL"
}
