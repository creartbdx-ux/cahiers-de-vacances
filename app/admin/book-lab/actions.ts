"use server"

import { getCurrentUser } from "@/lib/auth"
import { canUseInEditorialLab, parseQuestionnairePayload } from "@/lib/books/lifecycle"
import { createBookPhotoSignedUrls, getBookProject } from "@/lib/data/books"
import { getGames, getUniverses } from "@/lib/data/reference"
import { buildEditorialPlan } from "@/lib/editorial-engine"
import type { EditorialGameSlot } from "@/lib/editorial-engine/types"
import {
  buildCrosswordThemeContext,
  buildQuizThemeContext,
  buildWordSearchThemeContext,
  generateCrosswordThemeContent,
  generateQuizThemeContent,
  generateWordSearchThemeContent,
  isContentGenerationConfigured,
  createDefaultContentGenerationProvider,
} from "@/lib/content-generation"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"
import { resolveBookVisualIdentity } from "@/lib/mini-book/visual-identity"
import { getActivePalettes } from "@/lib/data/assets"
import { getStyles } from "@/lib/data/reference"
import type { MiniBookVisualIdentity } from "@/lib/mini-book/types"
import { buildMemoryPage, buildPhotoMemoryPage } from "@/lib/memory-pages"
import {
  composePersonalEditorialWithAi,
  pageProvenance,
  type PersonalEditorialPageV1,
} from "@/lib/personal-editorial"

export type BookLabSlotSummary = {
  slotId: string
  gameId: "QUIZ_THEME" | "WORDSEARCH_THEME" | "CROSSWORD_THEME"
  universeId: string | null
  universeName: string | null
  difficulty: number
  seed: string
}

export type BookLabPlanResult =
  | {
      ok: true
      seed: string
      visualIdentity: MiniBookVisualIdentity
      slots: {
        quiz: BookLabSlotSummary | null
        wordsearch: BookLabSlotSummary | null
        crossword: BookLabSlotSummary | null
      }
      missing: string[]
    }
  | { ok: false; message: string }

async function requireAdminProject(input: {
  bookProjectId: string
  seed: string
}) {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false as const, message: "Accès admin requis." }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) {
    return { ok: false as const, message: "Projet introuvable." }
  }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false as const, message: "BookProfileV1 manquant sur ce projet." }
  }

  let richnessLevel = parsed.richnessLevel
  if (!richnessLevel && parsed.questionnaire) {
    richnessLevel = calculateProfileRichness(parsed.questionnaire, parsed.profile).level
  }
  if (
    !canUseInEditorialLab({
      status: project.status,
      profile: parsed.profile,
      richnessLevel: richnessLevel ?? null,
    })
  ) {
    return { ok: false as const, message: "Projet non éligible au Book Lab." }
  }

  const [games, universes, palettes, styles] = await Promise.all([
    getGames(),
    getUniverses(),
    getActivePalettes(),
    getStyles(),
  ])

  const seed = input.seed.trim() || "lab-seed-1"
  const plan = buildEditorialPlan({
    profile: parsed.profile,
    seed,
    games,
    richnessLevel: richnessLevel ?? "ENOUGH",
    maxSlots: 8,
  })

  const visualIdentity = resolveBookVisualIdentity({
    profile: parsed.profile,
    seed,
    styles,
    palettes,
  })

  return {
    ok: true as const,
    project,
    profile: parsed.profile,
    plan,
    games,
    universes,
    palettes,
    styles,
    seed,
    visualIdentity,
  }
}

function universeNameOf(
  universes: Awaited<ReturnType<typeof getUniverses>>,
  id: string | null | undefined,
): string | null {
  if (!id) return null
  return universes.find((u) => u.id === id)?.name ?? id
}

