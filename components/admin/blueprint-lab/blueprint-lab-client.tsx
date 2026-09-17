"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  buildBookBlueprint,
  type BookBlueprintV1,
  type ImplementationStatus,
  type PageFamily,
} from "@/lib/book-blueprint"
import type { BookProfileV1, RichnessLevel } from "@/lib/questionnaire/types"
import type { Palette, Style } from "@/lib/supabase/types"

export type BlueprintLabProject = {
  id: string
  label: string
  status: string
  richnessLevel: RichnessLevel
  profile: BookProfileV1
}

type FilterKey = "ALL" | "READY" | "MISSING" | "PERSONAL" | "THEME" | "CORRECTIONS"

const STATUS_STYLE: Record<ImplementationStatus, string> = {
  READY: "bg-emerald-100 text-emerald-800 border-emerald-300",
  PARTIAL: "bg-amber-100 text-amber-900 border-amber-300",
  MISSING: "bg-rose-100 text-rose-800 border-rose-300",
}

const ROLE_STYLE: Record<string, string> = {
  PRIMARY: "bg-pink-100 text-pink-900",
  SECONDARY: "bg-sky-100 text-sky-900",
  ACCENT: "bg-orange-100 text-orange-900",
  LIGHT: "bg-stone-100 text-stone-700",
  NEUTRAL: "bg-zinc-100 text-zinc-700",
}

