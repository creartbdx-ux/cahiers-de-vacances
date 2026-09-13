import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { PageLabClient } from "@/components/admin/page-lab/page-lab-client"
import { getActivePalettes, getRenderableAssetsWithSvg } from "@/lib/data/assets"
import { getStyles, getUniverses } from "@/lib/data/reference"

export const metadata: Metadata = {
  title: "Page Lab",
}

export default async function AdminPageLabPage() {
  const [styles, universes, palettes, assets] = await Promise.all([
    getStyles(),
    getUniverses(),
    getActivePalettes(),
    getRenderableAssetsWithSvg(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Page Lab"
        description="Laboratoire de rendu : testez le moteur graphique d'une page de cahier en combinant template, style, palette et univers."
      />
      <PageLabClient styles={styles} universes={universes} palettes={palettes} assets={assets} />
    </div>
  )
}
