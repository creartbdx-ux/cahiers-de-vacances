"use server"

import { getCurrentUser } from "@/lib/auth"
import { canUseInEditorialLab, parseQuestionnairePayload } from "@/lib/books/lifecycle"
import { getBookProject } from "@/lib/data/books"
import { getGames } from "@/lib/data/reference"
import { buildEditorialPlan } from "@/lib/editorial-engine"
import {
  buildCrosswordThemeContext,
  buildQuizPersonalSourceContext,
  buildQuizThemeContext,
  buildTrueFalseThemeContext,
  buildWordSearchThemeContext,
  generateCrosswordThemeContent,
  generateQuizPersonalContent,
  generateQuizThemeContent,
  generateTrueFalseThemeContent,
  generateWordSearchThemeContent,
  isContentGenerationConfigured,
  lookupSourceText,
  summarizeSourceContext,
  type GeneratedCrosswordThemeEntry,
  type GeneratedQuizPersonalQuestion,
  type GeneratedQuizThemeQuestion,
  type GeneratedTrueFalseThemeStatement,
  type GeneratedWordSearchThemeWord,
} from "@/lib/content-generation"
import type { WordSearchSuccess } from "@/lib/game-engines/wordsearch/types"
import { getUniverses } from "@/lib/data/reference"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"
import type { QuizQuestion } from "@/lib/game-engines/quiz/types"

export type QuizPersonalLabQuestionView = {
  id: string
  question: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation?: string
  sourceLabels: string[]
}

export type GenerateQuizPersonalLabResult =
  | {
      ok: true
      configured: true
      slotId: string
      questionCount: number
      durationMs: number
      repaired: boolean
      sourceSummary: {
        factCount: number
        memoryCount: number
        jokeCount: number
        participantNames: string[]
        audience: string
        targetParticipantNames: string[]
        creatorIsParticipant: boolean
      }
      usedSourceIds: {
        factIds: string[]
        memoryIds: string[]
        jokeIds: string[]
        participantIds: string[]
      }
      unusedSourceIds: {
        factIds: string[]
        memoryIds: string[]
        jokeIds: string[]
        participantIds: string[]
      }
      warnings: string[]
      questions: QuizPersonalLabQuestionView[]
      engineQuestions: QuizQuestion[]
      seed: string
    }
  | {
      ok: false
      configured: boolean
      message: string
      details?: string[]
      code?: string
    }

export async function getContentGenerationStatusAction(): Promise<{ configured: boolean }> {
  return { configured: isContentGenerationConfigured() }
}

/**
 * Admin-only: rebuild plan server-side, generate QUIZ_PERSONAL for one slot.
 * Does not persist to generated_pages.
 */
export async function generateQuizPersonalLabAction(input: {
  bookProjectId: string
  seed: string
  slotId: string
}): Promise<GenerateQuizPersonalLabResult> {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false, configured: isContentGenerationConfigured(), message: "Accès admin requis." }
  }

  if (!isContentGenerationConfigured()) {
    return {
      ok: false,
      configured: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur (Vercel → Settings → Environment Variables), puis redéployez.",
    }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) {
    return { ok: false, configured: true, message: "Projet introuvable." }
  }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false, configured: true, message: "BookProfileV1 manquant sur ce projet." }
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
    return { ok: false, configured: true, message: "Projet non éligible à l'Editorial Lab." }
  }

  const games = await getGames()
  const plan = buildEditorialPlan({
    profile: parsed.profile,
    seed: input.seed.trim() || "lab-seed-1",
    games,
    richnessLevel: richnessLevel ?? "ENOUGH",
    maxSlots: 8,
  })

  const slot = plan.selectedGames.find((s) => s.slotId === input.slotId)
  if (!slot) {
    return { ok: false, configured: true, message: "Slot introuvable dans le plan reconstruit." }
  }
  if (slot.gameId !== "QUIZ_PERSONAL") {
    return {
      ok: false,
      configured: true,
      message: "Ce slot n'est pas QUIZ_PERSONAL.",
    }
  }

  const context = buildQuizPersonalSourceContext({ profile: parsed.profile, slot })
  const result = await generateQuizPersonalContent({
    profile: parsed.profile,
    slot,
    bookProjectId: project.id,
  })

  if (!result.ok) {
    return {
      ok: false,
      configured: result.code !== "NOT_CONFIGURED",
      code: result.code,
      message: result.message,
      details: result.details,
    }
  }

  if (!result.engineResult.success) {
    return {
      ok: false,
      configured: true,
      code: "ENGINE_REJECTED",
      message: result.engineResult.message,
      details: result.engineResult.validation.errors,
    }
  }

  const questions = result.generated.questions.map((q) =>
    toLabQuestionView(q, context),
  )

  return {
    ok: true,
    configured: true,
    slotId: slot.slotId,
    questionCount: questions.length,
    durationMs: result.durationMs,
    repaired: result.repaired,
    sourceSummary: summarizeSourceContext(context),
    usedSourceIds: result.validation.usedSourceIds,
    unusedSourceIds: result.validation.unusedSourceIds,
    warnings: result.validation.warnings,
    questions,
    engineQuestions: result.engineResult.questions,
    seed: slot.seed,
  }
}

