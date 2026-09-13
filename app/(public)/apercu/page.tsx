import type { Metadata } from 'next'
import { PageIntro } from '@/components/public/page-intro'

export const metadata: Metadata = {
  title: 'Aperçu du cahier',
}

export default function ApercuPage() {
  return (
    <PageIntro
      eyebrow="Étape 3"
      title="Aperçu du cahier"
      description="Vous visualiserez ici un rendu fidèle de votre cahier — univers, jeux et mise en page — avant de passer commande."
    />
  )
}
