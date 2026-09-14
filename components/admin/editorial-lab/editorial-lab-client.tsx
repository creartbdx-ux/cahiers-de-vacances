"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { BookPage } from "@/components/book-renderer/book-page"
import { PagePreview } from "@/components/book-renderer/page-preview"
import { QuizTemplate } from "@/components/book-renderer/templates/quiz-template"
import { QUIZ_01_SAMPLE } from "@/lib/book-renderer/templates"
import { getStyleTokens } from "@/lib/book-renderer/styles"
import { cn } from "@/lib/utils"
import {
  buildEditorialPlan,
  type EditorialGameSlot,
  type EditorialPlanV1,
} from "@/lib/editorial-engine"
import { buildQuizPersonalSourceContext } from "@/lib/content-generation/source-context"
import {
  generateQuizPersonalLabAction,
  type GenerateQuizPersonalLabResult,
} from "@/app/admin/editorial-lab/actions"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import type { Game, Palette, Style, Universe } from "@/lib/supabase/types"
import type { QuizQuestion } from "@/lib/game-engines/quiz/types"
import { QUIZ_CHOICE_LABELS } from "@/lib/game-engines/quiz/types"

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
  const [genBySlot, setGenBySlot] = useState<
    Record<string, GenerateQuizPersonalLabResult | undefined>
  >({})
  const [previewSlotId, setPreviewSlotId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<"game" | "solution">("game")
  const [pending, startTransition] = useTransition()

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

  function generateSlot(slot: EditorialGameSlot) {
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

  const previewQuestions: QuizQuestion[] | null = (() => {
    if (!previewSlotId) return null
    const gen = genBySlot[previewSlotId]
    if (!gen || !gen.ok) return null
    return gen.engineQuestions
  })()

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
          ? "Génération IA configurée (CONTENT_GENERATION_API_KEY). Disponible pour les slots QUIZ_PERSONAL."
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
                const gen = genBySlot[slot.slotId]
                const sourcePreview =
                  selected && isQuizPersonal
                    ? buildQuizPersonalSourceContext({
                        profile: selected.profile,
                        slot,
                      })
                    : null

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
                            onClick={() => generateSlot(slot)}
                          >
                            {pending ? "Génération…" : "Générer le contenu"}
                          </Button>
                          {gen?.ok && (
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

                        {gen && !gen.ok && (
                          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <p className="font-medium">{gen.message}</p>
                            {gen.details?.length ? (
                              <ul className="mt-2 list-disc pl-5">
                                {gen.details.map((d) => (
                                  <li key={d}>{d}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}

                        {gen?.ok && (
                          <div className="mt-4 flex flex-col gap-4">
                            <p className="text-sm text-muted-foreground">
                              Validation OK · {gen.questionCount} question
                              {gen.questionCount > 1 ? "s" : ""} · {gen.durationMs} ms
                              {gen.repaired ? " · réparation auto utilisée" : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sources utilisées : {gen.usedSourceIds.factIds.length} faits,{" "}
                              {gen.usedSourceIds.memoryIds.length} souvenirs,{" "}
                              {gen.usedSourceIds.jokeIds.length} jokes · Non utilisées :{" "}
                              {gen.unusedSourceIds.factIds.length} faits,{" "}
                              {gen.unusedSourceIds.memoryIds.length} souvenirs,{" "}
                              {gen.unusedSourceIds.jokeIds.length} jokes
                            </p>
                            {gen.warnings.length > 0 && (
                              <ul className="text-sm text-muted-foreground">
                                {gen.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            )}
                            {gen.questions.map((q, qi) => (
                              <div key={q.id} className="rounded-lg border border-border p-3">
                                <p className="text-sm font-medium">
                                  Question {qi + 1}
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
                  </article>
                )
              })}
            </div>
          </section>

          {previewQuestions && previewSlotId && (
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
                        seed: genBySlot[previewSlotId]?.ok
                          ? genBySlot[previewSlotId].seed
                          : "preview",
                        questions: previewQuestions,
                        stats: {
                          seed: "preview",
                          received: previewQuestions.length,
                          validated: previewQuestions.length,
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