function toSlotSummary(
  slot: EditorialGameSlot,
  universes: Awaited<ReturnType<typeof getUniverses>>,
): BookLabSlotSummary {
  return {
    slotId: slot.slotId,
    gameId: slot.gameId as BookLabSlotSummary["gameId"],
    universeId: slot.universeId,
    universeName: universeNameOf(universes, slot.universeId),
    difficulty: slot.difficulty,
    seed: slot.seed,
  }
}

/**
 * Build plan + visual identity only — no IA.
 */
export async function getBookLabPlanAction(input: {
  bookProjectId: string
  seed: string
}): Promise<BookLabPlanResult> {
  const ctx = await requireAdminProject(input)
  if (!ctx.ok) return ctx

  const quiz = ctx.plan.selectedGames.find((s) => s.gameId === "QUIZ_THEME") ?? null
  const wordsearch = ctx.plan.selectedGames.find((s) => s.gameId === "WORDSEARCH_THEME") ?? null
  const crossword = ctx.plan.selectedGames.find((s) => s.gameId === "CROSSWORD_THEME") ?? null

  const missing: string[] = []
  if (!quiz) missing.push("QUIZ_THEME")
  if (!wordsearch) missing.push("WORDSEARCH_THEME")
  if (!crossword) missing.push("CROSSWORD_THEME")

  return {
    ok: true,
    seed: ctx.seed,
    visualIdentity: ctx.visualIdentity,
    slots: {
      quiz: quiz ? toSlotSummary(quiz, ctx.universes) : null,
      wordsearch: wordsearch ? toSlotSummary(wordsearch, ctx.universes) : null,
      crossword: crossword ? toSlotSummary(crossword, ctx.universes) : null,
    },
    missing,
  }
}

export type BookLabQuizContent = {
  ok: true
  slotId: string
  title: string
  universeId: string
  universeName: string
  seed: string
  questions: Array<{
    id: string
    question: string
    questionStyle: string
    topicKey: string
    topicLabel: string
    choices: [string, string, string, string]
    correctIndex: 0 | 1 | 2 | 3
    explanation: string
  }>
}

export type BookLabWordsearchContent = {
  ok: true
  slotId: string
  title: string
  universeId: string
  universeName: string
  seed: string
  words: Array<{ display: string; normalized: string; topicKey: string }>
}

export type BookLabCrosswordContent = {
  ok: true
  slotId: string
  title: string
  universeId: string
  universeName: string
  seed: string
  entries: Array<{
    answer: string
    normalized: string
    clue: string
    topicKey: string
    topicLabel: string
  }>
}

export type BookLabGameGenResult =
  | BookLabQuizContent
  | BookLabWordsearchContent
  | BookLabCrosswordContent
  | { ok: false; code?: string; message: string; details?: string[] }

function resolveUniverse(
  universes: Awaited<ReturnType<typeof getUniverses>>,
  universeId: string | null,
) {
  return (
    universes.find((u) => u.id === universeId) ??
    (universeId
      ? {
          id: universeId,
          name: universeId,
          editorial_description: null,
          allowed_topics: [],
          excluded_topics: [],
          quiz_guidance: null,
        }
      : null)
  )
}

/**
 * Generate one theme game for Book Lab. Does not persist.
 */
