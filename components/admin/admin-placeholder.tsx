import { AdminPageHeader } from '@/components/admin/admin-page-header'

type AdminPlaceholderProps = {
  title: string
  description: string
  note?: string
}

export function AdminPlaceholder({
  title,
  description,
  note = 'Ce module sera construit dans une prochaine étape.',
}: AdminPlaceholderProps) {
  return (
    <div className="space-y-8">
      <AdminPageHeader title={title} description={description} />
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">{note}</p>
      </div>
    </div>
  )
}
