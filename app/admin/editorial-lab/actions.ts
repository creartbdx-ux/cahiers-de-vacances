"use server"

import { getCurrentUser } from "@/lib/auth"
import { canUseInEditorialLab, parseQuestionnairePayload } from "@/lib/books/lifecycle"
import { getBookProject } from "@/lib/data/books"
import { getGames } from "@/lib/data/reference"
import { buildEditorialPlan } from "@/lib/editorial-engine"
import {
  buildQuizPersonalSourceContext,
  generateQuizPersonalContent,
  isContentGenerationConfigured,
  lookupSourceText,
  summarizeSourceContext,
  type GeneratedQuizPersonalQuestion,
} from "@/lib/content-generation"
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