function toLabQuestionView(
  q: GeneratedQuizPersonalQuestion,
  context: ReturnType<typeof buildQuizPersonalSourceContext>,
): QuizPersonalLabQuestionView {
  return {
    id: q.id,
    question: q.question,
    choices: q.choices,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    sourceLabels: q.sourceRefs.map((ref) => {
      const text = lookupSourceText(context, ref.type, ref.id)
      return text ? `${ref.type}: ${text}` : `${ref.type}:${ref.id}`
    }),
  }
}

export type QuizThemeLabQuestionView = {
  id: string
  question: string
  questionStyle: string
  topicKey: string
  topicLabel: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
}

export type GenerateQuizThemeLabResult =
  | {
      ok: true
      configured: true
      slotId: string
      title: string
      universeId: string
      universeName: string
      difficulty: number
      questionCount: number
      topics: string[]
      styles: string[]
      styleDistinctCount: number
      styleDiversityOk: boolean
      durationMs: number
      repaired: boolean
      repairedCount: number
      warnings: string[]
      questions: QuizThemeLabQuestionView[]
      engineQuestions: QuizQuestion[]
      seed: string
    }
  | {
      ok: false
      configured: boolean
      message: string
      details?: string[]
      code?: string
    }

/**
 * Admin-only: rebuild plan server-side, generate QUIZ_THEME for one slot.
 * Does not persist to generated_pages. No personal profile data sent to the LLM.
 */
export async function generateQuizThemeLabAction(input: {
  bookProjectId: string
  seed: string
  slotId: string
}): Promise<GenerateQuizThemeLabResult> {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false, configured: isContentGenerationConfigured(), message: "Accès admin requis." }
  }

  if (!isContentGenerationConfigured()) {
    return {
      ok: false,
      configured: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur (Vercel → Settings → Environment Variables), puis redéployez.",
    }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) {
    return { ok: false, configured: true, message: "Projet introuvable." }
  }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false, configured: true, message: "BookProfileV1 manquant sur ce projet." }
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
    return { ok: false, configured: true, message: "Projet non éligible à l'Editorial Lab." }
  }

  const [games, universes] = await Promise.all([getGames(), getUniverses()])
  const plan = buildEditorialPlan({
    profile: parsed.profile,
    seed: input.seed.trim() || "lab-seed-1",
    games,
    richnessLevel: richnessLevel ?? "ENOUGH",
    maxSlots: 8,
  })

  const slot = plan.selectedGames.find((s) => s.slotId === input.slotId)
  if (!slot) {
    return { ok: false, configured: true, message: "Slot introuvable dans le plan reconstruit." }
  }
  if (slot.gameId !== "QUIZ_THEME") {
    return {
      ok: false,
      configured: true,
      message: "Ce slot n'est pas QUIZ_THEME.",
    }
  }

  const universe =
    universes.find((u) => u.id === slot.universeId) ??
    (slot.universeId
      ? {
          id: slot.universeId,
          name: slot.universeId,
          editorial_description: null,
          allowed_topics: [],
          excluded_topics: [],
          quiz_guidance: null,
        }
      : null)

  const themeContext = buildQuizThemeContext({ slot, universe })
  const result = await generateQuizThemeContent({
    slot,
    universe: universe ?? undefined,
    universeName: themeContext.universeName,
    bookProjectId: project.id,
  })

  if (!result.ok) {
    return {
      ok: false,
      configured: result.code !== "NOT_CONFIGURED",
      code: result.code,
      message: result.message,
      details: result.details,
    }
  }

  if (!result.engineResult.success) {
    return {
      ok: false,
      configured: true,
      code: "ENGINE_REJECTED",
      message: result.engineResult.message,
      details: result.engineResult.validation.errors,
    }
  }

  const questions = result.generated.questions.map(toThemeLabQuestionView)

  return {
    ok: true,
    configured: true,
    slotId: slot.slotId,
    title: result.generated.title,
    universeId: themeContext.universeId,
    universeName: themeContext.universeName,
    difficulty: themeContext.difficulty,
    questionCount: questions.length,
    topics: result.validation.topics,
    styles: result.validation.styles,
    styleDistinctCount: result.validation.styleDistinctCount,
    styleDiversityOk: result.validation.styleDiversityOk,
    durationMs: result.durationMs,
    repaired: result.repaired,
    repairedCount: result.repairedCount,
    warnings: result.validation.warnings,
    questions,
    engineQuestions: result.engineResult.questions,
    seed: slot.seed,
  }
}