export async function generateBookLabGameAction(input: {
  bookProjectId: string
  seed: string
  gameId: "QUIZ_THEME" | "WORDSEARCH_THEME" | "CROSSWORD_THEME"
}): Promise<BookLabGameGenResult> {
  if (!isContentGenerationConfigured()) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur.",
    }
  }

  const ctx = await requireAdminProject(input)
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const slot = ctx.plan.selectedGames.find((s) => s.gameId === input.gameId)
  if (!slot) {
    return {
      ok: false,
      message: `Aucun slot ${input.gameId} dans le plan éditorial.`,
    }
  }

  const universe = resolveUniverse(ctx.universes, slot.universeId)
  const uName = universeNameOf(ctx.universes, slot.universeId) ?? slot.universeId ?? "—"

  if (input.gameId === "QUIZ_THEME") {
    const themeContext = buildQuizThemeContext({ slot, universe })
    const result = await generateQuizThemeContent({
      slot,
      universe: universe ?? undefined,
      universeName: themeContext.universeName,
      bookProjectId: ctx.project.id,
    })
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        details: result.details,
      }
    }
    return {
      ok: true,
      slotId: slot.slotId,
      title: result.generated.title,
      universeId: themeContext.universeId,
      universeName: themeContext.universeName || uName,
      seed: slot.seed,
      questions: result.generated.questions.map((q) => ({
        id: q.id,
        question: q.question,
        questionStyle: q.questionStyle,
        topicKey: q.topicKey,
        topicLabel: q.topicLabel,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
    }
  }

  if (input.gameId === "WORDSEARCH_THEME") {
    const themeContext = buildWordSearchThemeContext({ slot, universe })
    const result = await generateWordSearchThemeContent({
      slot,
      universe: universe ?? undefined,
      universeName: themeContext.universeName,
      bookProjectId: ctx.project.id,
    })
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        details: result.details,
      }
    }
    return {
      ok: true,
      slotId: slot.slotId,
      title: result.generated.title,
      universeId: themeContext.universeId,
      universeName: themeContext.universeName || uName,
      seed: slot.seed,
      words: result.generated.words.map((w) => ({
        display: w.display,
        normalized: w.normalized,
        topicKey: w.topicKey,
      })),
    }
  }

  const themeContext = buildCrosswordThemeContext({ slot, universe })
  const result = await generateCrosswordThemeContent({
    slot,
    universe: universe ?? undefined,
    universeName: themeContext.universeName,
    bookProjectId: ctx.project.id,
  })
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      details: result.details,
    }
  }
  return {
    ok: true,
    slotId: slot.slotId,
    title: result.generated.title,
    universeId: themeContext.universeId,
    universeName: themeContext.universeName || uName,
    seed: slot.seed,
    entries: result.generated.entries.map((e) => ({
      answer: e.answer,
      normalized: e.normalized,
      clue: e.clue,
      topicKey: e.topicKey,
      topicLabel: e.topicLabel,
    })),
  }
}

export async function getBookLabAiStatusAction(): Promise<{ configured: boolean }> {
  return { configured: isContentGenerationConfigured() }
}

export type BookLabMemoryPageResult =
  | {
      ok: true
      memoryId: string
      originalText: string
      originalTitle: string | null
      originalPlace: string | null
      participantIds: string[]
      variant: "TEXT_ONLY"
      density: "SHORT" | "MEDIUM" | "RICH"
      fullPageRecommended: boolean
      usedAi: boolean
      title: string
      eyebrow: string | null
      body: string
      place: string | null
      sourcePhotoIds: string[]
      visualIdentity: MiniBookVisualIdentity
      visualRole: "LIGHT" | "SECONDARY" | "ACCENT"
    }
  | { ok: false; message: string; details?: string[] }

export type BookLabPhotoMemoryPageResult =
  | {
      ok: true
      photoId: string
      storagePath: string
      caption: string | null
      anecdote: string | null
      participantIds: string[]
      density: "SHORT" | "MEDIUM" | "RICH"
      layout: "LANDSCAPE" | "PORTRAIT" | "SQUARE"
      fullPageRecommended: boolean
      weakSource: boolean
      usedAi: boolean
      title: string
      eyebrow: string | null
      body: string
      photoUrl: string | null
      visualIdentity: MiniBookVisualIdentity
      visualRole: "LIGHT" | "SECONDARY" | "ACCENT"
    }
  | { ok: false; message: string; details?: string[] }

/**
 * Prepare a MEMORY_TEXT_PAGE preview for Book Lab.
 * Does not persist. IA only when useAi=true and provider configured.
 * Never attaches an unrelated photo.
 */
