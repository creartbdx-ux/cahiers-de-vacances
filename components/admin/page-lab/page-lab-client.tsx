"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Ruler, Bug, Plus, Trash2, Wand2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BookPage } from "@/components/book-renderer/book-page"
import { PagePreview } from "@/components/book-renderer/page-preview"
import {
  CrosswordTemplate,
  type RenderableAsset,
} from "@/components/book-renderer/templates/crossword-template"
import { getStyleTokens } from "@/lib/book-renderer/styles"
import { BOOK_TEMPLATES, CROSSWORD_01_SAMPLE, resolveTemplateEngine } from "@/lib/book-renderer/templates"
import { generateGame } from "@/lib/game-engines/registry"
import type { WithEngineMeta } from "@/lib/game-engines/types"
import type { CrosswordEntry, CrosswordResult } from "@/lib/game-engines/crossword/types"
import type { Palette, Style, Universe } from "@/lib/supabase/types"

/** The lab result carries the engine identity stamped by the registry. */
type LabResult = WithEngineMeta<CrosswordResult>

/** Quick-compare palette buttons -> palette ids seeded in Supabase. */
const QUICK_PALETTES: { label: string; id: string }[] = [
  { label: "Orange", id: "ORANGE" },
  { label: "Rose", id: "PINK" },
  { label: "Bleu", id: "BLUE" },
  { label: "Vert", id: "GREEN" },
]

const MAX_ASSETS = 3

/**
 * Local demo entries used ONLY to drive the lab. Nothing here is persisted to
 * Supabase — later these will come from the questionnaire, a thematic bank, or
 * the AI. A mountain-themed list with lots of shared letters so the engine has
 * plenty of crossing opportunities.
 */
const DEMO_ENTRIES: CrosswordEntry[] = [
  { answer: "MONTAGNE", clue: "Relief naturel que tu adores explorer." },
  { answer: "CHALET", clue: "Maison typique des séjours en altitude." },
  { answer: "SOMMET", clue: "Point culminant d'un relief." },
  { answer: "SENTIER", clue: "Chemin étroit de randonnée." },
  { answer: "GLACIER", clue: "Immense fleuve de glace." },
  { answer: "NEIGE", clue: "Manteau blanc des pentes." },
  { answer: "AIGLE", clue: "Rapace majestueux des cimes." },
  { answer: "VALLEE", clue: "Creux encaissé entre deux reliefs." },
  { answer: "REFUGE", clue: "Abri pour les marcheurs en altitude." },
  { answer: "TORRENT", clue: "Cours d'eau vif dévalant la pente." },
  { answer: "MARMOTTE", clue: "Petit rongeur siffleur des alpages." },
  { answer: "RANDONNEE", clue: "Longue marche sur les sentiers." },
]

