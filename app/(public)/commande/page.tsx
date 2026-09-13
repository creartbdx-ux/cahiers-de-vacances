import type { Metadata } from 'next'
import { PageIntro } from '@/components/public/page-intro'

export const metadata: Metadata = {
  title: 'Commande',
}

export default function CommandePage() {
  return (
    <PageIntro
      eyebrow="Étape 4"
      title="Commande"
      description="Dernière étape du parcours : vous finaliserez ici votre commande pour recevoir votre cahier personnalisé."
    />
  )
}