export async function prepareBookLabMemoryPageAction(input: {
  bookProjectId: string
  seed: string
  memoryId?: string
  /** When false, never call the LLM (default for first paint). */
  useAi?: boolean
}): Promise<BookLabMemoryPageResult> {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false, message: "Accès admin requis." }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) return { ok: false, message: "Projet introuvable." }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false, message: "BookProfileV1 manquant sur ce projet." }
  }

  let richnessLevel = parsed.richnessLevel
  if (!richnessLevel && parsed.questionnaire) {
    richnessLevel = calculateProfileRichness(parsed.questionnaire, parsed.profile).level
  }
  if (
    !canUseInEditorialLab({
      status: project.status,
      profile: parsed.profile,
      richnessLevel: richnessLevel ?? null,
    })
  ) {
    return { ok: false, message: "Projet non éligible au Book Lab." }
  }

  const [palettes, styles] = await Promise.all([getActivePalettes(), getStyles()])
  const seed = input.seed.trim() || "lab-seed-1"
  const visualIdentity = resolveBookVisualIdentity({
    profile: parsed.profile,
    seed,
    styles,
    palettes,
  })

  const useAi = Boolean(input.useAi) && isContentGenerationConfigured()
  const result = await buildMemoryPage({
    profile: parsed.profile,
    seed: `${seed}:memory-text-page`,
    memoryId: input.memoryId,
    forceFallback: !useAi,
  })

  if (!result.ok) {
    return { ok: false, message: result.message, details: result.details }
  }

  const roles = ["LIGHT", "SECONDARY", "ACCENT"] as const
  const roleIndex = Math.abs(hashSeed(`${seed}:${result.source.memoryId}`)) % roles.length

  return {
    ok: true,
    memoryId: result.source.memoryId,
    originalText: result.source.originalText,
    originalTitle: result.source.title ?? null,
    originalPlace: result.source.place ?? null,
    participantIds: result.source.participantIds,
    variant: "TEXT_ONLY",
    density: result.density,
    fullPageRecommended: result.fullPageRecommended,
    usedAi: result.editorial.usedAi,
    title: result.editorial.title,
    eyebrow: result.editorial.eyebrow,
    body: result.editorial.body,
    place: result.editorial.place,
    sourcePhotoIds: [],
    visualIdentity,
    visualRole: roles[roleIndex]!,
  }
}

/**
 * Prepare a PHOTO_MEMORY_PAGE preview for Book Lab from one authorized photo.
 */
export async function prepareBookLabPhotoMemoryPageAction(input: {
  bookProjectId: string
  seed: string
  photoId: string
  useAi?: boolean
  /** Optional width/height ratio for layout (LANDSCAPE / PORTRAIT / SQUARE). */
  aspectRatio?: number
}): Promise<BookLabPhotoMemoryPageResult> {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false, message: "Accès admin requis." }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) return { ok: false, message: "Projet introuvable." }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false, message: "BookProfileV1 manquant sur ce projet." }
  }

  let richnessLevel = parsed.richnessLevel
  if (!richnessLevel && parsed.questionnaire) {
    richnessLevel = calculateProfileRichness(parsed.questionnaire, parsed.profile).level
  }
  if (
    !canUseInEditorialLab({
      status: project.status,
      profile: parsed.profile,
      richnessLevel: richnessLevel ?? null,
    })
  ) {
    return { ok: false, message: "Projet non éligible au Book Lab." }
  }

  const [palettes, styles] = await Promise.all([getActivePalettes(), getStyles()])
  const seed = input.seed.trim() || "lab-seed-1"
  const visualIdentity = resolveBookVisualIdentity({
    profile: parsed.profile,
    seed,
    styles,
    palettes,
  })

  const photoSignedUrls: Record<string, string> = {}
  const photo = parsed.profile.photos.find((p) => p.id === input.photoId)
  if (photo?.storagePath) {
    const byPath = await createBookPhotoSignedUrls([photo.storagePath])
    if (byPath[photo.storagePath]) {
      photoSignedUrls[photo.id] = byPath[photo.storagePath]!
    }
  }

  const useAi = Boolean(input.useAi) && isContentGenerationConfigured()
  const result = await buildPhotoMemoryPage({
    profile: parsed.profile,
    seed: `${seed}:photo-memory-page`,
    photoId: input.photoId,
    photoSignedUrls,
    aspectRatios:
      input.aspectRatio != null ? { [input.photoId]: input.aspectRatio } : undefined,
    forceFallback: !useAi,
  })

  if (!result.ok) {
    return { ok: false, message: result.message, details: result.details }
  }

  const roles = ["LIGHT", "SECONDARY", "ACCENT"] as const
  const roleIndex = Math.abs(hashSeed(`${seed}:${result.source.photoId}`)) % roles.length

  return {
    ok: true,
    photoId: result.source.photoId,
    storagePath: result.source.storagePath,
    caption: result.source.caption,
    anecdote: result.source.anecdote,
    participantIds: result.source.participantIds,
    density: result.density,
    layout: result.editorial.layout,
    fullPageRecommended: result.fullPageRecommended,
    weakSource: result.editorial.weakSource,
    usedAi: result.editorial.usedAi,
    title: result.editorial.title,
    eyebrow: result.editorial.eyebrow,
    body: result.editorial.body,
    photoUrl: result.source.signedUrl,
    visualIdentity,
    visualRole: roles[roleIndex]!,
  }
}

