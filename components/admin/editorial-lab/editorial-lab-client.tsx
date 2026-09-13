"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  buildEditorialPlan,
  type EditorialPlanV1,
} from "@/lib/editorial-engine"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import type { Game, Universe } from "@/lib/supabase/types"

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
}: {
  projects: EditorialLabProject[]
  games: Game[]
  universes: Universe[]
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "")
  const [seed, setSeed] = useState("lab-seed-1")
  const [plan, setPlan] = useState<EditorialPlanV1 | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  const universeName = (id: string | null) => {
    if (!id) return null
    return universes.find((u) => u.id === id)?.name ?? id
  }

  function build() {
    setError(null)
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

  return (
    <div className="flex flex-col gap-6">
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
              {plan.selectedGames.map((slot, i) => (
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
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-base font-semibold">Jeux rejetés</h2>
              {plan.rejectedGames.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {plan.rejectedGames.map((r) => (
                    <li key={r.gameId} className="rounded-lg border border-border p-3">
                      <p className="font-medium">{r.gameId}</p>
                      <p className="text-muted-foreground">{r.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-base font-semibold">Sources & diversité</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  Faits utilisés : {plan.stats.personalSourcesUsed.factIds.length}
                </li>
                <li>
                  Souvenirs utilisés : {plan.stats.personalSourcesUsed.memoryIds.length}
                </li>
                <li>
                  Participants touchés :{" "}
                  {plan.stats.personalSourcesUsed.participantIds.length}
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
