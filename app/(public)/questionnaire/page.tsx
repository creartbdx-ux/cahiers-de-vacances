import type { Metadata } from "next"
import { PageIntro } from "@/components/public/page-intro"
import { QuestionnaireWizard } from "@/components/questionnaire/questionnaire-wizard"
import { getCurrentUser } from "@/lib/auth"
import { isQuestionnaireCompleted, parseQuestionnairePayload } from "@/lib/books/lifecycle"
import {
  createBookPhotoSignedUrls,
  getBookPhotos,
  getBookProject,
} from "@/lib/data/books"
import { getActivePalettes } from "@/lib/data/assets"
import { getActiveStyles, getActiveUniverses } from "@/lib/data/reference"
import { mergeBookPhotosIntoQuestionnaire } from "@/lib/questionnaire/photos"
import { createEmptyQuestionnaire, type QuestionnaireV1 } from "@/lib/questionnaire/types"

export const metadata: Metadata = {
  title: "Questionnaire",
}

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; claim?: string }>
}) {
  const params = await searchParams
  const [{ user }, universes, palettes, styles] = await Promise.all([
    getCurrentUser(),
    getActiveUniverses(),
    getActivePalettes(),
    getActiveStyles(),
  ])

  let initialQuestionnaire: QuestionnaireV1 | null = null
  let projectStatus: string | null = null

  if (params.project && user) {
    const project = await getBookProject(params.project)
    if (project && project.user_id === user.id) {
      const parsed = parseQuestionnairePayload(project.questionnaire_data)
      const base: QuestionnaireV1 = {
        ...(parsed.questionnaire ?? createEmptyQuestionnaire()),
        draftProjectId: project.id,
      }
      const rows = await getBookPhotos(project.id)
      const signedUrls = await createBookPhotoSignedUrls(rows.map((r) => r.storage_path))
      initialQuestionnaire = mergeBookPhotosIntoQuestionnaire(base, rows, signedUrls)
      projectStatus = project.status
    }
  }

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
        initialQuestionnaire={initialQuestionnaire}
        projectStatus={projectStatus}
        claimLocalDraft={params.claim === "1" && !params.project}
        readOnly={projectStatus ? isQuestionnaireCompleted(projectStatus) : false}
      />
    </PageIntro>
  )
}
