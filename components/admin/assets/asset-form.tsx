"use client"

import { useActionState, useState } from "react"
import { UploadCloud } from "lucide-react"
import { createAsset, type CreateAssetState } from "@/app/admin/assets/actions"
import { AnalysisReport } from "@/components/admin/assets/analysis-report"
import { SvgFrame } from "@/components/admin/assets/svg-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { analyzeSvg, type SvgAnalysis } from "@/lib/svg/analyze"
import { COLOR_SLOTS, SLOT_LABELS, TECHNICAL_COLORS } from "@/lib/svg/colors"
import { ASSET_TYPE_LABELS } from "@/lib/svg/labels"
import { sanitizeSvg } from "@/lib/svg/transform"
import type { AssetType, Style, Universe } from "@/lib/supabase/types"

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function AssetForm({ universes, styles }: { universes: Universe[]; styles: Style[] }) {
  const [state, formAction, isPending] = useActionState<CreateAssetState, FormData>(createAsset, null)
  const [recolorable, setRecolorable] = useState(true)
  const [preview, setPreview] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<SvgAnalysis | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(file: File | null) {
    if (!file) {
      setPreview(null)
      setAnalysis(null)
      setFileName(null)
      return
    }
    setFileName(file.name)
    const text = await file.text()
    setPreview(sanitizeSvg(text))
    setAnalysis(analyzeSvg(text, recolorable))
  }

  function reanalyze(nextRecolorable: boolean) {
    setRecolorable(nextRecolorable)
    if (preview !== null) setAnalysis(analyzeSvg(preview, nextRecolorable))
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="id">Identifiant</Label>
            <Input id="id" name="id" placeholder="montagne" required />
            <p className="text-xs text-muted-foreground">Lettres, chiffres, tirets et underscores.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" placeholder="Montagne" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="universe_id">Univers</Label>
            <select id="universe_id" name="universe_id" className={SELECT_CLASS} defaultValue="">
              <option value="">Aucun</option>
              {universes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="style_id">Style graphique</Label>
            <select id="style_id" name="style_id" className={SELECT_CLASS} defaultValue="">
              <option value="">Aucun</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset_type">Type d&apos;asset</Label>
            <select id="asset_type" name="asset_type" className={SELECT_CLASS} defaultValue="ICON">
              {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Priorité (1 à 5)</Label>
            <select id="priority" name="priority" className={SELECT_CLASS} defaultValue="3">
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="recolorable"
              checked={recolorable}
              onChange={(e) => reanalyze(e.target.checked)}
              className="size-4 accent-primary"
            />
            Recolorable
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" name="active" defaultChecked className="size-4 accent-primary" />
            Actif
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="file">Fichier SVG</Label>
          <label
            htmlFor="file"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50"
          >
            <UploadCloud className="size-6" />
            <span>{fileName ?? "Cliquez pour choisir un fichier .svg"}</span>
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".svg,image/svg+xml"
            required
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Convention de couleurs (SVG recolorables)
          </p>
          <div className="flex flex-wrap gap-2">
            {COLOR_SLOTS.map((slot) => (
              <span key={slot} className="inline-flex items-center gap-1.5 text-xs text-foreground">
                <span
                  className="size-3.5 rounded-full border border-border"
                  style={{ backgroundColor: TECHNICAL_COLORS[slot] }}
                />
                {slot} · {TECHNICAL_COLORS[slot]} · {SLOT_LABELS[slot]}
              </span>
            ))}
          </div>
        </div>

        {state?.error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Envoi…" : "Créer l'asset (brouillon)"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Tout nouvel asset est créé en <span className="font-medium">brouillon</span> et doit être validé.
          </p>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="aspect-square overflow-hidden rounded-xl border border-border bg-card p-6">
          <SvgFrame svg={preview} className="h-full w-full" checker label="Aperçu du fichier choisi" />
        </div>
        {analysis && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Contrôle technique</p>
            <AnalysisReport analysis={analysis} />
          </div>
        )}
      </aside>
    </form>
  )
}