function toThemeLabQuestionView(q: GeneratedQuizThemeQuestion): QuizThemeLabQuestionView {
  return {
    id: q.id,
    question: q.question,
    questionStyle: q.questionStyle,
    topicKey: q.topicKey,
    topicLabel: q.topicLabel,
    choices: q.choices,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }
}

export type WordsearchThemeLabWordView = {
  display: string
  normalized: string
  topicKey: string
}

export type GenerateWordsearchThemeLabResult =
  | {
      ok: true
      configured: true
      slotId: string
      title: string
      universeId: string
      universeName: string
      difficulty: number
      wordCount: number
      topicKeys: string[]
      topicDistinctCount: number
      topicDiversityOk: boolean
      durationMs: number
      repaired: boolean
      repairedCount: number
      warnings: string[]
      words: WordsearchThemeLabWordView[]
      engineWordSearch: WordSearchSuccess
      seed: string
    }
  | {
      ok: false
      configured: boolean
      message: string
      details?: string[]
      code?: string
    }

/**
 * Admin-only: rebuild plan server-side, generate WORDSEARCH_THEME for one slot.
 * Does not persist to generated_pages. No personal profile data sent to the LLM.
 */
export async function generateWordsearchThemeLabAction(input: {
  bookProjectId: string
  seed: string
  slotId: string
}): Promise<GenerateWordsearchThemeLabResult> {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false, configured: isContentGenerationConfigured(), message: "Accès admin requis." }
  }

  if (!isContentGenerationConfigured()) {
    return {
      ok: false,
      configured: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur (Vercel → Settings → Environment Variables), puis redéployez.",
    }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) {
    return { ok: false, configured: true, message: "Projet introuvable." }
  }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false, configured: true, message: "BookProfileV1 manquant sur ce projet." }
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
    return { ok: false, configured: true, message: "Projet non éligible à l'Editorial Lab." }
  }

  const [games, universes] = await Promise.all([getGames(), getUniverses()])
  const plan = buildEditorialPlan({
    profile: parsed.profile,
    seed: input.seed.trim() || "lab-seed-1",
    games,
    richnessLevel: richnessLevel ?? "ENOUGH",
    maxSlots: 8,
  })

  const slot = plan.selectedGames.find((s) => s.slotId === input.slotId)
  if (!slot) {
    return { ok: false, configured: true, message: "Slot introuvable dans le plan reconstruit." }
  }
  if (slot.gameId !== "WORDSEARCH_THEME") {
    return {
      ok: false,
      configured: true,
      message: "Ce slot n'est pas WORDSEARCH_THEME.",
    }
  }

  const universe =
    universes.find((u) => u.id === slot.universeId) ??
    (slot.universeId
      ? {
          id: slot.universeId,
          name: slot.universeId,
          editorial_description: null,
          allowed_topics: [],
          excluded_topics: [],
          quiz_guidance: null,
        }
      : null)

  const themeContext = buildWordSearchThemeContext({ slot, universe })
  const result = await generateWordSearchThemeContent({
    slot,
    universe: universe ?? undefined,
    universeName: themeContext.universeName,
    bookProjectId: project.id,
  })

  if (!result.ok) {
    return {
      ok: false,
      configured: result.code !== "NOT_CONFIGURED",
      code: result.code,
      message: result.message,
      details: result.details,
    }
  }

  return {
    ok: true,
    configured: true,
    slotId: slot.slotId,
    title: result.generated.title,
    universeId: themeContext.universeId,
    universeName: themeContext.universeName,
    difficulty: themeContext.difficulty,
    wordCount: result.generated.words.length,
    topicKeys: result.validation.topicKeys,
    topicDistinctCount: result.validation.topicDistinctCount,
    topicDiversityOk: result.validation.topicDiversityOk,
    durationMs: result.durationMs,
    repaired: result.repaired,
    repairedCount: result.repairedCount,
    warnings: result.validation.warnings,
    words: result.generated.words.map(toWordsearchLabWordView),
    engineWordSearch: result.engineResult,
    seed: slot.seed,
  }
}