export function PageLabClient({
  styles,
  universes,
  palettes,
  assets,
}: {
  styles: Style[]
  universes: Universe[]
  palettes: Palette[]
  assets: RenderableAsset[]
}) {
  const defaultPalette =
    palettes.find((p) => p.id === "ORANGE")?.id ?? palettes[0]?.id ?? ""

  const [templateId, setTemplateId] = useState(BOOK_TEMPLATES[0].id)
  const [styleId, setStyleId] = useState(styles.find((s) => s.id === "RETRO")?.id ?? styles[0]?.id ?? "")
  const [paletteId, setPaletteId] = useState(defaultPalette)
  const [universeId, setUniverseId] = useState(
    universes.find((u) => u.id === "MOUNTAIN")?.id ?? universes[0]?.id ?? "",
  )
  const [showSafeArea, setShowSafeArea] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  // Crossword lab state (local only, never persisted).
  const [entries, setEntries] = useState<CrosswordEntry[]>(DEMO_ENTRIES)
  const [seed, setSeed] = useState("montagne-01")
  const [result, setResult] = useState<LabResult | null>(null)
  const [mode, setMode] = useState<"game" | "solution">("game")

  // The template declares which technical engine renders it. Resolving through
  // the registry (never a hardcoded call) is what lets any game sharing the
  // engine reuse this template.
  const engineId = resolveTemplateEngine(templateId)
  const isCrossword = engineId === "CROSSWORD"

  const palette = useMemo(
    () => palettes.find((p) => p.id === paletteId) ?? palettes[0],
    [palettes, paletteId],
  )
  const styleTokens = useMemo(() => getStyleTokens(styleId), [styleId])

  // Assets are already VALIDATED + active (server). Filter by the selected
  // universe + style, favour highest priority, dedupe, cap at MAX_ASSETS.
  const selectedAssets = useMemo(() => {
    const seen = new Set<string>()
    return assets
      .filter((a) => a.asset.universe_id === universeId && a.asset.style_id === styleId)
      .sort((a, b) => b.asset.priority - a.asset.priority)
      .filter((a) => (seen.has(a.asset.id) ? false : (seen.add(a.asset.id), true)))
      .slice(0, MAX_ASSETS)
  }, [assets, universeId, styleId])

  function handleGenerate() {
    if (engineId !== "CROSSWORD") return
    setResult(generateGame("CROSSWORD", { entries, seed }))
  }

  const successResult = result?.success ? result : null

  if (!palette) {
    return <p className="text-muted-foreground">Aucune palette active disponible.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Selectors */}
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <LabSelect label="Template" value={templateId} onChange={(v) => setTemplateId(v as typeof templateId)}>
          {BOOK_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </LabSelect>
        <LabSelect label="Style graphique" value={styleId} onChange={setStyleId}>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </LabSelect>
        <LabSelect label="Palette" value={paletteId} onChange={setPaletteId}>
          {palettes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </LabSelect>
        <LabSelect label="Univers" value={universeId} onChange={setUniverseId}>
          {universes.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </LabSelect>
      </div>

      {/* Quick palette compare + admin toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Comparer :</span>
          {QUICK_PALETTES.map((q) => {
            const exists = palettes.some((p) => p.id === q.id)
            const active = paletteId === q.id
            return (
              <button
                key={q.id}
                type="button"
                disabled={!exists}
                onClick={() => setPaletteId(q.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                <QuickSwatch paletteId={q.id} palettes={palettes} />
                {q.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={showSafeArea ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSafeArea((v) => !v)}
          >
            <Ruler className="size-4" />
            Zone de sécurité
          </Button>
          <Button
            type="button"
            variant={showDebug ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDebug((v) => !v)}
          >
            <Bug className="size-4" />
            Debug
          </Button>
        </div>
      </div>

      {/* Crossword test panel */}
      {isCrossword && (
        <CrosswordPanel
          entries={entries}
          setEntries={setEntries}
          seed={seed}
          setSeed={setSeed}
          onGenerate={handleGenerate}
          result={result}
          mode={mode}
          setMode={setMode}
        />
      )}

      {showDebug && (
        <DebugPanel
          templateId={templateId}
          styleId={styleId}
          paletteId={paletteId}
          universeId={universeId}
          assets={selectedAssets}
          result={result}
        />
      )}

      {/* A4 preview */}
      <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-8">
        <PagePreview>
          <BookPage palette={palette} showSafeArea={showSafeArea}>
            <CrosswordTemplate
              sample={CROSSWORD_01_SAMPLE}
              style={styleTokens}
              palette={palette}
              assets={selectedAssets}
              crossword={successResult}
              mode={mode}
            />
          </BookPage>
        </PagePreview>
      </div>
    </div>
  )
}

function CrosswordPanel({
  entries,
  setEntries,
  seed,
  setSeed,
  onGenerate,
  result,
  mode,
  setMode,
}: {
  entries: CrosswordEntry[]
  setEntries: (updater: (prev: CrosswordEntry[]) => CrosswordEntry[]) => void
  seed: string
  setSeed: (v: string) => void
  onGenerate: () => void
  result: LabResult | null
  mode: "game" | "solution"
  setMode: (m: "game" | "solution") => void
}) {
  function updateEntry(index: number, patch: Partial<CrosswordEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }
  function addEntry() {
    setEntries((prev) => [...prev, { answer: "", clue: "" }])
  }
  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Test · Mots croisés</h2>
          <p className="text-sm text-muted-foreground">
            Réponses + définitions. Rien n&apos;est enregistré : le moteur génère la grille localement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* [ Jeu ] [ Correction ] — never recomputes the grid, only the view. */}
          <div className="inline-flex overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setMode("game")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "game" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
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
                  : "bg-background text-foreground hover:bg-muted",
              )}
            >
              Correction
            </button>
          </div>
        </div>
      </div>

      {/* Entries editor */}
      <div className="flex flex-col gap-2">
        <div className="hidden grid-cols-[minmax(0,180px)_1fr_auto] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Réponse</span>
          <span>Définition</span>
          <span className="sr-only">Actions</span>
        </div>
        {entries.map((entry, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,180px)_1fr_auto]">
            <input
              value={entry.answer}
              onChange={(e) => updateEntry(i, { answer: e.target.value })}
              placeholder="MONTAGNE"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={entry.clue}
              onChange={(e) => updateEntry(i, { clue: e.target.value })}
              placeholder="Définition de l'indice"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => removeEntry(i)}
              aria-label={`Supprimer l'entrée ${i + 1}`}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          <Plus className="size-4" />
          Ajouter une entrée
        </Button>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Seed</span>
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="h-9 w-40 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <Button type="button" size="sm" onClick={onGenerate}>
          <Wand2 className="size-4" />
          Générer la grille
        </Button>
        <span className="text-sm text-muted-foreground">{entries.length} entrée(s)</span>
      </div>

      {/* Failure message — never render a fake grid to hide it. */}
      {result && !result.success && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Génération impossible ({result.reason})</p>
            <p className="opacity-90">{result.message}</p>
            {result.unusedEntries.length > 0 && (
              <p className="mt-1 opacity-90">
                Non utilisés : {result.unusedEntries.map((e) => e.answer).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LabSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
    </label>
  )
}

function QuickSwatch({ paletteId, palettes }: { paletteId: string; palettes: Palette[] }) {
  const p = palettes.find((x) => x.id === paletteId)
  if (!p) return null
  return (
    <span className="flex size-4 overflow-hidden rounded-full border border-border">
      <span className="flex-1" style={{ backgroundColor: p.primary_color }} />
      <span className="flex-1" style={{ backgroundColor: p.accent_color }} />
    </span>
  )
}

function DebugPanel({
  templateId,
  styleId,
  paletteId,
  universeId,
  assets,
  result,
}: {
  templateId: string
  styleId: string
  paletteId: string
  universeId: string
  assets: RenderableAsset[]
  result: LabResult | null
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-5 font-mono text-xs text-foreground">
      <p className="mb-3 font-sans text-sm font-semibold text-muted-foreground">Debug admin</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <DebugRow label="template_id" value={templateId} />
        <DebugRow label="technical_engine" value={resolveTemplateEngine(templateId) ?? "—"} />
        <DebugRow label="style_id" value={styleId} />
        <DebugRow label="palette_id" value={paletteId} />
        <DebugRow label="universe_id" value={universeId} />
      </dl>

      {/* Crossword engine debug */}
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 font-sans text-sm font-medium text-muted-foreground">Moteur mots croisés</p>
        {!result ? (
          <p className="text-muted-foreground">— aucune génération lancée</p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2">
            <DebugRow label="engine_id" value={result.engineId} />
            <DebugRow label="engine_version" value={fmt(result.engineVersion)} />
            <DebugRow label="success" value={String(result.success)} />
            <DebugRow label="seed" value={result.stats.seed ?? "—"} />
            <DebugRow label="received" value={fmt(result.stats.received)} />
            <DebugRow label="placed" value={fmt(result.stats.placed)} />
            <DebugRow label="unused" value={fmt(result.stats.unused)} />
            <DebugRow
              label="dimensions"
              value={
                result.stats.width && result.stats.height
                  ? `${result.stats.width} × ${result.stats.height}`
                  : "—"
              }
            />
            <DebugRow label="crossings" value={fmt(result.stats.crossings)} />
            <DebugRow label="score" value={fmt(result.stats.score)} />
            <DebugRow label="candidates_tried" value={fmt(result.stats.candidatesTried)} />
            <DebugRow label="validation" value={result.success ? "OK" : (result.reason ?? "—")} />
          </dl>
        )}
        {result && result.unusedEntries.length > 0 && (
          <div className="mt-2">
            <p className="font-sans text-muted-foreground">mots non placés</p>
            <p className="mt-1">{result.unusedEntries.map((e) => e.answer).join(", ")}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="font-sans text-sm font-medium text-muted-foreground">
          asset_ids ({assets.length})
        </p>
        {assets.length === 0 ? (
          <p className="mt-1 text-muted-foreground">— aucun asset compatible</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {assets.map((a) => (
              <li key={a.asset.id} className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5">{a.asset.id}</span>
                <span className="text-muted-foreground">
                  slots: [{a.asset.color_slots.join(", ")}]
                </span>
                <span className="text-muted-foreground">
                  {a.asset.recolorable ? "recolorable" : "fixe"} · prio {a.asset.priority}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function fmt(value: number | undefined): string {
  return value === undefined ? "—" : String(value)
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="rounded bg-muted px-1.5 py-0.5">{value || "—"}</dd>
    </div>
  )
}
