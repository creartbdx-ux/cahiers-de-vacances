"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { BookPage } from "@/components/book-renderer/book-page"
import { PagePreview } from "@/components/book-renderer/page-preview"
import { CrosswordTemplate } from "@/components/book-renderer/templates/crossword-template"
import { QuizTemplate } from "@/components/book-renderer/templates/quiz-template"
import { TrueFalseTemplate } from "@/components/book-renderer/templates/true-false-template"
import { WordsearchTemplate } from "@/components/book-renderer/templates/wordsearch-template"
import {
  CROSSWORD_01_INSTRUCTION,
  CROSSWORD_01_SAMPLE,
  QUIZ_01_SAMPLE,
  TRUE_FALSE_01_SAMPLE,
  WORDSEARCH_01_SAMPLE,
} from "@/lib/book-renderer/templates"
import { getStyleTokens } from "@/lib/book-renderer/styles"
import { cn } from "@/lib/utils"
import {
  buildEditorialPlan,
  type EditorialGameSlot,
  type EditorialPlanV1,
} from "@/lib/editorial-engine"
import { buildQuizPersonalSourceContext } from "@/lib/content-generation/source-context"
import { buildCrosswordThemePreview } from "@/lib/content-generation/crossword-theme/preview"
import { buildQuizThemePreview } from "@/lib/content-generation/quiz-theme/preview"
import { buildTrueFalseThemePreview } from "@/lib/content-generation/true-false-theme/preview"
import { buildWordSearchThemePreview } from "@/lib/content-generation/wordsearch-theme/preview"
import {
  generateCrosswordThemeLabAction,
  generateQuizPersonalLabAction,
  generateQuizThemeLabAction,
  generateTrueFalseThemeCatalogTestAction,
  generateTrueFalseThemeLabAction,
  generateWordsearchThemeLabAction,
  type GenerateCrosswordThemeLabResult,
  type GenerateQuizPersonalLabResult,
  type GenerateQuizThemeLabResult,
  type GenerateTrueFalseThemeLabResult,
  type GenerateWordsearchThemeLabResult,
} from "@/app/admin/editorial-lab/actions"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import type { Game, Palette, Style, Universe } from "@/lib/supabase/types"
import type { QuizQuestion } from "@/lib/game-engines/quiz/types"
import { QUIZ_CHOICE_LABELS } from "@/lib/game-engines/quiz/types"

type SlotGenResult =
  | GenerateQuizPersonalLabResult
  | GenerateQuizThemeLabResult
  | GenerateWordsearchThemeLabResult
  | GenerateCrosswordThemeLabResult
  | GenerateTrueFalseThemeLabResult

function isQuizPersonalLabOk(
  gen: SlotGenResult | undefined,
): gen is Extract<GenerateQuizPersonalLabResult, { ok: true }> {
  return Boolean(gen?.ok && "sourceSummary" in gen)
}

function isQuizThemeLabOk(
  gen: SlotGenResult | undefined,
): gen is Extract<GenerateQuizThemeLabResult, { ok: true }> {
  return Boolean(gen?.ok && "questions" in gen && "styleDistinctCount" in gen)
}

function isWordsearchThemeLabOk(
  gen: SlotGenResult | undefined,
): gen is Extract<GenerateWordsearchThemeLabResult, { ok: true }> {
  return Boolean(gen?.ok && "wordCount" in gen && "words" in gen)
}

function isCrosswordThemeLabOk(
  gen: SlotGenResult | undefined,
): gen is Extract<GenerateCrosswordThemeLabResult, { ok: true }> {
  return Boolean(gen?.ok && "entryCount" in gen && "entries" in gen && "gridBuildable" in gen)
}

function isTrueFalseThemeLabOk(
  gen: SlotGenResult | undefined,
): gen is Extract<GenerateTrueFalseThemeLabResult, { ok: true }> {
  return Boolean(gen?.ok && "statements" in gen && "trueCount" in gen)
}

export type EditorialLabProject = {
  id: string
  label: string
  status: string
  richnessLevel: RichnessLevel
  profile: BookProfileV1
}

