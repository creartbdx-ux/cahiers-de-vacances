import type { Metadata } from 'next'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { getPalettes } from '@/lib/data/reference'
import type { Palette } from '@/lib/supabase/types'

export const metadata: Metadata = {
  title: 'Palettes',
}

const SWATCHES: { key: keyof Palette; label: string }[] = [
  { key: 'primary_color', label: 'Principale' },
  { key: 'secondary_color', label: 'Secondaire' },
  { key: 'accent_color', label: 'Accent' },
  { key: 'background_color', label: 'Fond' },
  { key: 'text_color', label: 'Texte' },
]

function PaletteCard({ palette }: { palette: Palette }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex h-24">
        {SWATCHES.map(({ key }) => (
          <div key={key} className="flex-1" style={{ backgroundColor: palette[key] as string }} />
        ))}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold text-foreground">{palette.name}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {palette.id}
          </span>
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {SWATCHES.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: palette[key] as string }}
              />
              <dt className="sr-only">{label}</dt>
              <dd className="font-mono uppercase">{palette[key] as string}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}

export default async function AdminPalettesPage() {
  const palettes = await getPalettes()

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Palettes"
        description="Composez et réutilisez les palettes de couleurs des cahiers."
        actions={
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            {palettes.length} palette{palettes.length > 1 ? 's' : ''}
          </span>
        }
      />
      {palettes.length === 0 ? (
        <p className="text-muted-foreground">Aucune palette pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {palettes.map((palette) => (
            <PaletteCard key={palette.id} palette={palette} />
          ))}
        </div>
      )}
    </div>
  )
}
