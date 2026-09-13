import type { Metadata } from "next"
import { PageIntro } from "@/components/public/page-intro"
import { QuestionnaireWizard } from "@/components/questionnaire/questionnaire-wizard"
import { getCurrentUser } from "@/lib/auth"
import { getActivePalettes } from "@/lib/data/assets"
import { getActiveStyles, getActiveUniverses } from "@/lib/data/reference"

export const metadata: Metadata = {
  title: "Questionnaire",
}

export default async function QuestionnairePage() {
  const [{ user }, universes, palettes, styles] = await Promise.all([
    getCurrentUser(),
    getActiveUniverses(),
    getActivePalettes(),
    getActiveStyles(),
  ])

  return (
    <PageIntro
      eyebrow="Étape 2"
      title="Questionnaire"
      description="Quelques minutes suffisent pour créer un cahier qui vous ressemble. Plus vous nous en dites, plus il sera personnel."
    >
      <QuestionnaireWizard
        universes={universes}
        palettes={palettes}
        styles={styles}
        isAuthenticated={Boolean(user)}
      />
    </PageIntro>
  )
}