function toWordsearchLabWordView(w: GeneratedWordSearchThemeWord): WordsearchThemeLabWordView {
  return {
    display: w.display,
    normalized: w.normalized,
    topicKey: w.topicKey,
  }
}

export type CrosswordThemeLabEntryView = {
  answer: string
  normalized: string
  clue: string
  topicKey: string
  topicLabel: string
}

export type GenerateCrosswordThemeLabResult =
  | {
      ok: true
      configured: true
      slotId: string
      title: string
      universeId: string
      universeName: string
      difficulty: number
      entryCount: number
      topicKeys: string[]
      topicDistinctCount: number
      topicDiversityOk: boolean
      gridBuildable: true
      durationMs: number
      repaired: boolean
      repairedCount: number
      warnings: string[]
      entries: CrosswordThemeLabEntryView[]
      seed: string
    }
  | {
      ok: false
      configured: boolean
      message: string
      details?: string[]
      code?: string
    }

/**
 * Admin-only: rebuild plan server-side, generate CROSSWORD_THEME for one slot.
 * Does not persist to generated_pages. No personal profile data sent to the LLM.
 */
export async function generateCrosswordThemeLabAction(input: {
  bookProjectId: string
  seed: string
  slotId: string
}): Promise<GenerateCrosswordThemeLabResult> {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false, configured: isContentGenerationConfigured(), message: "Accès admin requis." }
  }

  if (!isContentGenerationConfigured()) {
    return {
      ok: false,
      configured: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur (Vercel → Settings → Environment Variables), puis redéployez.",
    }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) {
    return { ok: false, configured: true, message: "Projet introuvable." }
  }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false, configured: true, message: "BookProfileV1 manquant sur ce projet." }
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
    return { ok: false, configured: true, message: "Projet non éligible à l'Editorial Lab." }
  }

  const [games, universes] = await Promise.all([getGames(), getUniverses()])
  const plan = buildEditorialPlan({
    profile: parsed.profile,
    seed: input.seed.trim() || "lab-seed-1",
    games,
    richnessLevel: richnessLevel ?? "ENOUGH",
    maxSlots: 8,
  })

  const slot = plan.selectedGames.find((s) => s.slotId === input.slotId)
  if (!slot) {
    return { ok: false, configured: true, message: "Slot introuvable dans le plan reconstruit." }
  }
  if (slot.gameId !== "CROSSWORD_THEME") {
    return {
      ok: false,
      configured: true,
      message: "Ce slot n'est pas CROSSWORD_THEME.",
    }
  }

  const universe =
    universes.find((u) => u.id === slot.universeId) ??
    (slot.universeId
      ? {
          id: slot.universeId,
          name: slot.universeId,
          editorial_description: null,
          allowed_topics: [],
          excluded_topics: [],
          quiz_guidance: null,
        }
      : null)

  const themeContext = buildCrosswordThemeContext({ slot, universe })
  const result = await generateCrosswordThemeContent({
    slot,
    universe: universe ?? undefined,
    universeName: themeContext.universeName,
    bookProjectId: project.id,
  })

  if (!result.ok) {
    return {
      ok: false,
      configured: result.code !== "NOT_CONFIGURED",
      code: result.code,
      message: result.message,
      details: result.details,
    }
  }

  return {
    ok: true,
    configured: true,
    slotId: slot.slotId,
    title: result.generated.title,
    universeId: themeContext.universeId,
    universeName: themeContext.universeName,
    difficulty: themeContext.difficulty,
    entryCount: result.generated.entries.length,
    topicKeys: result.validation.topicKeys,
    topicDistinctCount: result.validation.topicDistinctCount,
    topicDiversityOk: result.validation.topicDiversityOk,
    gridBuildable: true,
    durationMs: result.durationMs,
    repaired: result.repaired,
    repairedCount: result.repairedCount,
    warnings: result.validation.warnings,
    entries: result.generated.entries.map(toCrosswordLabEntryView),
    seed: slot.seed,
  }
}

