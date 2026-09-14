"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { BookPage } from "@/components/book-renderer/book-page"
import { BookPageNumber } from "@/components/book-renderer/book-page-number"
import { PagePreview } from "@/components/book-renderer/page-preview"
import { CoverTemplate } from "@/components/book-renderer/templates/cover-template"
import { CrosswordTemplate } from "@/components/book-renderer/templates/crossword-template"
import { LettersCorrectionTemplate } from "@/components/book-renderer/templates/letters-correction-template"
import { QuizCorrectionTemplate } from "@/components/book-renderer/templates/quiz-correction-template"
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
import { resolveMiniBookPageColors } from "@/lib/mini-book/page-colors"
import type { MiniBookPage, MiniBookPreviewV1, MiniBookVisualIdentity } from "@/lib/mini-book/types"
import { MINI_BOOK_PAGE_COUNT } from "@/lib/mini-book/types"
import { buildQuizThemePreview } from "@/lib/content-generation/quiz-theme/preview"
import { buildWordSearchThemePreview } from "@/lib/content-generation/wordsearch-theme/preview"
import { buildCrosswordThemePreview } from "@/lib/content-generation/crossword-theme/preview"
import {
  generateBookLabGameAction,
  getBookLabPlanAction,
  prepareBookLabMemoryPageAction,
  prepareBookLabPersonalEditorialAction,
  prepareBookLabPhotoMemoryPageAction,
  type BookLabCrosswordContent,
  type BookLabMemoryPageResult,
  type BookLabPersonalEditorialResult,
  type BookLabPhotoMemoryPageResult,
  type BookLabQuizContent,
  type BookLabWordsearchContent,
} from "@/app/admin/book-lab/actions"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import type { Palette, Style } from "@/lib/supabase/types"
import { MemoryTemplate } from "@/components/book-renderer/templates/memory-template"
import { PhotoMemoryTemplate } from "@/components/book-renderer/templates/photo-memory-template"
import { PersonalEditorialTemplate } from "@/components/book-renderer/templates/personal-editorial-template"
import { blockTextWordCount, blockWeight } from "@/lib/personal-editorial"
import { resolveMemoryPageSurface } from "@/lib/memory-pages"

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

  const [memoryId, setMemoryId] = useState("")
  const [memoryPage, setMemoryPage] = useState<Extract<BookLabMemoryPageResult, { ok: true }> | null>(
    null,
  )
  const [memoryError, setMemoryError] = useState<string | null>(null)
  const [memoryPending, startMemoryTransition] = useTransition()

  const [photoId, setPhotoId] = useState("")
  const [photoMemoryPage, setPhotoMemoryPage] = useState<
    Extract<BookLabPhotoMemoryPageResult, { ok: true }> | null
  >(null)
  const [photoMemoryError, setPhotoMemoryError] = useState<string | null>(null)
  const [photoMemoryPending, startPhotoMemoryTransition] = useTransition()

  const [personalEditorial, setPersonalEditorial] = useState<
    Extract<BookLabPersonalEditorialResult, { ok: true }> | null
  >(null)
  const [personalEditorialError, setPersonalEditorialError] = useState<string | null>(null)
  const [personalEditorialPending, startPersonalEditorialTransition] = useTransition()
  const [personalPageIndex, setPersonalPageIndex] = useState(0)

  const selected = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  const availableMemories = useMemo(
    () => (selected?.profile.memories ?? []).filter((m) => m.text?.trim()),
    [selected],
  )

  const availablePhotos = useMemo(
    () =>
      (selected?.profile.photos ?? []).filter(
        (p) => p.useAuthorized && Boolean(p.storagePath),
      ),
    [selected],
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

  const memoryPalette = useMemo(() => {
    const id =
      memoryPage?.visualIdentity.paletteId ??
      photoMemoryPage?.visualIdentity.paletteId ??
      personalEditorial?.visualIdentity.paletteId ??
      visualIdentity?.paletteId
    return palettes.find((p) => p.id === id) ?? palettes[0] ?? FALLBACK_PALETTE
  }, [palettes, memoryPage, photoMemoryPage, personalEditorial, visualIdentity])

  const memoryStyle = useMemo(
    () =>
      getStyleTokens(
        memoryPage?.visualIdentity.styleId ??
          photoMemoryPage?.visualIdentity.styleId ??
          personalEditorial?.visualIdentity.styleId ??
          visualIdentity?.styleId ??
          styles[0]?.id ??
          "RETRO",
      ),
    [memoryPage, photoMemoryPage, personalEditorial, visualIdentity, styles],
  )

  const memorySurface = memoryPage
    ? resolveMemoryPageSurface(memoryPalette, memoryPage.visualRole)
    : undefined

  const photoMemorySurface = photoMemoryPage
    ? resolveMemoryPageSurface(memoryPalette, photoMemoryPage.visualRole)
    : undefined

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
    setMemoryPage(null)
    setMemoryError(null)
    setPhotoMemoryPage(null)
    setPhotoMemoryError(null)
    setPersonalEditorial(null)
    setPersonalEditorialError(null)
    setPersonalPageIndex(0)
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

  /** Rebuild structure only — never regenerates IA content. */
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

  function prepareMemoryPage(opts: { useAi: boolean; reformulate?: boolean }) {
    if (!selected) return
    const id = memoryId || availableMemories[0]?.id
    if (!id) {
      setMemoryError("Aucun souvenir disponible sur ce projet.")
      return
    }
    setMemoryError(null)
    startMemoryTransition(async () => {
      const reformSeed = opts.reformulate
        ? `${seed.trim() || "lab-seed-1"}:reform:${Date.now()}`
        : seed.trim() || "lab-seed-1"
      const result = await prepareBookLabMemoryPageAction({
        bookProjectId: selected.id,
        seed: reformSeed,
        memoryId: id,
        useAi: opts.useAi,
      })
      if (!result.ok) {
        setMemoryPage(null)
        setMemoryError(result.message)
        return
      }
      setMemoryId(result.memoryId)
      setMemoryPage(result)
    })
  }

  function preparePhotoMemoryPage(opts: { useAi: boolean }) {
    if (!selected) return
    const id = photoId || availablePhotos[0]?.id
    if (!id) {
      setPhotoMemoryError("Aucune photo autorisée / persistée sur ce projet.")
      return
    }
    setPhotoMemoryError(null)
    startPhotoMemoryTransition(async () => {
      const result = await prepareBookLabPhotoMemoryPageAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
        photoId: id,
        useAi: opts.useAi,
      })
      if (!result.ok) {
        setPhotoMemoryPage(null)
        setPhotoMemoryError(result.message)
        return
      }
      setPhotoId(result.photoId)
      setPhotoMemoryPage(result)
    })
  }

  function preparePersonalEditorial() {
    if (!selected) return
    setPersonalEditorialError(null)
    startPersonalEditorialTransition(async () => {
      const result = await prepareBookLabPersonalEditorialAction({
        bookProjectId: selected.id,
        seed: seed.trim() || "lab-seed-1",
      })
      if (!result.ok) {
        setPersonalEditorial(null)
        setPersonalEditorialError(result.message)
        return
      }
      setPersonalEditorial(result)
      setPersonalPageIndex(0)
    })
  }

  const allOk =
    status.quiz === "ok" && status.wordsearch === "ok" && status.crossword === "ok"

  const page = miniBook?.pages[pageIndex] ?? null
  const pageSurface = page ? resolveMiniBookPageColors(palette, page.colorKey) : undefined

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
          ? `Book Lab V2 — mini-cahier ${MINI_BOOK_PAGE_COUNT} pages (jeux + corrections compactes). Aucune persistence.`
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
                setMemoryId("")
                setPhotoId("")
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
              Mini-cahier · Page {page.pageNumber} / {MINI_BOOK_PAGE_COUNT} — {page.label}
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
              <BookPage palette={palette} showSafeArea={false} surface={pageSurface}>
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

      {selected && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-base font-semibold">MEMORY_TEXT_PAGE V1</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Page éditoriale à partir d&apos;un souvenir réel — TEXT_ONLY. Aucune photo
            associée par heuristique.
          </p>

          {availableMemories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun souvenir dans ce BookProfile.
            </p>
          ) : (
            <>
              <label className="mb-3 flex flex-col gap-1 text-sm">
                Souvenir
                <select
                  className="h-10 rounded-lg border border-input bg-background px-3"
                  value={memoryId || availableMemories[0]?.id || ""}
                  onChange={(e) => {
                    setMemoryId(e.target.value)
                    setMemoryPage(null)
                    setMemoryError(null)
                  }}
                >
                  {availableMemories.map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.title?.trim() || m.text.trim().slice(0, 48)) +
                        (m.place ? ` · ${m.place}` : "")}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => prepareMemoryPage({ useAi: false })}
                  disabled={memoryPending}
                >
                  Préparer sans IA
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => prepareMemoryPage({ useAi: true })}
                  disabled={memoryPending || !aiConfigured}
                >
                  Préparer avec reformulation IA
                </Button>
              </div>

              {memoryError && <p className="mb-3 text-sm text-destructive">{memoryError}</p>}

              {memoryPage && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                    <p className="mb-2 font-medium">Source originale</p>
                    <p className="text-muted-foreground">
                      id {memoryPage.memoryId}
                      {memoryPage.originalTitle ? ` · ${memoryPage.originalTitle}` : ""}
                      {memoryPage.originalPlace ? ` · ${memoryPage.originalPlace}` : ""}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">{memoryPage.originalText}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Densité : {memoryPage.density}
                      <br />
                      Variante : TEXT_ONLY
                      <br />
                      Pleine page recommandée : {memoryPage.fullPageRecommended ? "Oui" : "Non"}
                      <br />
                      {memoryPage.usedAi ? "Éditorial : IA" : "Éditorial : fallback"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-6">
                    <PagePreview>
                      <BookPage
                        palette={memoryPalette}
                        showSafeArea={false}
                        surface={memorySurface}
                      >
                        <MemoryTemplate
                          title={memoryPage.title}
                          body={memoryPage.body}
                          eyebrow={memoryPage.eyebrow}
                          place={memoryPage.place}
                          style={memoryStyle}
                          palette={memoryPalette}
                          visualRole={memoryPage.visualRole}
                          variant="TEXT_ONLY"
                          density={memoryPage.density}
                        />
                      </BookPage>
                    </PagePreview>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {selected && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-base font-semibold">PHOTO_MEMORY_PAGE V1</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Page construite à partir d&apos;une photo autorisée et de sa légende / anecdote —
            jamais d&apos;un souvenir indépendant.
          </p>

          {availablePhotos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune photo SAVED + autorisée dans ce BookProfile.
            </p>
          ) : (
            <>
              <label className="mb-3 flex flex-col gap-1 text-sm">
                Photo
                <select
                  className="h-10 rounded-lg border border-input bg-background px-3"
                  value={photoId || availablePhotos[0]?.id || ""}
                  onChange={(e) => {
                    setPhotoId(e.target.value)
                    setPhotoMemoryPage(null)
                    setPhotoMemoryError(null)
                  }}
                >
                  {availablePhotos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.caption?.trim() || p.anecdote?.trim() || p.id).slice(0, 56)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => preparePhotoMemoryPage({ useAi: false })}
                  disabled={photoMemoryPending}
                >
                  Préparer sans IA
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => preparePhotoMemoryPage({ useAi: true })}
                  disabled={photoMemoryPending || !aiConfigured}
                >
                  Préparer avec reformulation IA
                </Button>
              </div>

              {photoMemoryError && (
                <p className="mb-3 text-sm text-destructive">{photoMemoryError}</p>
              )}

              {photoMemoryPage && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                    <p className="mb-2 font-medium">PHOTO SOURCE</p>
                    {photoMemoryPage.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoMemoryPage.photoUrl}
                        alt=""
                        className="mb-3 max-h-40 rounded-md border border-border object-cover"
                      />
                    ) : null}
                    <p className="text-xs text-muted-foreground">photoId {photoMemoryPage.photoId}</p>
                    <p className="mt-2">
                      <span className="font-medium">Légende :</span>{" "}
                      {photoMemoryPage.caption || "—"}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium">Anecdote :</span>{" "}
                      {photoMemoryPage.anecdote || "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Participants :{" "}
                      {photoMemoryPage.participantIds.length
                        ? photoMemoryPage.participantIds.join(", ")
                        : "—"}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Layout : {photoMemoryPage.layout}
                      <br />
                      Densité : {photoMemoryPage.density}
                      <br />
                      Pleine page : {photoMemoryPage.fullPageRecommended ? "Oui" : "Non"}
                      {photoMemoryPage.weakSource ? " · source faible (sans texte)" : ""}
                      <br />
                      {photoMemoryPage.usedAi ? "Éditorial : IA" : "Éditorial : fallback"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-6">
                    {photoMemoryPage.photoUrl ? (
                      <PagePreview>
                        <BookPage
                          palette={memoryPalette}
                          showSafeArea={false}
                          surface={photoMemorySurface}
                        >
                          <PhotoMemoryTemplate
                            title={photoMemoryPage.title}
                            body={photoMemoryPage.body}
                            eyebrow={photoMemoryPage.eyebrow}
                            style={memoryStyle}
                            palette={memoryPalette}
                            visualRole={photoMemoryPage.visualRole}
                            density={photoMemoryPage.density}
                            layout={photoMemoryPage.layout}
                            photoUrl={photoMemoryPage.photoUrl}
                            weakSource={photoMemoryPage.weakSource}
                          />
                        </BookPage>
                      </PagePreview>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        URL signée indisponible — impossible de prévisualiser la photo.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {selected && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-base font-semibold">PERSONAL EDITORIAL PAGE LAB</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Compose automatiquement des pages à partir des MemoryBlocks et PhotoMemoryBlocks —
            sans inventer de contenu ni appeler l&apos;IA pour remplir.
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => preparePersonalEditorial()}
              disabled={personalEditorialPending}
            >
              Composer les pages personnelles
            </Button>
          </div>

          {personalEditorialError && (
            <p className="mb-3 text-sm text-destructive">{personalEditorialError}</p>
          )}

          {personalEditorial && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {personalEditorial.blockCount} bloc(s) → {personalEditorial.pageCount} page(s)
                </p>
                <ul className="space-y-2">
                  {personalEditorial.pages.map((p, i) => (
                    <li key={p.pageKey}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left",
                          i === personalPageIndex
                            ? "border-foreground bg-muted/50"
                            : "border-border bg-background",
                        )}
                        onClick={() => setPersonalPageIndex(i)}
                      >
                        <span className="font-medium">Page personnelle {i + 1}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Layout : {p.layoutId}
                          {p.page.editorialFamily ? ` · ${p.page.editorialFamily}` : ""}
                          {p.page.layoutVariant ? ` · variante ${p.page.layoutVariant}` : ""}
                          <br />
                          Page theme : {p.page.theme?.title ?? "—"}
                          <br />
                          Compatibility :{" "}
                          {Math.round((p.page.compatibilityScore ?? 0) * 100)} %
                          {p.page.theme?.groupingReason
                            ? ` — ${p.page.theme.groupingReason}`
                            : ""}
                          <br />
                          Poids : {p.weight} / 4 · Remplissage logique :{" "}
                          {Math.round((p.page.packingFillScore ?? p.page.pageFillScore) * 100)} %
                          {p.isHero ? (
                            <>
                              <br />
                              HERO
                              {p.page.heroReason ? ` — ${p.page.heroReason}` : ""}
                            </>
                          ) : p.layoutId === "SINGLE_MEMORY" ||
                            p.layoutId === "SINGLE_PHOTO_MEMORY" ? (
                            <>
                              <br />
                              Layout simple (pas HERO)
                            </>
                          ) : null}
                          <br />
                          Blocks : {p.page.blocks.length} · Sources :{" "}
                          {[
                            ...p.sourcePhotoIds.map((id) => `photo ${id}`),
                            ...p.sourceMemoryIds.map((id) => `souvenir ${id}`),
                          ].join(" · ") || "—"}
                          {p.page.blocks.map((b) => {
                            const id =
                              b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId
                            const words = blockTextWordCount(b)
                            const w = blockWeight(b)
                            return (
                              <span key={`${b.type}:${id}`} className="mt-1 block pl-1">
                                · {b.type === "MEMORY" ? "MEMORY" : "PHOTO"} {id.slice(0, 8)}
                                …
                                <br />
                                Density : {b.density} · Text words : {words} · Packing weight :{" "}
                                {w}
                                <br />
                                Perspective : {b.perspective} · Category : {b.semanticCategory}
                                {b.semanticTags.length
                                  ? ` · Tags : ${b.semanticTags.join(", ")}`
                                  : ""}
                                <br />
                                SOURCE : {(b.originalText || "").slice(0, 120)}
                                {(b.originalText || "").length > 120 ? "…" : ""}
                                <br />
                                FACT :{" "}
                                {[
                                  ...(b.facts?.creatorOpinions ?? []),
                                  ...(b.facts?.sharedFacts ?? []),
                                ]
                                  .slice(0, 3)
                                  .join(" · ") || "—"}
                                <br />
                                CLAIMS : {(b.claimsUsed ?? []).join(" · ") || "—"}
                                <br />
                                → ÉDITO : {(b.displayText || b.body || "").slice(0, 120)}
                                {(b.displayText || b.body || "").length > 120 ? "…" : ""}
                                {b.type === "PHOTO_MEMORY" ? (
                                  <>
                                    <br />
                                    sourcePhotoId : {b.sourcePhotoId} · renderedPhotoId :{" "}
                                    {b.sourcePhotoId}
                                  </>
                                ) : null}
                              </span>
                            )
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-6">
                {personalEditorial.pages[personalPageIndex] ? (
                  <PagePreview>
                    <BookPage
                      palette={memoryPalette}
                      showSafeArea={false}
                      surface={resolveMemoryPageSurface(
                        memoryPalette,
                        personalEditorial.pages[personalPageIndex]!.visualRole,
                      )}
                    >
                      <PersonalEditorialTemplate
                        page={personalEditorial.pages[personalPageIndex]!.page}
                        style={memoryStyle}
                        palette={memoryPalette}
                      />
                    </BookPage>
                  </PagePreview>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune page à afficher.</p>
                )}
              </div>
            </div>
          )}
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

  if (page.kind === "QUIZ_CORRECTION") {
    if (!quizPreview?.ok || !quiz) {
      return <p className="text-sm text-destructive">Quiz indisponible.</p>
    }
    return (
      <QuizCorrectionTemplate
        title={quiz.title}
        universeName={quiz.universeName}
        style={style}
        palette={palette}
        quiz={quizPreview.quiz}
      />
    )
  }

  if (page.kind === "LETTERS_CORRECTION") {
    return (
      <LettersCorrectionTemplate
        style={style}
        palette={palette}
        wordsearchTitle={page.wordsearch.title}
        wordsearch={wordsearchPreview?.ok ? wordsearchPreview.wordsearch : null}
        crosswordTitle={page.crossword.title}
        crossword={crosswordPreview?.ok ? crosswordPreview.crossword : null}
      />
    )
  }

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
        mode="game"
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
        mode="game"
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
        mode="game"
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
