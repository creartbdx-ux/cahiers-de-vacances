import type { Metadata } from 'next'
import { AdminPlaceholder } from '@/components/admin/admin-placeholder'

export const metadata: Metadata = {
  title: 'Questionnaires',
}

export default function AdminQuestionnairesPage() {
  return (
    <AdminPlaceholder
      title="Questionnaires"
      description="Configurez les questions qui orientent la personnalisation des cahiers."
    />
  )
}