function toCrosswordLabEntryView(e: GeneratedCrosswordThemeEntry): CrosswordThemeLabEntryView {
  return {
    answer: e.answer,
    normalized: e.normalized,
    clue: e.clue,
    topicKey: e.topicKey,
    topicLabel: e.topicLabel,
  }
}

export type TrueFalseThemeLabStatementView = {
  id: string
  statement: string
  answer: boolean
  explanation: string
  topicKey: string
  topicLabel: string
  statementStyle: string
}

export type GenerateTrueFalseThemeLabResult =
  | {
      ok: true
      configured: true
      slotId: string
      title: string
      universeId: string
      universeName: string
      difficulty: number
      statementCount: number
      trueCount: number
      falseCount: number
      topics: string[]
      styles: string[]
      styleDistinctCount: number
      styleDiversityOk: boolean
      durationMs: number
      repaired: boolean
      repairedCount: number
      warnings: string[]
      statements: TrueFalseThemeLabStatementView[]
      seed: string
    }
  | {
      ok: false
      configured: boolean
      code?: string
      message: string
      details?: string[]
    }

export async function generateTrueFalseThemeLabAction(input: {
  bookProjectId: string
  seed: string
  slotId: string
}): Promise<GenerateTrueFalseThemeLabResult> {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false, configured: isContentGenerationConfigured(), message: "Accès admin requis." }
  }

  if (!isContentGenerationConfigured()) {
    return {
      ok: false,
      configured: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur (Vercel → Settings → Environment Variables), puis redéployez.",
    }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) {
    return { ok: false, configured: true, message: "Projet introuvable." }
  }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false, configured: true, message: "BookProfileV1 manquant sur ce projet." }
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
    return { ok: false, configured: true, message: "Projet non éligible à l'Editorial Lab." }
  }

  const [games, universes] = await Promise.all([getGames(), getUniverses()])
  const plan = buildEditorialPlan({
    profile: parsed.profile,
    seed: input.seed.trim() || "lab-seed-1",
    games,
    richnessLevel: richnessLevel ?? "ENOUGH",
    maxSlots: 8,
  })

  const slot = plan.selectedGames.find((s) => s.slotId === input.slotId)
  if (!slot) {
    return { ok: false, configured: true, message: "Slot introuvable dans le plan reconstruit." }
  }
  if (slot.gameId !== "TRUE_FALSE_THEME") {
    return {
      ok: false,
      configured: true,
      message: "Ce slot n'est pas TRUE_FALSE_THEME.",
    }
  }

  const universe =
    universes.find((u) => u.id === slot.universeId) ??
    (slot.universeId
      ? {
          id: slot.universeId,
          name: slot.universeId,
          editorial_description: null,
          allowed_topics: [],
          excluded_topics: [],
          quiz_guidance: null,
        }
      : null)

  const themeContext = buildTrueFalseThemeContext({ slot, universe })
  const result = await generateTrueFalseThemeContent({
    slot,
    universe: universe ?? undefined,
    universeName: themeContext.universeName,
    bookProjectId: project.id,
  })

  if (!result.ok) {
    return {
      ok: false,
      configured: result.code !== "NOT_CONFIGURED",
      code: result.code,
      message: result.message,
      details: result.details,
    }
  }

  if (!result.engineResult.success) {
    return {
      ok: false,
      configured: true,
      code: "ENGINE_REJECTED",
      message: result.engineResult.message,
      details: result.engineResult.validation.errors,
    }
  }

  return {
    ok: true,
    configured: true,
    slotId: slot.slotId,
    title: result.generated.title,
    universeId: themeContext.universeId,
    universeName: themeContext.universeName,
    difficulty: themeContext.difficulty,
    statementCount: result.generated.statements.length,
    trueCount: result.validation.trueCount,
    falseCount: result.validation.falseCount,
    topics: result.validation.topics,
    styles: result.validation.styles,
    styleDistinctCount: result.validation.styleDistinctCount,
    styleDiversityOk: result.validation.styleDiversityOk,
    durationMs: result.durationMs,
    repaired: result.repaired,
    repairedCount: result.repairedCount,
    warnings: result.validation.warnings,
    statements: result.generated.statements.map(toTrueFalseLabStatementView),
    seed: slot.seed,
  }
}

