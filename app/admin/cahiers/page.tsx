import type { Metadata } from 'next'
import { AdminPlaceholder } from '@/components/admin/admin-placeholder'

export const metadata: Metadata = {
  title: 'Cahiers',
}

export default function AdminCahiersPage() {
  return (
    <AdminPlaceholder
      title="Cahiers"
      description="Consultez et gérez les cahiers générés ainsi que leur statut de fabrication."
    />
  )
}
