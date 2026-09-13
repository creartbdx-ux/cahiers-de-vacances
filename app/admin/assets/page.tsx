import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AssetsLibrary } from "@/components/admin/assets/assets-library"
import { Button } from "@/components/ui/button"
import { getAssetsWithSvg } from "@/lib/data/assets"
import { getStyles, getUniverses } from "@/lib/data/reference"

export const metadata: Metadata = {
  title: "Assets",
}

function StatChip({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card px-4 py-3">
      <span className={`font-serif text-2xl font-semibold ${className ?? "text-foreground"}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export default async function AdminAssetsPage() {
  const [items, universes, styles] = await Promise.all([getAssetsWithSvg(), getUniverses(), getStyles()])
  const assets = items.map((i) => i.asset)

  const total = assets.length
  const validated = assets.filter((a) => a.status === "VALIDATED").length
  const draft = assets.filter((a) => a.status === "DRAFT").length
  const rejected = assets.filter((a) => a.status === "REJECTED").length

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Assets"
        description="Bibliothèque d'illustrations SVG utilisées par le moteur de génération des cahiers."
        actions={
          <Button render={<Link href="/admin/assets/new" />}>
            <Plus />
            Ajouter un asset
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Assets au total" value={total} />
        <StatChip label="Validés" value={validated} className="text-chart-4" />
        <StatChip label="Brouillons" value={draft} className="text-foreground" />
        <StatChip label="Rejetés" value={rejected} className="text-destructive" />
      </div>

      <AssetsLibrary items={items} universes={universes} styles={styles} />
    </div>
  )
}