export async function generateTrueFalseThemeCatalogTestAction(input: {
  bookProjectId: string
  seed: string
  universeId: string
}): Promise<GenerateTrueFalseThemeLabResult> {
  const { user, profile: authProfile } = await getCurrentUser()
  if (!user || authProfile?.role !== "admin") {
    return { ok: false, configured: isContentGenerationConfigured(), message: "Accès admin requis." }
  }

  if (!isContentGenerationConfigured()) {
    return {
      ok: false,
      configured: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur, puis redéployez.",
    }
  }

  const project = await getBookProject(input.bookProjectId)
  if (!project) {
    return { ok: false, configured: true, message: "Projet introuvable." }
  }

  const parsed = parseQuestionnairePayload(project.questionnaire_data)
  if (!parsed.profile) {
    return { ok: false, configured: true, message: "BookProfileV1 manquant sur ce projet." }
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
    return { ok: false, configured: true, message: "Projet non éligible à l'Editorial Lab." }
  }

  const [games, universes] = await Promise.all([getGames(), getUniverses()])
  const catalogGame = games.find((g) => g.id === "TRUE_FALSE_THEME" && g.active)
  if (!catalogGame) {
    return {
      ok: false,
      configured: true,
      message: "TRUE_FALSE_THEME absent du catalogue (exécutez scripts/013_true_false_theme_seed.sql dans Supabase).",
    }
  }

  const universe =
    universes.find((u) => u.id === input.universeId) ??
    ({
      id: input.universeId,
      name: input.universeId,
      editorial_description: null,
      allowed_topics: [],
      excluded_topics: [],
      quiz_guidance: null,
    } as const)

  const seed = input.seed.trim() || "lab-seed-1"
  const slot = {
    slotId: `catalog_tf_${seed}`,
    gameId: "TRUE_FALSE_THEME" as const,
    gameName: catalogGame.name,
    technicalEngine: "TRUE_FALSE",
    personalizationType: "THEME" as const,
    templateId: "TRUE_FALSE_01",
    universeId: universe.id,
    difficulty: parsed.profile.gamePreferences.difficulty,
    sourceParticipantIds: [] as string[],
    sourceMemoryIds: [] as string[],
    sourceFactIds: [] as string[],
    sourceInterestIds: [universe.id],
    sourceJokeIds: [] as string[],
    contentRequirements: {
      type: "TRUE_FALSE_CONTENT" as const,
      targetStatements: 8,
      requirePersonalSource: false,
      universeId: universe.id,
    },
    reason: "Test catalogue TRUE_FALSE_THEME (hors plan)",
    priority: 0,
    seed: `${seed}:catalog:TRUE_FALSE_THEME`,
  }

  const themeContext = buildTrueFalseThemeContext({ slot, universe })
  const result = await generateTrueFalseThemeContent({
    slot,
    universe,
    universeName: themeContext.universeName,
    bookProjectId: project.id,
  })

  if (!result.ok) {
    return {
      ok: false,
      configured: result.code !== "NOT_CONFIGURED",
      code: result.code,
      message: result.message,
      details: result.details,
    }
  }

  if (!result.engineResult.success) {
    return {
      ok: false,
      configured: true,
      code: "ENGINE_REJECTED",
      message: result.engineResult.message,
      details: result.engineResult.validation.errors,
    }
  }

  return {
    ok: true,
    configured: true,
    slotId: slot.slotId,
    title: result.generated.title,
    universeId: themeContext.universeId,
    universeName: themeContext.universeName,
    difficulty: themeContext.difficulty,
    statementCount: result.generated.statements.length,
    trueCount: result.validation.trueCount,
    falseCount: result.validation.falseCount,
    topics: result.validation.topics,
    styles: result.validation.styles,
    styleDistinctCount: result.validation.styleDistinctCount,
    styleDiversityOk: result.validation.styleDiversityOk,
    durationMs: result.durationMs,
    repaired: result.repaired,
    repairedCount: result.repairedCount,
    warnings: result.validation.warnings,
    statements: result.generated.statements.map(toTrueFalseLabStatementView),
    seed: slot.seed,
  }
}

function toTrueFalseLabStatementView(
  s: GeneratedTrueFalseThemeStatement,
): TrueFalseThemeLabStatementView {
  return {
    id: s.id,
    statement: s.statement,
    answer: s.answer,
    explanation: s.explanation,
    topicKey: s.topicKey,
    topicLabel: s.topicLabel,
    statementStyle: s.statementStyle,
  }
}