export function EditorialLabClient({
  projects,
  games,
  universes,
  palettes,
  styles,
  aiConfigured,
}: {
  projects: EditorialLabProject[]
  games: Game[]
  universes: Universe[]
  palettes: Palette[]
  styles: Style[]
  aiConfigured: boolean
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "")
  const [seed, setSeed] = useState("lab-seed-1")
  const [plan, setPlan] = useState<EditorialPlanV1 | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [genBySlot, setGenBySlot] = useState<Record<string, SlotGenResult | undefined>>({})
  const [previewSlotId, setPreviewSlotId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<"game" | "solution">("game")
  const [catalogUniverseId, setCatalogUniverseId] = useState("")
  const [pending, startTransition] = useTransition()
  const hasTrueFalseTheme = games.some((g) => g.id === "TRUE_FALSE_THEME")

  const selected = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  const palette = palettes[0] ?? FALLBACK_PALETTE
  const styleId = styles[0]?.id ?? "RETRO"
  const styleTokens = useMemo(() => getStyleTokens(styleId), [styleId])

  const universeName = (id: string | null) => {
    if (!id) return null
    return universes.find((u) => u.id === id)?.name ?? id
  }

  function build() {
    setError(null)
    setGenBySlot({})
    setPreviewSlotId(null)
    if (!selected) {
      setError("Sélectionnez un projet avec BookProfileV1.")
      return
    }
    const next = buildEditorialPlan({
      profile: selected.profile,
      seed: seed.trim() || "lab-seed-1",
      games,
      richnessLevel: selected.richnessLevel,
      maxSlots: 8,
    })
    setPlan(next)
  }

  function generatePersonalSlot(slot: EditorialGameSlot) {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await generateQuizPersonalLabAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
        slotId: slot.slotId,
      })
      setGenBySlot((prev) => ({ ...prev, [slot.slotId]: result }))
      if (result.ok) setPreviewSlotId(null)
    })
  }

  function generateThemeSlot(slot: EditorialGameSlot) {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await generateQuizThemeLabAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
        slotId: slot.slotId,
      })
      setGenBySlot((prev) => ({ ...prev, [slot.slotId]: result }))
      if (result.ok) setPreviewSlotId(null)
    })
  }

  function generateWordsearchSlot(slot: EditorialGameSlot) {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await generateWordsearchThemeLabAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
        slotId: slot.slotId,
      })
      setGenBySlot((prev) => ({ ...prev, [slot.slotId]: result }))
      if (result.ok) setPreviewSlotId(null)
    })
  }

  function generateCrosswordSlot(slot: EditorialGameSlot) {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await generateCrosswordThemeLabAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
        slotId: slot.slotId,
      })
      setGenBySlot((prev) => ({ ...prev, [slot.slotId]: result }))
      if (result.ok) setPreviewSlotId(null)
    })
  }

  function generateTrueFalseSlot(slot: EditorialGameSlot) {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await generateTrueFalseThemeLabAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
        slotId: slot.slotId,
      })
      setGenBySlot((prev) => ({ ...prev, [slot.slotId]: result }))
      if (result.ok) setPreviewSlotId(null)
    })
  }

  const catalogUniverseOptions = useMemo(() => {
    const interestIds = selected?.profile.sharedProfile.interestUniverseIds ?? []
    if (interestIds.length > 0) {
      return interestIds.map((id) => {
        const found = universes.find((u) => u.id === id)
        return { id, name: found?.name ?? id }
      })
    }
    return universes.map((u) => ({ id: u.id, name: u.name }))
  }, [selected, universes])

  const catalogTfSlotId = useMemo(() => {
    const s = seed.trim() || "lab-seed-1"
    return `catalog_tf_${s}`
  }, [seed])

  const catalogTfGen = genBySlot[catalogTfSlotId]
  const catalogTfOk = isTrueFalseThemeLabOk(catalogTfGen) ? catalogTfGen : null
  const catalogTfErr = catalogTfGen && !catalogTfGen.ok ? catalogTfGen : null

  function generateTrueFalseCatalogTest() {
    if (!selected) return
    const universeId = catalogUniverseId || catalogUniverseOptions[0]?.id
    if (!universeId) return
    if (!catalogUniverseId) setCatalogUniverseId(universeId)
    setError(null)
    startTransition(async () => {
      const result = await generateTrueFalseThemeCatalogTestAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
        universeId,
      })
      const slotKey = result.ok
        ? result.slotId
        : `catalog_tf_${seed.trim() || "lab-seed-1"}`
      setGenBySlot((prev) => ({ ...prev, [slotKey]: result }))
      if (result.ok) setPreviewSlotId(null)
    })
  }

  const previewSlot = plan?.selectedGames.find((s) => s.slotId === previewSlotId) ?? null
  const previewGen = previewSlotId ? genBySlot[previewSlotId] : null

  const quizThemePreview = useMemo(() => {
    if (!previewSlotId) return null
    const gen = genBySlot[previewSlotId]
    if (!isQuizThemeLabOk(gen)) return null
    return buildQuizThemePreview(gen.questions, gen.seed)
  }, [previewSlotId, genBySlot])

  const quizPersonalPreviewQuestions: QuizQuestion[] | null = useMemo(() => {
    if (!previewSlotId) return null
    const gen = genBySlot[previewSlotId]
    if (!isQuizPersonalLabOk(gen)) return null
    return gen.engineQuestions
  }, [previewSlotId, genBySlot])

  const wordsearchPreview = useMemo(() => {
    if (!previewSlotId) return null
    const gen = genBySlot[previewSlotId]
    if (!isWordsearchThemeLabOk(gen)) return null
    return buildWordSearchThemePreview(gen.words, gen.seed)
  }, [previewSlotId, genBySlot])

  const crosswordPreview = useMemo(() => {
    if (!previewSlotId) return null
    const gen = genBySlot[previewSlotId]
    if (!isCrosswordThemeLabOk(gen)) return null
    return buildCrosswordThemePreview(gen.entries, gen.seed)
  }, [previewSlotId, genBySlot])

  const trueFalsePreview = useMemo(() => {
    if (!previewSlotId) return null
    const gen = genBySlot[previewSlotId]
    if (!isTrueFalseThemeLabOk(gen)) return null
    return buildTrueFalseThemePreview(gen.statements, gen.seed)
  }, [previewSlotId, genBySlot])

  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          "rounded-2xl border p-4 text-sm",
          aiConfigured
            ? "border-border bg-muted/40 text-muted-foreground"
            : "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        {aiConfigured
          ? "Génération IA configurée (CONTENT_GENERATION_API_KEY). Disponible pour QUIZ_PERSONAL, QUIZ_THEME, WORDSEARCH_THEME, CROSSWORD_THEME et TRUE_FALSE_THEME."
          : "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur (Vercel), puis redéployez."}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Projet (questionnaire complété)
            <select
              className="h-10 rounded-lg border border-input bg-background px-3"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                setPlan(null)
                setGenBySlot({})
                setPreviewSlotId(null)
                setCatalogUniverseId("")
              }}
            >
              {projects.length === 0 && <option value="">Aucun projet disponible</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Seed
            <input
              className="h-10 rounded-lg border border-input bg-background px-3"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="lab-seed-1"
            />
          </label>
        </div>
        {selected && (
          <p className="mt-3 text-sm text-muted-foreground">
            Audience {selected.profile.audience} · richesse {selected.richnessLevel} ·{" "}
            {selected.profile.participants.length} participant
            {selected.profile.participants.length > 1 ? "s" : ""} · difficulté{" "}
            {selected.profile.gamePreferences.difficulty}
          </p>
        )}
        <div className="mt-4">
          <Button type="button" onClick={build} disabled={!selected}>
            Construire le plan
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {plan && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="PERSONAL / THEME"
              value={`${Math.round(plan.stats.personalRatio * 100)}% / ${Math.round((1 - plan.stats.personalRatio) * 100)}%`}
            />
            <Stat
              label="Cible PERSONAL"
              value={`${Math.round(plan.stats.targetPersonalRatio * 100)}%`}
            />
            <Stat label="Slots" value={String(plan.stats.slotCount)} />
            <Stat
              label="Univers"
              value={
                plan.stats.universesUsed.map((id) => universeName(id) ?? id).join(", ") || "—"
              }
            />
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Plan éditorial</h2>
            <div className="flex flex-col gap-3">
              {plan.selectedGames.map((slot, i) => {
                const isQuizPersonal = slot.gameId === "QUIZ_PERSONAL"
                const isQuizTheme = slot.gameId === "QUIZ_THEME"
                const isWordsearchTheme = slot.gameId === "WORDSEARCH_THEME"
                const isCrosswordTheme = slot.gameId === "CROSSWORD_THEME"
                const isTrueFalseTheme = slot.gameId === "TRUE_FALSE_THEME"
                const gen = genBySlot[slot.slotId]
                const personalOk =
                  isQuizPersonal && gen?.ok && "sourceSummary" in gen ? gen : null
                const personalErr =
                  isQuizPersonal && gen && !gen.ok ? gen : null
                const themeOk = isQuizTheme && isQuizThemeLabOk(gen) ? gen : null
                const themeErr = isQuizTheme && gen && !gen.ok ? gen : null
                const wordsearchOk =
                  isWordsearchTheme && isWordsearchThemeLabOk(gen) ? gen : null
                const wordsearchErr = isWordsearchTheme && gen && !gen.ok ? gen : null
                const crosswordOk =
                  isCrosswordTheme && isCrosswordThemeLabOk(gen) ? gen : null
                const crosswordErr = isCrosswordTheme && gen && !gen.ok ? gen : null
                const trueFalseOk =
                  isTrueFalseTheme && isTrueFalseThemeLabOk(gen) ? gen : null
                const trueFalseErr = isTrueFalseTheme && gen && !gen.ok ? gen : null
                const sourcePreview =
                  selected && isQuizPersonal
                    ? buildQuizPersonalSourceContext({
                        profile: selected.profile,
                        slot,
                      })
                    : null
                const themeTargetQuestions =
                  slot.contentRequirements.type === "QUIZ_CONTENT"
                    ? slot.contentRequirements.targetQuestions
                    : 6
                const wordsearchTargetWords =
                  slot.contentRequirements.type === "WORDSEARCH_CONTENT"
                    ? slot.contentRequirements.targetWords
                    : 12
                const crosswordTargetEntries =
                  slot.contentRequirements.type === "CROSSWORD_CONTENT"
                    ? slot.contentRequirements.targetEntries
                    : 10
                const trueFalseTargetStatements =
                  slot.contentRequirements.type === "TRUE_FALSE_CONTENT"
                    ? slot.contentRequirements.targetStatements
                    : 8

                return (
                  <article
                    key={slot.slotId}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">Slot {i + 1}</span>
                      <Badge>{slot.gameName}</Badge>
                      <Badge tone={slot.personalizationType === "PERSONAL" ? "personal" : "theme"}>
                        {slot.personalizationType}
                      </Badge>
                      {slot.universeId && (
                        <Badge tone="theme">Univers : {universeName(slot.universeId)}</Badge>
                      )}
                    </div>
                    <dl className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                      <div>
                        Difficulté : <span className="text-foreground">{slot.difficulty}</span>
                      </div>
                      <div>
                        Moteur : <span className="text-foreground">{slot.technicalEngine}</span>
                      </div>
                      <div>
                        Template : <span className="text-foreground">{slot.templateId}</span>
                      </div>
                      <div>
                        Brief :{" "}
                        <span className="text-foreground">{slot.contentRequirements.type}</span>
                      </div>
                    </dl>
                    {slot.personalizationType === "PERSONAL" && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Sources : {slot.sourceFactIds.length} fait
                        {slot.sourceFactIds.length > 1 ? "s" : ""}
                        {slot.sourceMemoryIds.length
                          ? `, ${slot.sourceMemoryIds.length} souvenir${slot.sourceMemoryIds.length > 1 ? "s" : ""}`
                          : ""}
                        {slot.sourceParticipantIds.length
                          ? `, ${slot.sourceParticipantIds.length} participant${slot.sourceParticipantIds.length > 1 ? "s" : ""}`
                          : ""}
                      </p>
                    )}
                    <p className="mt-2 text-sm">
                      <span className="text-muted-foreground">Raison : </span>
                      {slot.reason}
                    </p>

                    {isQuizPersonal && sourcePreview && (
                      <div className="mt-4 rounded-lg border border-border bg-card/60 p-3">
                        <h3 className="text-sm font-semibold">QUIZ PERSONNALISÉ</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Audience / lecteur : {sourcePreview.audience} →{" "}
                          {sourcePreview.targetParticipantNames.join(", ") || "—"}
                          {sourcePreview.creatorIsParticipant
                            ? " · créateur participant"
                            : " · créateur non participant"}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">Sources autorisées :</p>
                        <ul className="mt-1 list-disc pl-5 text-sm">
                          <li>
                            {sourcePreview.facts.length} fait
                            {sourcePreview.facts.length > 1 ? "s" : ""}
                          </li>
                          <li>
                            {sourcePreview.memories.length} souvenir
                            {sourcePreview.memories.length > 1 ? "s" : ""}
                          </li>
                          {sourcePreview.jokes.length > 0 && (
                            <li>
                              {sourcePreview.jokes.length} private joke
                              {sourcePreview.jokes.length > 1 ? "s" : ""}
                            </li>
                          )}
                          <li>{sourcePreview.participantNames.join(", ") || "—"}</li>
                        </ul>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending || !aiConfigured}
                            onClick={() => generatePersonalSlot(slot)}
                          >
                            {pending ? "Génération…" : "Générer le contenu"}
                          </Button>
                          {personalOk && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreviewSlotId(slot.slotId)
                                setPreviewMode("game")
                              }}
                            >
                              Voir le rendu
                            </Button>
                          )}
                        </div>

                        {personalErr && (
                          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <p className="font-medium">{personalErr.message}</p>
                            {personalErr.details?.length ? (
                              <ul className="mt-2 list-disc pl-5">
                                {personalErr.details.map((d) => (
                                  <li key={d}>{d}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}

                        {personalOk && (
                          <div className="mt-4 flex flex-col gap-4">
                            <p className="text-sm text-muted-foreground">
                              Validation OK · {personalOk.questionCount} question
                              {personalOk.questionCount > 1 ? "s" : ""} · {personalOk.durationMs} ms
                              {personalOk.repaired ? " · réparation auto utilisée" : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sources utilisées : {personalOk.usedSourceIds.factIds.length} faits,{" "}
                              {personalOk.usedSourceIds.memoryIds.length} souvenirs,{" "}
                              {personalOk.usedSourceIds.jokeIds.length} jokes · Non utilisées :{" "}
                              {personalOk.unusedSourceIds.factIds.length} faits,{" "}
                              {personalOk.unusedSourceIds.memoryIds.length} souvenirs,{" "}
                              {personalOk.unusedSourceIds.jokeIds.length} jokes
                            </p>
                            {personalOk.warnings.length > 0 && (
                              <ul className="text-sm text-muted-foreground">
                                {personalOk.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            )}
                            {personalOk.questions.map((q, qi) => (
                              <div key={q.id} className="rounded-lg border border-border p-3">
                                <p className="text-sm font-medium">Question {qi + 1}</p>
                                <p className="mt-1 text-sm">&ldquo;{q.question}&rdquo;</p>
                                <ul className="mt-2 space-y-1 text-sm">
                                  {q.choices.map((c, ci) => (
                                    <li key={ci}>
                                      {QUIZ_CHOICE_LABELS[ci]}. {c}
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-2 text-sm">
                                  Bonne réponse : {QUIZ_CHOICE_LABELS[q.correctIndex]}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Source : {q.sourceLabels.join(" · ")}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isWordsearchTheme && (
                      <div className="mt-4 rounded-lg border border-border bg-card/60 p-3">
                        <h3 className="text-sm font-semibold">MOTS MÊLÉS THÉMATIQUES</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Univers :{" "}
                          <span className="text-foreground">
                            {universeName(slot.universeId) ?? slot.universeId ?? "—"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Difficulté :{" "}
                          <span className="text-foreground">{slot.difficulty}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Mots prévus :{" "}
                          <span className="text-foreground">{wordsearchTargetWords}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending || !aiConfigured}
                            onClick={() => generateWordsearchSlot(slot)}
                          >
                            {pending ? "Génération…" : "Générer le contenu"}
                          </Button>
                          {wordsearchOk &&
                            (previewSlotId === slot.slotId ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewSlotId(null)}
                              >
                                Masquer le rendu
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPreviewSlotId(slot.slotId)
                                  setPreviewMode("game")
                                }}
                              >
                                Voir le rendu
                              </Button>
                            ))}
                        </div>

                        {wordsearchErr && (
                          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <p className="font-medium">{wordsearchErr.message}</p>
                            {wordsearchErr.details?.length ? (
                              <ul className="mt-2 list-disc pl-5">
                                {wordsearchErr.details.map((d) => (
                                  <li key={d}>{d}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}

                        {wordsearchOk && (
                          <div className="mt-4 flex flex-col gap-4">
                            <p className="text-sm font-medium">Titre : {wordsearchOk.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Validation OK · {wordsearchOk.wordCount} mot
                              {wordsearchOk.wordCount > 1 ? "s" : ""} · topicKeys :{" "}
                              {wordsearchOk.topicKeys.join(", ") || "—"} · {wordsearchOk.durationMs}{" "}
                              ms
                              {wordsearchOk.repaired
                                ? ` · Réparation : ${wordsearchOk.repairedCount} mot${wordsearchOk.repairedCount > 1 ? "s" : ""} remplacé${wordsearchOk.repairedCount > 1 ? "s" : ""}`
                                : ""}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Diversité : {wordsearchOk.topicDistinctCount} topicKey
                              {wordsearchOk.topicDistinctCount > 1 ? "s" : ""} distinct
                              {wordsearchOk.topicDistinctCount > 1 ? "s" : ""}
                              {" · "}
                              Validation diversité :{" "}
                              {wordsearchOk.topicDiversityOk ? "OK" : "KO"}
                            </p>
                            {wordsearchOk.warnings.length > 0 && (
                              <ul className="text-sm text-muted-foreground">
                                {wordsearchOk.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            )}
                            <p className="text-sm font-medium">Mots :</p>
                            <ul className="space-y-2 text-sm">
                              {wordsearchOk.words.map((w, wi) => (
                                <li key={wi} className="rounded-lg border border-border p-3">
                                  <span className="font-medium">{w.display}</span>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    topicKey : {w.topicKey} · normalisation : {w.normalized}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {previewSlotId === slot.slotId && wordsearchOk && (
                          <div className="mt-4 rounded-lg border border-border bg-background p-4">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold">APERÇU</h4>
                              <ModeToggle mode={previewMode} setMode={setPreviewMode} />
                            </div>
                            {wordsearchPreview && !wordsearchPreview.ok ? (
                              <p className="text-sm text-destructive">{wordsearchPreview.message}</p>
                            ) : wordsearchPreview?.ok ? (
                              <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8">
                                <PagePreview>
                                  <BookPage palette={palette} showSafeArea={false}>
                                    <WordsearchTemplate
                                      sample={{
                                        ...WORDSEARCH_01_SAMPLE,
                                        title: wordsearchOk.title,
                                      }}
                                      style={styleTokens}
                                      palette={palette}
                                      assets={[]}
                                      wordsearch={wordsearchPreview.wordsearch}
                                      mode={previewMode}
                                    />
                                  </BookPage>
                                </PagePreview>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}

                    {isCrosswordTheme && (
                      <div className="mt-4 rounded-lg border border-border bg-card/60 p-3">
                        <h3 className="text-sm font-semibold">MOTS CROISÉS THÉMATIQUES</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Univers :{" "}
                          <span className="text-foreground">
                            {universeName(slot.universeId) ?? slot.universeId ?? "—"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Difficulté :{" "}
                          <span className="text-foreground">{slot.difficulty}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Entrées prévues :{" "}
                          <span className="text-foreground">{crosswordTargetEntries}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending || !aiConfigured}
                            onClick={() => generateCrosswordSlot(slot)}
                          >
                            {pending ? "Génération…" : "Générer le contenu"}
                          </Button>
                          {crosswordOk &&
                            (previewSlotId === slot.slotId ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewSlotId(null)}
                              >
                                Masquer le rendu
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPreviewSlotId(slot.slotId)
                                  setPreviewMode("game")
                                }}
                              >
                                Voir le rendu
                              </Button>
                            ))}
                        </div>

                        {crosswordErr && (
                          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <p className="font-medium">{crosswordErr.message}</p>
                            {crosswordErr.details?.length ? (
                              <ul className="mt-2 list-disc pl-5">
                                {crosswordErr.details.map((d) => (
                                  <li key={d}>{d}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}

                        {crosswordOk && (
                          <div className="mt-4 flex flex-col gap-4">
                            <p className="text-sm font-medium">Titre : {crosswordOk.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Validation OK · {crosswordOk.entryCount} entrée
                              {crosswordOk.entryCount > 1 ? "s" : ""} · topicKeys :{" "}
                              {crosswordOk.topicKeys.join(", ") || "—"} · grille constructible : Oui
                              · {crosswordOk.durationMs} ms
                              {crosswordOk.repaired
                                ? ` · Réparation : ${crosswordOk.repairedCount} entrée${crosswordOk.repairedCount > 1 ? "s" : ""} remplacée${crosswordOk.repairedCount > 1 ? "s" : ""}`
                                : ""}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Diversité : {crosswordOk.topicDistinctCount} topicKey
                              {crosswordOk.topicDistinctCount > 1 ? "s" : ""} distinct
                              {crosswordOk.topicDistinctCount > 1 ? "s" : ""}
                              {" · "}
                              Validation diversité :{" "}
                              {crosswordOk.topicDiversityOk ? "OK" : "KO"}
                            </p>
                            {crosswordOk.warnings.length > 0 && (
                              <ul className="text-sm text-muted-foreground">
                                {crosswordOk.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            )}
                            <ul className="space-y-2 text-sm">
                              {crosswordOk.entries.map((e, ei) => (
                                <li key={ei} className="rounded-lg border border-border p-3">
                                  <p className="font-medium">
                                    {ei + 1}. {e.answer}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Définition : {e.clue}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Sujet : {e.topicKey}
                                    {e.topicLabel ? ` · ${e.topicLabel}` : ""} · normalisation :{" "}
                                    {e.normalized}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {previewSlotId === slot.slotId && crosswordOk && (
                          <div className="mt-4 rounded-lg border border-border bg-background p-4">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold">APERÇU</h4>
                              <ModeToggle mode={previewMode} setMode={setPreviewMode} />
                            </div>
                            {crosswordPreview && !crosswordPreview.ok ? (
                              <p className="text-sm text-destructive">{crosswordPreview.message}</p>
                            ) : crosswordPreview?.ok ? (
                              <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8">
                                <PagePreview>
                                  <BookPage palette={palette} showSafeArea={false}>
                                    <CrosswordTemplate
                                      sample={{
                                        ...CROSSWORD_01_SAMPLE,
                                        title: crosswordOk.title,
                                        instruction: CROSSWORD_01_INSTRUCTION,
                                      }}
                                      style={styleTokens}
                                      palette={palette}
                                      assets={[]}
                                      crossword={crosswordPreview.crossword}
                                      mode={previewMode}
                                    />
                                  </BookPage>
                                </PagePreview>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}

                    {isQuizTheme && (
                      <div className="mt-4 rounded-lg border border-border bg-card/60 p-3">
                        <h3 className="text-sm font-semibold">QUIZ THÉMATIQUE</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Univers :{" "}
                          <span className="text-foreground">
                            {universeName(slot.universeId) ?? slot.universeId ?? "—"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Difficulté :{" "}
                          <span className="text-foreground">{slot.difficulty}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Questions prévues :{" "}
                          <span className="text-foreground">{themeTargetQuestions}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending || !aiConfigured}
                            onClick={() => generateThemeSlot(slot)}
                          >
                            {pending ? "Génération…" : "Générer le contenu"}
                          </Button>
                          {themeOk &&
                            (previewSlotId === slot.slotId ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewSlotId(null)}
                              >
                                Masquer le rendu
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPreviewSlotId(slot.slotId)
                                  setPreviewMode("game")
                                }}
                              >
                                Voir le rendu
                              </Button>
                            ))}
                        </div>

                        {themeErr && (
                          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <p className="font-medium">{themeErr.message}</p>
                            {themeErr.details?.length ? (
                              <ul className="mt-2 list-disc pl-5">
                                {themeErr.details.map((d) => (
                                  <li key={d}>{d}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}

                        {themeOk && (
                          <div className="mt-4 flex flex-col gap-4">
                            <p className="text-sm font-medium">{themeOk.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Validation OK · {themeOk.questionCount} question
                              {themeOk.questionCount > 1 ? "s" : ""} · topicKeys :{" "}
                              {themeOk.topics.join(", ") || "—"} · {themeOk.durationMs} ms
                              {themeOk.repaired
                                ? ` · Réparation : ${themeOk.repairedCount} question${themeOk.repairedCount > 1 ? "s" : ""} remplacée${themeOk.repairedCount > 1 ? "s" : ""}`
                                : ""}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Diversité : {themeOk.styleDistinctCount} style
                              {themeOk.styleDistinctCount > 1 ? "s" : ""} utilisé
                              {themeOk.styleDistinctCount > 1 ? "s" : ""} sur{" "}
                              {themeOk.questionCount} question
                              {themeOk.questionCount > 1 ? "s" : ""}
                              {" · "}
                              Validation diversité :{" "}
                              {themeOk.styleDiversityOk ? "OK" : "KO"}
                            </p>
                            {themeOk.warnings.length > 0 && (
                              <ul className="text-sm text-muted-foreground">
                                {themeOk.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            )}
                            {themeOk.questions.map((q, qi) => (
                              <div key={q.id} className="rounded-lg border border-border p-3">
                                <p className="text-sm font-medium">Question {qi + 1}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Sujet : {q.topicKey}
                                  {q.topicLabel ? ` · Sous-thème : ${q.topicLabel}` : ""}
                                  {" · "}
                                  Style : {q.questionStyle}
                                </p>
                                <p className="mt-1 text-sm">&ldquo;{q.question}&rdquo;</p>
                                <ul className="mt-2 space-y-1 text-sm">
                                  {q.choices.map((c, ci) => (
                                    <li key={ci}>
                                      {QUIZ_CHOICE_LABELS[ci]}. {c}
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-2 text-sm">
                                  Bonne réponse : {QUIZ_CHOICE_LABELS[q.correctIndex]} —{" "}
                                  {q.choices[q.correctIndex]}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Explication : {q.explanation}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {previewSlotId === slot.slotId && themeOk && (
                          <div className="mt-4 rounded-lg border border-border bg-background p-4">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold">APERÇU</h4>
                              <ModeToggle mode={previewMode} setMode={setPreviewMode} />
                            </div>
                            {quizThemePreview && !quizThemePreview.ok ? (
                              <p className="text-sm text-destructive">{quizThemePreview.message}</p>
                            ) : quizThemePreview?.ok ? (
                              <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8">
                                <PagePreview>
                                  <BookPage palette={palette} showSafeArea={false}>
                                    <QuizTemplate
                                      sample={{
                                        ...QUIZ_01_SAMPLE,
                                        title: themeOk.title,
                                      }}
                                      style={styleTokens}
                                      palette={palette}
                                      assets={[]}
                                      quiz={quizThemePreview.quiz}
                                      mode={previewMode}
                                    />
                                  </BookPage>
                                </PagePreview>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}

                    {isTrueFalseTheme && (
                      <div className="mt-4 rounded-lg border border-border bg-card/60 p-3">
                        <h3 className="text-sm font-semibold">VRAI / FAUX THÉMATIQUE</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Univers :{" "}
                          <span className="text-foreground">
                            {universeName(slot.universeId) ?? slot.universeId ?? "—"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Difficulté :{" "}
                          <span className="text-foreground">{slot.difficulty}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Affirmations :{" "}
                          <span className="text-foreground">{trueFalseTargetStatements}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending || !aiConfigured}
                            onClick={() => generateTrueFalseSlot(slot)}
                          >
                            {pending ? "Génération…" : "Générer le contenu"}
                          </Button>
                          {trueFalseOk &&
                            (previewSlotId === slot.slotId ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewSlotId(null)}
                              >
                                Masquer le rendu
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPreviewSlotId(slot.slotId)
                                  setPreviewMode("game")
                                }}
                              >
                                Voir le rendu
                              </Button>
                            ))}
                        </div>

                        {trueFalseErr && (
                          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <p className="font-medium">{trueFalseErr.message}</p>
                            {trueFalseErr.details?.length ? (
                              <ul className="mt-2 list-disc pl-5">
                                {trueFalseErr.details.map((d) => (
                                  <li key={d}>{d}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}

                        {trueFalseOk && (
                          <div className="mt-4 flex flex-col gap-4">
                            <p className="text-sm font-medium">{trueFalseOk.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Validation OK · {trueFalseOk.statementCount} affirmation
                              {trueFalseOk.statementCount > 1 ? "s" : ""} ·{" "}
                              {trueFalseOk.durationMs} ms
                              {trueFalseOk.repaired
                                ? ` · Réparation : ${trueFalseOk.repairedCount} affirmation${trueFalseOk.repairedCount > 1 ? "s" : ""} remplacée${trueFalseOk.repairedCount > 1 ? "s" : ""}`
                                : ""}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Debug : trueCount={trueFalseOk.trueCount} / falseCount=
                              {trueFalseOk.falseCount} · styleDistinctCount=
                              {trueFalseOk.styleDistinctCount}
                              {" · "}
                              Validation diversité :{" "}
                              {trueFalseOk.styleDiversityOk ? "OK" : "KO"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Topics : {trueFalseOk.topics.join(", ") || "—"}
                            </p>
                            {trueFalseOk.warnings.length > 0 && (
                              <ul className="text-sm text-muted-foreground">
                                {trueFalseOk.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            )}
                            {trueFalseOk.statements.map((s, si) => (
                              <div key={s.id} className="rounded-lg border border-border p-3">
                                <p className="text-sm font-medium">Affirmation {si + 1}</p>
                                <p className="mt-1 text-sm">&ldquo;{s.statement}&rdquo;</p>
                                <p className="mt-2 text-sm">
                                  Réponse : {s.answer ? "VRAI" : "FAUX"}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Explication : {s.explanation}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Sujet : {s.topicKey}
                                  {s.topicLabel ? ` · ${s.topicLabel}` : ""}
                                  {" · "}
                                  Style : {s.statementStyle}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {previewSlotId === slot.slotId && trueFalseOk && (
                          <div className="mt-4 rounded-lg border border-border bg-background p-4">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold">APERÇU</h4>
                              <ModeToggle mode={previewMode} setMode={setPreviewMode} />
                            </div>
                            {trueFalsePreview && !trueFalsePreview.ok ? (
                              <p className="text-sm text-destructive">{trueFalsePreview.message}</p>
                            ) : trueFalsePreview?.ok ? (
                              <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8">
                                <PagePreview>
                                  <BookPage palette={palette} showSafeArea={false}>
                                    <TrueFalseTemplate
                                      sample={{
                                        ...TRUE_FALSE_01_SAMPLE,
                                        title: trueFalseOk.title,
                                      }}
                                      style={styleTokens}
                                      palette={palette}
                                      assets={[]}
                                      trueFalse={trueFalsePreview.trueFalse}
                                      mode={previewMode}
                                    />
                                  </BookPage>
                                </PagePreview>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>

          {previewSlotId &&
            previewSlot &&
            previewGen &&
            isQuizPersonalLabOk(previewGen) &&
            quizPersonalPreviewQuestions && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Preview QUIZ_01</h2>
                <div className="flex items-center gap-3">
                  <ModeToggle mode={previewMode} setMode={setPreviewMode} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewSlotId(null)}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8">
                <PagePreview>
                  <BookPage palette={palette} showSafeArea={false}>
                    <QuizTemplate
                      sample={QUIZ_01_SAMPLE}
                      style={styleTokens}
                      palette={palette}
                      assets={[]}
                      quiz={{
                        success: true,
                        seed: previewGen.seed,
                        questions: quizPersonalPreviewQuestions,
                        stats: {
                          seed: previewGen.seed,
                          received: quizPersonalPreviewQuestions.length,
                          validated: quizPersonalPreviewQuestions.length,
                        },
                        validation: { ok: true, errors: [] },
                      }}
                      mode={previewMode}
                    />
                  </BookPage>
                </PagePreview>
              </div>
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-base font-semibold">Jeux rejetés</h2>
              {plan.rejectedGames.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {plan.rejectedGames.map((r) => (
                    <li key={r.gameId} className="rounded-lg border border-border p-3">
                      <p className="font-medium">
                        {r.gameId === "QUIZ_PERSONAL" ? "Quiz personnalisé" : r.gameId}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                        Non éligible
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        <span className="text-foreground">Raison :</span> {r.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-base font-semibold">Sources & diversité</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Faits utilisés : {plan.stats.personalSourcesUsed.factIds.length}</li>
                <li>Souvenirs utilisés : {plan.stats.personalSourcesUsed.memoryIds.length}</li>
                <li>
                  Participants touchés : {plan.stats.personalSourcesUsed.participantIds.length}
                </li>
                <li>
                  Jeux consécutifs évités : {plan.stats.consecutiveSameGameAvoided}
                </li>
                <li>Répétitions d&apos;univers : {plan.stats.universeRepetitions}</li>
                <li>
                  Sujets interdits transportés :{" "}
                  {plan.forbiddenTopics.hasRestrictions ? "oui" : "non"}
                </li>
              </ul>
            </div>
          </section>
        </>
      )}

      {hasTrueFalseTheme && selected && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold">Test catalogue TRUE_FALSE_THEME</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Génération hors plan éditorial, pour valider le catalogue et un univers donné.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-col gap-1 text-sm">
              Univers
              <select
                className="h-10 rounded-lg border border-input bg-background px-3"
                value={catalogUniverseId || catalogUniverseOptions[0]?.id || ""}
                onChange={(e) => setCatalogUniverseId(e.target.value)}
              >
                {catalogUniverseOptions.length === 0 && (
                  <option value="">Aucun univers</option>
                )}
                {catalogUniverseOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              disabled={
                pending ||
                !aiConfigured ||
                !(catalogUniverseId || catalogUniverseOptions[0]?.id)
              }
              onClick={() => generateTrueFalseCatalogTest()}
            >
              {pending ? "Génération…" : "Générer (hors plan)"}
            </Button>
          </div>

          {catalogTfErr && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">{catalogTfErr.message}</p>
              {catalogTfErr.details?.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {catalogTfErr.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {catalogTfOk && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {previewSlotId === catalogTfOk.slotId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewSlotId(null)}
                  >
                    Masquer le rendu
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPreviewSlotId(catalogTfOk.slotId)
                      setPreviewMode("game")
                    }}
                  >
                    Voir le rendu
                  </Button>
                )}
              </div>
              <p className="text-sm font-medium">{catalogTfOk.title}</p>
              <p className="text-sm text-muted-foreground">
                Univers : {catalogTfOk.universeName} · Difficulté : {catalogTfOk.difficulty} ·{" "}
                {catalogTfOk.statementCount} affirmation
                {catalogTfOk.statementCount > 1 ? "s" : ""} · {catalogTfOk.durationMs} ms
              </p>
              <p className="text-sm text-muted-foreground">
                Debug : trueCount={catalogTfOk.trueCount} / falseCount={catalogTfOk.falseCount} ·
                styleDistinctCount={catalogTfOk.styleDistinctCount}
                {" · "}
                Validation diversité : {catalogTfOk.styleDiversityOk ? "OK" : "KO"}
              </p>
              <p className="text-sm text-muted-foreground">
                Topics : {catalogTfOk.topics.join(", ") || "—"}
              </p>
              {catalogTfOk.warnings.length > 0 && (
                <ul className="text-sm text-muted-foreground">
                  {catalogTfOk.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {catalogTfOk.statements.map((s, si) => (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">Affirmation {si + 1}</p>
                  <p className="mt-1 text-sm">&ldquo;{s.statement}&rdquo;</p>
                  <p className="mt-2 text-sm">Réponse : {s.answer ? "VRAI" : "FAUX"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Explication : {s.explanation}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sujet : {s.topicKey}
                    {s.topicLabel ? ` · ${s.topicLabel}` : ""}
                    {" · "}
                    Style : {s.statementStyle}
                  </p>
                </div>
              ))}

              {previewSlotId === catalogTfOk.slotId && (
                <div className="mt-2 rounded-lg border border-border bg-background p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">APERÇU</h4>
                    <ModeToggle mode={previewMode} setMode={setPreviewMode} />
                  </div>
                  {trueFalsePreview && !trueFalsePreview.ok ? (
                    <p className="text-sm text-destructive">{trueFalsePreview.message}</p>
                  ) : trueFalsePreview?.ok ? (
                    <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8">
                      <PagePreview>
                        <BookPage palette={palette} showSafeArea={false}>
                          <TrueFalseTemplate
                            sample={{
                              ...TRUE_FALSE_01_SAMPLE,
                              title: catalogTfOk.title,
                            }}
                            style={styleTokens}
                            palette={palette}
                            assets={[]}
                            trueFalse={trueFalsePreview.trueFalse}
                            mode={previewMode}
                          />
                        </BookPage>
                      </PagePreview>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

const FALLBACK_PALETTE: Palette = {
  id: "fallback",
  name: "Fallback",
  primary_color: "#1d4ed8",
  secondary_color: "#93c5fd",
  accent_color: "#f59e0b",
  background_color: "#ffffff",
  text_color: "#0f172a",
  active: true,
  created_at: "",
  updated_at: "",
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode
  tone?: "default" | "personal" | "theme"
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "personal" && "border-primary/30 bg-primary/10 text-foreground",
        tone === "theme" && "border-border bg-muted text-foreground",
        tone === "default" && "border-border bg-background",
      )}
    >
      {children}
    </span>
  )
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: "game" | "solution"
  setMode: (m: "game" | "solution") => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setMode("game")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "game" ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
        )}
      >
        Jeu
      </button>
      <button
        type="button"
        onClick={() => setMode("solution")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "solution"
            ? "bg-primary text-primary-foreground"
            : "bg-background text-foreground",
        )}
      >
        Correction
      </button>
    </div>
  )
}