export function BlueprintLabClient({
  projects,
  palettes,
  styles,
}: {
  projects: BlueprintLabProject[]
  palettes: Palette[]
  styles: Style[]
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "")
  const [seed, setSeed] = useState("blueprint-seed-1")
  const [targetPages, setTargetPages] = useState(50)
  const [blueprint, setBlueprint] = useState<BookBlueprintV1 | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>("ALL")

  const selected = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  function build() {
    if (!selected) {
      setError("Sélectionnez un projet.")
      return
    }
    setError(null)
    try {
      const bp = buildBookBlueprint({
        bookProjectId: selected.id,
        seed: seed.trim() || "blueprint-seed-1",
        profile: selected.profile,
        richnessLevel: selected.richnessLevel,
        styles,
        palettes,
        targetInteriorPages: targetPages,
      })
      setBlueprint(bp)
    } catch (e) {
      setBlueprint(null)
      setError(e instanceof Error ? e.message : "Échec du blueprint.")
    }
  }

  const filteredPages = useMemo(() => {
    if (!blueprint) return []
    return blueprint.pages.filter((p) => {
      if (filter === "ALL") return true
      if (filter === "READY") return p.implementationStatus === "READY"
      if (filter === "MISSING")
        return p.implementationStatus === "MISSING" || p.implementationStatus === "PARTIAL"
      if (filter === "PERSONAL") {
        return (
          (p.personalizationTouches?.length ?? 0) > 0 ||
          p.dataNeed === "DEEP_PERSONAL" ||
          p.family === "PHOTO" ||
          p.personalizationType === "PERSONAL"
        )
      }
      if (filter === "THEME") return p.personalizationType === "THEME"
      if (filter === "CORRECTIONS") return p.family === "CORRECTION"
      return true
    })
  }, [blueprint, filter])

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Blueprint Lab — structure éditoriale déterministe (~50 pages). Aucun appel IA, aucune
        persistence, aucune génération de contenu.
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm sm:col-span-1">
            Projet
            <select
              className="h-10 rounded-lg border border-input bg-background px-3"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                setBlueprint(null)
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
          <label className="flex flex-col gap-1 text-sm">
            Pages intérieures
            <input
              type="number"
              min={12}
              max={120}
              className="h-10 rounded-lg border border-input bg-background px-3"
              value={targetPages}
              onChange={(e) => setTargetPages(Number(e.target.value) || 50)}
            />
          </label>
        </div>
        {selected && (
          <p className="mt-3 text-sm text-muted-foreground">
            {selected.profile.audience} · {selected.richnessLevel} ·{" "}
            {selected.profile.photos?.length ?? 0} photo(s) ·{" "}
            {selected.profile.memories?.length ?? 0} souvenir(s)
          </p>
        )}
        <div className="mt-4">
          <Button type="button" onClick={build} disabled={!selected}>
            Construire le Blueprint
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {blueprint && (
        <>
          <CoverCard blueprint={blueprint} />
          <StatsCard blueprint={blueprint} />
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Timeline des pages</h2>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["ALL", "Toutes"],
                    ["READY", "READY"],
                    ["MISSING", "MISSING"],
                    ["PERSONAL", "PERSONAL"],
                    ["THEME", "THEME"],
                    ["CORRECTIONS", "CORRECTIONS"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                      filter === key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {filteredPages.map((p) => (
                <li
                  key={p.slotId}
                  className="flex flex-wrap items-start gap-2 rounded-xl border border-border px-3 py-2.5 text-sm"
                >
                  <span className="w-16 shrink-0 font-semibold tabular-nums">P{p.pageNumber}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.label}</span>
                      <StatusBadge status={p.implementationStatus} />
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          ROLE_STYLE[p.visualRole] ?? "bg-muted",
                        )}
                      >
                        {p.visualRole}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {p.density}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {familyLabel(p.family)}
                      {p.dataNeed ? ` · ${p.dataNeed}` : ""}
                      {p.universeId ? ` · ${p.universeId}` : ""}
                      {p.gameId ? ` · ${p.gameId}` : ""}
                      {p.correctionOf?.length
                        ? ` · corrige ${p.correctionOf.length} jeu(x)`
                        : ""}
                    </p>
                    {(p.personalizationTouches?.length ?? 0) > 0 ? (
                      <p className="mt-0.5 text-xs text-foreground/80">
                        Touches :{" "}
                        {p.personalizationTouches!.map((t) => `${t.type} (${t.usage})`).join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground/80">{p.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <GapsCard blueprint={blueprint} />
        </>
      )}
    </div>
  )
}

function CoverCard({ blueprint }: { blueprint: BookBlueprintV1 }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-2 text-base font-semibold">Couverture (hors pagination)</h2>
      <p className="text-2xl font-semibold tracking-tight">{blueprint.cover.displayName}</p>
      <p className="text-sm text-muted-foreground">{blueprint.cover.subtitle}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {blueprint.visualIdentity.styleId} / {blueprint.visualIdentity.paletteId}
        {blueprint.visualIdentity.styleFromAuto ? " · style AUTO" : ""}
        {blueprint.visualIdentity.paletteFromAuto ? " · palette AUTO" : ""}
      </p>
    </div>
  )
}

function StatsCard({ blueprint }: { blueprint: BookBlueprintV1 }) {
  const s = blueprint.stats
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-base font-semibold">Statistiques</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <Stat label="Pages" value={String(s.interiorPageCount)} />
        <Stat label="Jeux principaux" value={String(s.mainGamePages)} />
        <Stat label="Pages avec touches" value={String(s.pagesWithTouches)} />
        <Stat
          label="Perso. (touches+deep+photo)"
          value={String(
            s.pagesWithTouches +
              (s.byDataNeed?.DEEP_PERSONAL ?? 0) +
              s.photoPages,
          )}
        />
        <Stat label="Photos" value={String(s.photoPages)} />
        <Stat label="Souvenirs" value={String(s.memoryPages)} />
        <Stat label="Jeux rapides" value={String(s.quickGamePages)} />
        <Stat label="Corrections" value={String(s.correctionPages)} />
        <Stat label="THEME %" value={`${s.themePercent}%`} />
        <Stat label="PERSONAL %" value={`${s.personalPercent}%`} />
        <Stat label="READY %" value={`${s.readyPercent}%`} />
        <Stat label="MISSING %" value={`${s.missingPercent}%`} />
        <Stat
          label="Densité"
          value={`L${s.byDensity.LIGHT} · M${s.byDensity.MEDIUM} · H${s.byDensity.HEAVY}`}
        />
      </div>
      {s.byDataNeed ? (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Data need</h3>
          <ul className="flex flex-wrap gap-2 text-xs">
            {Object.entries(s.byDataNeed).map(([id, n]) =>
              n > 0 ? (
                <li key={id} className="rounded-lg border border-border px-2 py-1">
                  {id} · {n}
                </li>
              ) : null,
            )}
          </ul>
        </div>
      ) : null}
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-medium">Univers</h3>
        <ul className="flex flex-wrap gap-2 text-xs">
          {Object.entries(s.universeCounts).map(([id, n]) => (
            <li key={id} className="rounded-lg border border-border px-2 py-1">
              {id} · {n}
            </li>
          ))}
          {!Object.keys(s.universeCounts).length && (
            <li className="text-muted-foreground">Aucun univers thématique assigné</li>
          )}
        </ul>
      </div>
    </div>
  )
}

function GapsCard({ blueprint }: { blueprint: BookBlueprintV1 }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-base font-semibold">Capacités manquantes</h2>
      {blueprint.capabilityGaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun gap détecté.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {blueprint.capabilityGaps.map((g, i) => (
            <li key={`${g.family}-${g.archetypeId ?? i}`} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    g.priority === "HIGH"
                      ? "bg-rose-100 text-rose-800"
                      : g.priority === "MEDIUM"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-stone-100 text-stone-700",
                  )}
                >
                  Priorité {g.priority === "HIGH" ? "haute" : g.priority === "MEDIUM" ? "moyenne" : "basse"}
                </span>
                <span className="font-medium">{g.label}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {g.pagesNeeded} pages prévues · {g.ready} READY · gap {g.gap}
              </p>
              <p className="mt-1 text-sm">{g.recommendation}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Données : {g.availableData.join(" · ") || "—"} · tags : {g.mechanicTags.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: ImplementationStatus }) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        STATUS_STYLE[status],
      )}
    >
      {status}
    </span>
  )
}

function familyLabel(family: PageFamily): string {
  const map: Record<PageFamily, string> = {
    OPENING: "Ouverture",
    THEME_GAME: "Jeu thématique",
    PERSONAL_GAME: "Jeu / page personnelle",
    MEMORY: "Souvenir",
    PHOTO: "Photo",
    PERSONAL_EDITORIAL: "Page personnelle",
    QUICK_GAME: "Jeu rapide",
    BREATHER: "Respiration",
    CORRECTION: "Correction",
    CLOSING: "Clôture",
  }
  return map[family]
}
