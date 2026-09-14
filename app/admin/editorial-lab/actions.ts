"use server"

import { getCurrentUser } from "@/lib/auth"
import { canUseInEditorialLab, parseQuestionnairePayload } from "@/lib/books/lifecycle"
import { getBookProject } from "@/lib/data/books"
import { getGames } from "@/lib/data/reference"
import { buildEditorialPlan } from "@/lib/editorial-engine"
import {
  buildQuizPersonalSourceContext,
  buildQuizThemeContext,
  generateQuizPersonalContent,
  generateQuizThemeContent,
  isContentGenerationConfigured,
  lookupSourceText,
  summarizeSourceContext,
  type GeneratedQuizPersonalQuestion,
  type GeneratedQuizThemeQuestion,
} from "@/lib/content-generation"
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
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  topic: string
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
    choices: q.choices,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    topic: q.topic,
  }
}