export type BookLabPersonalEditorialResult =
  | {
      ok: true
      blockCount: number
      pageCount: number
      overallMode: "AI" | "FALLBACK" | "MIXED"
      aiConfigured: boolean
      aiCallCount: number
      fallbackBanner: boolean
      /** Packed pages before AI — for regenerate copy without re-packing. */
      packedPages: PersonalEditorialPageV1[]
      pages: Array<{
        pageKey: string
        layoutId: PersonalEditorialPageV1["layoutId"]
        visualRole: PersonalEditorialPageV1["visualRole"]
        weight: number
        isHero: boolean
        editorialMode: "AI" | "FALLBACK"
        validationOk: boolean
        sourceMemoryIds: string[]
        sourcePhotoIds: string[]
        page: PersonalEditorialPageV1
      }>
      visualIdentity: MiniBookVisualIdentity
    }
  | { ok: false; message: string }

async function loadBookLabPersonalContext(input: {
  bookProjectId: string
  seed: string
}) {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false as const, message: "Accès admin requis." }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) return { ok: false as const, message: "Projet introuvable." }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false as const, message: "BookProfileV1 manquant sur ce projet." }
  }

  let richnessLevel = parsed.richnessLevel
  if (!richnessLevel && parsed.questionnaire) {
    richnessLevel = calculateProfileRichness(parsed.questionnaire, parsed.profile).level
  }
  if (
    !canUseInEditorialLab({
      status: project.status,
      profile: parsed.profile,
      richnessLevel: richnessLevel ?? null,
    })
  ) {
    return { ok: false as const, message: "Projet non éligible au Book Lab." }
  }

  const [palettes, styles] = await Promise.all([getActivePalettes(), getStyles()])
  const seed = input.seed.trim() || "lab-seed-1"
  const visualIdentity = resolveBookVisualIdentity({
    profile: parsed.profile,
    seed,
    styles,
    palettes,
  })

  const photoSignedUrls: Record<string, string> = {}
  const paths = (parsed.profile.photos ?? [])
    .filter((p) => p.useAuthorized && p.storagePath)
    .map((p) => p.storagePath as string)
  if (paths.length) {
    const byPath = await createBookPhotoSignedUrls(paths)
    for (const p of parsed.profile.photos ?? []) {
      if (p.storagePath && byPath[p.storagePath]) {
        photoSignedUrls[p.id] = byPath[p.storagePath]!
      }
    }
  }

  // OTHER_PERSON: creator display name from auth metadata when available
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const metaFirst =
    (typeof meta?.first_name === "string" && meta.first_name.trim()) ||
    (typeof meta?.full_name === "string" && meta.full_name.trim().split(/\s+/)[0]) ||
    null
  const creatorName =
    parsed.profile.audience === "OTHER_PERSON" ? metaFirst : null

  return {
    ok: true as const,
    profile: parsed.profile,
    seed,
    visualIdentity,
    photoSignedUrls,
    creatorName,
  }
}

