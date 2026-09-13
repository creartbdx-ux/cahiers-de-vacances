import type { Metadata } from 'next'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { getUniverses } from '@/lib/data/reference'

export const metadata: Metadata = {
  title: 'Univers',
}

export default async function AdminUniversPage() {
  const universes = await getUniverses()

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Univers"
        description="Définissez les thèmes et ambiances proposés aux utilisateurs lors de la création."
        actions={
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            {universes.length} univers
          </span>
        }
      />
      {universes.length === 0 ? (
        <p className="text-muted-foreground">Aucun univers pour le moment.</p>
      ) : (
        <ul className="flex flex-wrap gap-2.5">
          {universes.map((universe) => (
            <li
              key={universe.id}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-4 pr-2 text-sm text-foreground"
            >
              <span
                className={`size-2 rounded-full ${universe.active ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                aria-hidden
              />
              {universe.name}
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {universe.id}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
