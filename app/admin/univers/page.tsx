import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { UniverseEditorialEditor } from "@/components/admin/univers/universe-editorial-editor"
import { getUniverses } from "@/lib/data/reference"

export const metadata: Metadata = {
  title: "Univers",
}

export default async function AdminUniversPage() {
  const universes = await getUniverses()

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Univers"
        description="Cadre éditorial des thèmes : description, sujets autorisés / exclus et guidance quiz. Source de vérité pour QUIZ_THEME."
        actions={
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            {universes.length} univers
          </span>
        }
      />
      {universes.length === 0 ? (
        <p className="text-muted-foreground">Aucun univers pour le moment.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {universes.map((universe) => (
            <UniverseEditorialEditor key={universe.id} universe={universe} />
          ))}
        </div>
      )}
    </div>
  )
}