/**
 * Compose + éditorialisation IA des pages personnelles (voie principale si API key).
 */
export async function prepareBookLabPersonalEditorialAction(input: {
  bookProjectId: string
  seed: string
}): Promise<BookLabPersonalEditorialResult> {
  const ctx = await loadBookLabPersonalContext(input)
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const provider = createDefaultContentGenerationProvider()
  const composed = await composePersonalEditorialWithAi({
    profile: ctx.profile,
    seed: `${ctx.seed}:personal-editorial-lab`,
    photoSignedUrls: ctx.photoSignedUrls,
    creatorName: ctx.creatorName,
    provider,
  })

  return {
    ok: true,
    blockCount: composed.blockCount,
    pageCount: composed.pageCount,
    overallMode: composed.overallMode,
    aiConfigured: composed.aiConfigured,
    aiCallCount: composed.aiCallCount,
    fallbackBanner: composed.fallbackBanner,
    packedPages: composed.packedPages,
    pages: composed.pages.map((page, i) => {
      const prov = pageProvenance(page)
      const result = composed.results[i]
      return {
        pageKey: page.pageKey,
        layoutId: page.layoutId,
        visualRole: page.visualRole,
        weight: page.weight,
        isHero: page.isHero,
        editorialMode: (page.editorialMode ?? result?.mode ?? "FALLBACK") as
          | "AI"
          | "FALLBACK",
        validationOk: result?.validationOk ?? true,
        sourceMemoryIds: prov.sourceMemoryIds,
        sourcePhotoIds: prov.sourcePhotoIds,
        page,
      }
    }),
    visualIdentity: ctx.visualIdentity,
  }
}

/**
 * Régénère uniquement la rédaction IA — packing / sources inchangés.
 */
export async function regenerateBookLabPersonalEditorialCopyAction(input: {
  bookProjectId: string
  seed: string
  packedPages: PersonalEditorialPageV1[]
}): Promise<BookLabPersonalEditorialResult> {
  const ctx = await loadBookLabPersonalContext(input)
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const provider = createDefaultContentGenerationProvider()
  const composed = await composePersonalEditorialWithAi({
    profile: ctx.profile,
    seed: `${ctx.seed}:personal-editorial-regen:${Date.now()}`,
    photoSignedUrls: ctx.photoSignedUrls,
    creatorName: ctx.creatorName,
    provider,
    packedPages: input.packedPages,
  })

  return {
    ok: true,
    blockCount: composed.blockCount,
    pageCount: composed.pageCount,
    overallMode: composed.overallMode,
    aiConfigured: composed.aiConfigured,
    aiCallCount: composed.aiCallCount,
    fallbackBanner: composed.fallbackBanner,
    packedPages: input.packedPages,
    pages: composed.pages.map((page, i) => {
      const prov = pageProvenance(page)
      const result = composed.results[i]
      return {
        pageKey: page.pageKey,
        layoutId: page.layoutId,
        visualRole: page.visualRole,
        weight: page.weight,
        isHero: page.isHero,
        editorialMode: (page.editorialMode ?? result?.mode ?? "FALLBACK") as
          | "AI"
          | "FALLBACK",
        validationOk: result?.validationOk ?? true,
        sourceMemoryIds: prov.sourceMemoryIds,
        sourcePhotoIds: prov.sourcePhotoIds,
        page,
      }
    }),
    visualIdentity: ctx.visualIdentity,
  }
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
