import type { Metadata } from 'next'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { getStyles } from '@/lib/data/reference'
import type { Style } from '@/lib/supabase/types'

export const metadata: Metadata = {
  title: 'Styles graphiques',
}

const DENSITY_LABELS: Record<string, string> = {
  low: 'Décor léger',
  medium: 'Décor modéré',
  high: 'Décor riche',
}

function StyleCard({ style }: { style: Style }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-foreground">{style.name}</h2>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {style.id}
        </span>
      </div>
      {style.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">{style.description}</p>
      )}
      {style.decor_density && (
        <span className="mt-auto w-fit rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground">
          {DENSITY_LABELS[style.decor_density] ?? style.decor_density}
        </span>
      )}
    </article>
  )
}

export default async function AdminStylesPage() {
  const styles = await getStyles()

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Styles graphiques"
        description="Gérez les directions artistiques appliquées aux cahiers générés."
        actions={
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            {styles.length} style{styles.length > 1 ? 's' : ''}
          </span>
        }
      />
      {styles.length === 0 ? (
        <p className="text-muted-foreground">Aucun style pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {styles.map((style) => (
            <StyleCard key={style.id} style={style} />
          ))}
        </div>
      )}
    </div>
  )
}
