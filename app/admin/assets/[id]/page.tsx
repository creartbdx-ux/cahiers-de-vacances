import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AnalysisReport } from "@/components/admin/assets/analysis-report"
import { AssetActions } from "@/components/admin/assets/asset-actions"
import { PalettePreview } from "@/components/admin/assets/palette-preview"
import { StatusBadge } from "@/components/admin/assets/status-badge"
import { SvgFrame } from "@/components/admin/assets/svg-frame"
import { getActivePalettes, getAssetById, getAssetSvgRaw } from "@/lib/data/assets"
import { getStyles, getUniverses } from "@/lib/data/reference"
import { analyzeSvg } from "@/lib/svg/analyze"
import { ASSET_TYPE_LABELS } from "@/lib/svg/labels"
import { sanitizeSvg } from "@/lib/svg/transform"

export const metadata: Metadata = {
  title: "Détail de l'asset",
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const asset = await getAssetById(id)
  if (!asset) notFound()

  const raw = await getAssetSvgRaw(asset.svg_storage_path)
  const sanitized = raw ? sanitizeSvg(raw) : null
  const analysis = analyzeSvg(raw ?? "", asset.recolorable)

  const [universes, styles, palettes] = await Promise.all([
    getUniverses(),
    getStyles(),
    getActivePalettes(),
  ])
  const universeName = universes.find((u) => u.id === asset.universe_id)?.name ?? "—"
  const styleName = styles.find((s) => s.id === asset.style_id)?.name ?? "—"

  const info: { label: string; value: string }[] = [
    { label: "Identifiant", value: asset.id },
    { label: "Type", value: ASSET_TYPE_LABELS[asset.asset_type] },
    { label: "Univers", value: universeName },
    { label: "Style", value: styleName },
    { label: "Priorité", value: String(asset.priority) },
    { label: "Recolorable", value: asset.recolorable ? "Oui" : "Non" },
    { label: "Actif", value: asset.active ? "Oui" : "Non" },
    { label: "Créé le", value: formatDate(asset.created_at) },
    { label: "Validé le", value: formatDate(asset.validated_at) },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/assets"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour à la bibliothèque
        </Link>
        <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">{asset.name}</h1>
            <StatusBadge status={asset.status} />
            {!asset.active && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactif</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="flex flex-col gap-4">
          <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-card p-8">
            <SvgFrame svg={sanitized} className="h-full w-full" checker label={asset.name} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-border bg-card p-4">
            {info.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">Contrôle technique</h2>
            <AnalysisReport analysis={analysis} />
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">Validation humaine</h2>
            <AssetActions asset={asset} canValidate={analysis.canValidate} />
          </section>
        </div>
      </div>

      {asset.recolorable && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground">Aperçu des palettes</h2>
            <p className="text-sm text-muted-foreground">
              Le même SVG maître recoloré à la volée avec chaque palette active.
            </p>
          </div>
          <PalettePreview svg={sanitized} palettes={palettes} />
        </section>
      )}
    </div>
  )
}
