import type { Metadata } from 'next'
import { PageIntro } from '@/components/public/page-intro'

export const metadata: Metadata = {
  title: 'Questionnaire',
}

export default function QuestionnairePage() {
  return (
    <PageIntro
      eyebrow="Étape 2"
      title="Questionnaire"
      description="Bientôt, quelques questions bien pensées permettront d'adapter le contenu et le ton de votre cahier à vos envies."
    />
  )
}
