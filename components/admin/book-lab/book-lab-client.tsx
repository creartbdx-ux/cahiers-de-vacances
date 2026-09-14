"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { BookPage } from "@/components/book-renderer/book-page"
import { BookPageNumber } from "@/components/book-renderer/book-page-number"
import { PagePreview } from "@/components/book-renderer/page-preview"
import { CoverTemplate } from "@/components/book-renderer/templates/cover-template"
import { CorrectionsDividerTemplate } from "@/components/book-renderer/templates/corrections-divider-template"
import { CrosswordTemplate } from "@/components/book-renderer/templates/crossword-template"
import { QuizTemplate } from "@/components/book-renderer/templates/quiz-template"
import { WordsearchTemplate } from "@/components/book-renderer/templates/wordsearch-template"
import {
  CROSSWORD_01_INSTRUCTION,
  CROSSWORD_01_SAMPLE,
  QUIZ_01_SAMPLE,
  WORDSEARCH_01_SAMPLE,
} from "@/lib/book-renderer/templates"
import { getStyleTokens } from "@/lib/book-renderer/styles"
import { cn } from "@/lib/utils"
import { assembleMiniBookPreview } from "@/lib/mini-book/assemble"
import type { MiniBookPage, MiniBookPreviewV1, MiniBookVisualIdentity } from "@/lib/mini-book/types"
import { buildQuizThemePreview } from "@/lib/content-generation/quiz-theme/preview"
import { buildWordSearchThemePreview } from "@/lib/content-generation/wordsearch-theme/preview"
import { buildCrosswordThemePreview } from "@/lib/content-generation/crossword-theme/preview"
import {
  generateBookLabGameAction,
  getBookLabPlanAction,
  type BookLabCrosswordContent,
  type BookLabQuizContent,
  type BookLabWordsearchContent,
} from "@/app/admin/book-lab/actions"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import type { Palette, Style } from "@/lib/supabase/types"

export type BookLabProject = {
  id: string
  label: string
  status: string
  richnessLevel: RichnessLevel
  profile: BookProfileV1
}

type GenStatus = "idle" | "pending" | "ok" | "error"

type GameKey = "quiz" | "wordsearch" | "crossword"

