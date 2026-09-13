import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { MesCahiersList, type MesCahiersItem } from "@/components/public/mes-cahiers-list"
import { PageIntro } from "@/components/public/page-intro"
import { getCurrentUser } from "@/lib/auth"
import {
  parseQuestionnairePayload,
  projectDisplayTitle,
  questionnaireProgressPercent,
} from "@/lib/books/lifecycle"
import { getBookProjectsForUser } from "@/lib/data/books"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"

export const metadata: Metadata = {
  title: "Mes cahiers",
}

export default async function MesCahiersPage() {
  const { user } = await getCurrentUser()
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent("/mes-cahiers")}`)
  }

  const projects = await getBookProjectsForUser(user.id)
  const items: MesCahiersItem[] = projects.map((project) => {
    const { questionnaire, profile, richnessLevel } = parseQuestionnairePayload(
      project.questionnaire_data,
    )
    const richness =
      richnessLevel ??
      (questionnaire ? calculateProfileRichness(questionnaire, profile ?? undefined).level : null)
    return {
      id: project.id,
      title: projectDisplayTitle(questionnaire, profile, project.recipient_first_name),
      audience: questionnaire?.audience ?? profile?.audience ?? "—",
      status: project.status,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      progress: questionnaireProgressPercent(questionnaire),
      richness,
    }
  })

  return (
    <PageIntro
      eyebrow="Espace personnel"
      title="Mes cahiers"
      description="Retrouvez vos brouillons et questionnaires terminés. Continuez où vous vous êtes arrêté."
    >
      <div className="mb-6">
        <Link
          href="/creer"
          className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Nouveau cahier
        </Link>
      </div>
      <MesCahiersList projects={items} />
    </PageIntro>
  )
}
