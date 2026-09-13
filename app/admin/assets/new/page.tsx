import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AssetForm } from "@/components/admin/assets/asset-form"
import { getStyles, getUniverses } from "@/lib/data/reference"

export const metadata: Metadata = {
  title: "Ajouter un asset",
}

export default async function NewAssetPage() {
  const [universes, styles] = await Promise.all([getUniverses(), getStyles()])

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
        <AdminPageHeader
          title="Ajouter un asset"
          description="Importez un SVG maître. Il sera analysé puis conservé en brouillon jusqu'à validation."
        />
      </div>
      <AssetForm universes={universes} styles={styles} />
    </div>
  )
}
