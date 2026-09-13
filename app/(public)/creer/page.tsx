import type { Metadata } from 'next'
import { PageIntro } from '@/components/public/page-intro'

export const metadata: Metadata = {
  title: 'Créer mon cahier',
}

export default function CreerPage() {
  return (
    <PageIntro
      eyebrow="Étape 1"
      title="Créer mon cahier"
      description="Point de départ de votre cahier sur mesure. C'est ici que vous lancerez la composition avant de passer au questionnaire."
    />
  )
}
