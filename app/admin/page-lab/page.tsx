import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { PageLabClient } from "@/components/admin/page-lab/page-lab-client"
import { getActivePalettes, getRenderableAssetsWithSvg } from "@/lib/data/assets"
import { getStyles, getTemplates, getUniverses } from "@/lib/data/reference"
import { resolveLabTemplates } from "@/lib/book-renderer/templates"
import { isGameEngineId } from "@/lib/game-engines/registry"

export const metadata: Metadata = {
  title: "Page Lab",
}

export default async function AdminPageLabPage() {
  const [styles, universes, palettes, assets, dbTemplates] = await Promise.all([
    getStyles(),
    getUniverses(),
    getActivePalettes(),
    getRenderableAssetsWithSvg(),
    getTemplates(),
  ])

  // Active Supabase catalogue ∩ local renderer registry ∩ registered engines.
  const templates = resolveLabTemplates(dbTemplates).filter((t) => isGameEngineId(t.engineId))

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Page Lab"
        description="Laboratoire de rendu : testez le moteur graphique d'une page de cahier en combinant template, style, palette et univers."
      />
      <PageLabClient
        templates={templates}
        styles={styles}
        universes={universes}
        palettes={palettes}
        assets={assets}
      />
    </div>
  )
}
