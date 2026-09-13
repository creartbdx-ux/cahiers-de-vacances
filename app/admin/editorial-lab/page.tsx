import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import {
  EditorialLabClient,
  type EditorialLabProject,
} from "@/components/admin/editorial-lab/editorial-lab-client"
import { canUseInEditorialLab, parseQuestionnairePayload } from "@/lib/books/lifecycle"
import { getCompletedBookProjects } from "@/lib/data/books"
import { getGames, getUniverses } from "@/lib/data/reference"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"

export const metadata: Metadata = {
  title: "Editorial Lab",
}

export default async function AdminEditorialLabPage() {
  const [projects, games, universes] = await Promise.all([
    getCompletedBookProjects(),
    getGames(),
    getUniverses(),
  ])

  const labProjects: EditorialLabProject[] = []
  for (const project of projects) {
    const { profile, questionnaire, richnessLevel } = parseQuestionnairePayload(
      project.questionnaire_data,
    )
    let level = richnessLevel
    if (!level && questionnaire) {
      level = calculateProfileRichness(questionnaire, profile ?? undefined).level
    }
    if (!canUseInEditorialLab({ status: project.status, profile, richnessLevel: level })) {
      continue
    }
    const names = profile!.participants.map((p) => p.firstName).filter(Boolean).join(", ")
    const date = new Date(project.updated_at).toLocaleDateString("fr-FR")
    labProjects.push({
      id: project.id,
      label: `${names || "Sans prénom"} — ${profile!.audience} · ${level} · ${date}`,
      status: project.status,
      richnessLevel: level!,
      profile: profile!,
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Editorial Lab"
        description="Uniquement les projets QUESTIONNAIRE_COMPLETED avec BookProfile valide. Aucune génération de contenu ni d'IA."
      />
      <EditorialLabClient projects={labProjects} games={games} universes={universes} />
    </div>
  )
}