export function BookLabClient({
  projects,
  palettes,
  styles,
  aiConfigured,
}: {
  projects: BookLabProject[]
  palettes: Palette[]
  styles: Style[]
  aiConfigured: boolean
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "")
  const [seed, setSeed] = useState("lab-seed-1")
  const [visualIdentity, setVisualIdentity] = useState<MiniBookVisualIdentity | null>(null)
  const [planReady, setPlanReady] = useState(false)
  const [missing, setMissing] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const [quiz, setQuiz] = useState<BookLabQuizContent | null>(null)
  const [wordsearch, setWordsearch] = useState<BookLabWordsearchContent | null>(null)
  const [crossword, setCrossword] = useState<BookLabCrosswordContent | null>(null)

  const [status, setStatus] = useState<Record<GameKey, GenStatus>>({
    quiz: "idle",
    wordsearch: "idle",
    crossword: "idle",
  })
  const [errors, setErrors] = useState<Partial<Record<GameKey, string>>>({})

  const [miniBook, setMiniBook] = useState<MiniBookPreviewV1 | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pending, startTransition] = useTransition()

  const selected = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  const palette = useMemo(() => {
    const id = visualIdentity?.paletteId
    return palettes.find((p) => p.id === id) ?? palettes[0] ?? FALLBACK_PALETTE
  }, [palettes, visualIdentity])

  const styleTokens = useMemo(
    () => getStyleTokens(visualIdentity?.styleId ?? styles[0]?.id ?? "RETRO"),
    [visualIdentity, styles],
  )

  const quizPreview = useMemo(() => {
    if (!quiz) return null
    return buildQuizThemePreview(quiz.questions, quiz.seed)
  }, [quiz])

  const wordsearchPreview = useMemo(() => {
    if (!wordsearch) return null
    return buildWordSearchThemePreview(wordsearch.words, wordsearch.seed)
  }, [wordsearch])

  const crosswordPreview = useMemo(() => {
    if (!crossword) return null
    return buildCrosswordThemePreview(crossword.entries, crossword.seed)
  }, [crossword])

  function resetContents() {
    setQuiz(null)
    setWordsearch(null)
    setCrossword(null)
    setStatus({ quiz: "idle", wordsearch: "idle", crossword: "idle" })
    setErrors({})
    setMiniBook(null)
    setPageIndex(0)
    setPlanReady(false)
    setVisualIdentity(null)
    setMissing([])
  }

  function loadPlan() {
    if (!selected) return
    setError(null)
    resetContents()
    startTransition(async () => {
      const result = await getBookLabPlanAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setVisualIdentity(result.visualIdentity)
      setMissing(result.missing)
      setPlanReady(true)
      if (result.missing.length) {
        setError(
          `Plan incomplet : manque ${result.missing.join(", ")}. Choisissez un autre seed ou projet.`,
        )
      }
    })
  }

  async function generateOne(gameKey: GameKey, gameId: "QUIZ_THEME" | "WORDSEARCH_THEME" | "CROSSWORD_THEME") {
    if (!selected) return
    setStatus((s) => ({ ...s, [gameKey]: "pending" }))
    setErrors((e) => {
      const next = { ...e }
      delete next[gameKey]
      return next
    })

    const result = await generateBookLabGameAction({
      bookProjectId: selected.id,
      seed: seed.trim() || "lab-seed-1",
      gameId,
    })

    if (!result.ok) {
      setStatus((s) => ({ ...s, [gameKey]: "error" }))
      setErrors((e) => ({ ...e, [gameKey]: result.message }))
      return
    }

    if (gameKey === "quiz" && "questions" in result) setQuiz(result)
    if (gameKey === "wordsearch" && "words" in result) setWordsearch(result)
    if (gameKey === "crossword" && "entries" in result) setCrossword(result)
    setStatus((s) => ({ ...s, [gameKey]: "ok" }))
  }

  function generateAll() {
    if (!selected || missing.length) return
    setError(null)
    setMiniBook(null)
    startTransition(async () => {
      // Skip games already OK — do not regenerate valid content.
      if (!quiz) await generateOne("quiz", "QUIZ_THEME")
      if (!wordsearch) await generateOne("wordsearch", "WORDSEARCH_THEME")
      if (!crossword) await generateOne("crossword", "CROSSWORD_THEME")
    })
  }

  function rebuildMiniBook() {
    if (!selected || !visualIdentity || !quiz || !wordsearch || !crossword) {
      setError("Les trois jeux doivent être générés avant de reconstruire le mini-cahier.")
      return
    }
    setError(null)
    const book = assembleMiniBookPreview({
      bookProjectId: selected.id,
      seed: seed.trim() || "lab-seed-1",
      profile: selected.profile,
      visualIdentity,
      quiz: {
        slotId: quiz.slotId,
        universeId: quiz.universeId,
        universeName: quiz.universeName,
        title: quiz.title,
      },
      wordsearch: {
        slotId: wordsearch.slotId,
        universeId: wordsearch.universeId,
        universeName: wordsearch.universeName,
        title: wordsearch.title,
      },
      crossword: {
        slotId: crossword.slotId,
        universeId: crossword.universeId,
        universeName: crossword.universeName,
        title: crossword.title,
      },
    })
    setMiniBook(book)
    setPageIndex(0)
  }

  const allOk =
    status.quiz === "ok" && status.wordsearch === "ok" && status.crossword === "ok"

  // Assemble is explicit via "Afficher / Reconstruire le mini-cahier" — never on navigation.

  const page = miniBook?.pages[pageIndex] ?? null

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
          ? "Book Lab — mini-cahier 8 pages (couverture + 3 jeux + corrections). Aucune persistence."
          : "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY puis redéployez."}
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
                resetContents()
              }}
            >
              {projects.length === 0 && <option value="">Aucun projet</option>}
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
            />
          </label>
        </div>
        {selected && (
          <p className="mt-3 text-sm text-muted-foreground">
            Audience {selected.profile.audience} · style préféré{" "}
            {selected.profile.visualPreferences.styleId} · palette{" "}
            {selected.profile.visualPreferences.paletteId}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={loadPlan} disabled={!selected || pending}>
            Charger le plan
          </Button>
          <Button
            type="button"
            onClick={generateAll}
            disabled={!planReady || !!missing.length || !aiConfigured || pending}
          >
            Générer le mini-cahier
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={rebuildMiniBook}
            disabled={!allOk || pending}
          >
            Reconstruire le mini-cahier
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {visualIdentity && (
          <p className="mt-3 text-sm text-muted-foreground">
            Identité visuelle : style {visualIdentity.styleId}
            {visualIdentity.styleFromAuto ? " (AUTO)" : ""} · palette {visualIdentity.paletteId}
            {visualIdentity.paletteFromAuto ? " (AUTO)" : ""}
          </p>
        )}
      </div>

      {planReady && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Génération</h2>
          <ul className="space-y-2 text-sm">
            <GenRow
              label="Quiz"
              status={status.quiz}
              error={errors.quiz}
              universe={quiz?.universeName}
              onRetry={() =>
                startTransition(async () => {
                  await generateOne("quiz", "QUIZ_THEME")
                })
              }
              pending={pending}
            />
            <GenRow
              label="Mots mêlés"
              status={status.wordsearch}
              error={errors.wordsearch}
              universe={wordsearch?.universeName}
              onRetry={() =>
                startTransition(async () => {
                  await generateOne("wordsearch", "WORDSEARCH_THEME")
                })
              }
              pending={pending}
            />
            <GenRow
              label="Mots croisés"
              status={status.crossword}
              error={errors.crossword}
              universe={crossword?.universeName}
              onRetry={() =>
                startTransition(async () => {
                  await generateOne("crossword", "CROSSWORD_THEME")
                })
              }
              pending={pending}
            />
          </ul>
          {allOk && !miniBook && (
            <div className="mt-4">
              <Button type="button" onClick={rebuildMiniBook}>
                Afficher le mini-cahier
              </Button>
            </div>
          )}
        </section>
      )}

      {miniBook && page && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              Mini-cahier · Page {page.pageNumber} / 8 — {page.label}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pageIndex <= 0}
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              >
                ←
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pageIndex >= miniBook.pages.length - 1}
                onClick={() => setPageIndex((i) => Math.min(miniBook.pages.length - 1, i + 1))}
              >
                →
              </Button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {miniBook.pages.map((p, i) => (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => setPageIndex(i)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  i === pageIndex
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {p.pageNumber} {p.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8">
            <PagePreview>
              <BookPage palette={palette} showSafeArea={false}>
                <MiniBookPageView
                  page={page}
                  style={styleTokens}
                  palette={palette}
                  quiz={quiz}
                  wordsearch={wordsearch}
                  crossword={crossword}
                  quizPreview={quizPreview}
                  wordsearchPreview={wordsearchPreview}
                  crosswordPreview={crosswordPreview}
                />
                {page.showPageNumber && <BookPageNumber n={page.pageNumber} />}
              </BookPage>
            </PagePreview>
          </div>
        </section>
      )}
    </div>
  )
}

function GenRow({
  label,
  status,
  error,
  universe,
  onRetry,
  pending,
}: {
  label: string
  status: GenStatus
  error?: string
  universe?: string
  onRetry: () => void
  pending: boolean
}) {
  const statusLabel =
    status === "idle"
      ? "En attente"
      : status === "pending"
        ? "Génération…"
        : status === "ok"
          ? "OK"
          : "Erreur"
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">
        : {statusLabel}
        {universe ? ` · ${universe}` : ""}
      </span>
      {status === "error" && (
        <>
          <span className="text-destructive">{error}</span>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onRetry}>
            Réessayer
          </Button>
        </>
      )}
      {status === "ok" && (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onRetry}>
          Régénérer
        </Button>
      )}
    </li>
  )
}

function MiniBookPageView({
  page,
  style,
  palette,
  quiz,
  wordsearch,
  crossword,
  quizPreview,
  wordsearchPreview,
  crosswordPreview,
}: {
  page: MiniBookPage
  style: ReturnType<typeof getStyleTokens>
  palette: Palette
  quiz: BookLabQuizContent | null
  wordsearch: BookLabWordsearchContent | null
  crossword: BookLabCrosswordContent | null
  quizPreview: ReturnType<typeof buildQuizThemePreview> | null
  wordsearchPreview: ReturnType<typeof buildWordSearchThemePreview> | null
  crosswordPreview: ReturnType<typeof buildCrosswordThemePreview> | null
}) {
  if (page.kind === "COVER") {
    return (
      <CoverTemplate
        displayName={page.displayName}
        subtitle={page.subtitle}
        style={style}
        palette={palette}
      />
    )
  }

  if (page.kind === "CORRECTIONS_DIVIDER") {
    return (
      <CorrectionsDividerTemplate
        title={page.title}
        body={page.body}
        style={style}
        palette={palette}
      />
    )
  }

  const mode = page.mode === "CORRECTION" ? "solution" : "game"

  if (page.kind === "QUIZ") {
    if (!quizPreview?.ok || !quiz) {
      return <p className="text-sm text-destructive">Quiz indisponible.</p>
    }
    return (
      <QuizTemplate
        sample={{ ...QUIZ_01_SAMPLE, title: quiz.title }}
        style={style}
        palette={palette}
        assets={[]}
        quiz={quizPreview.quiz}
        mode={mode}
      />
    )
  }

  if (page.kind === "WORDSEARCH") {
    if (!wordsearchPreview?.ok || !wordsearch) {
      return <p className="text-sm text-destructive">Mots mêlés indisponibles.</p>
    }
    return (
      <WordsearchTemplate
        sample={{ ...WORDSEARCH_01_SAMPLE, title: wordsearch.title }}
        style={style}
        palette={palette}
        assets={[]}
        wordsearch={wordsearchPreview.wordsearch}
        mode={mode}
      />
    )
  }

  if (page.kind === "CROSSWORD") {
    if (!crosswordPreview?.ok || !crossword) {
      return <p className="text-sm text-destructive">Mots croisés indisponibles.</p>
    }
    return (
      <CrosswordTemplate
        sample={{
          ...CROSSWORD_01_SAMPLE,
          title: crossword.title,
          instruction: CROSSWORD_01_INSTRUCTION,
        }}
        style={style}
        palette={palette}
        assets={[]}
        crossword={crosswordPreview.crossword}
        mode={mode}
      />
    )
  }

  return null
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
