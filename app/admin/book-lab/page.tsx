import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { BookLabClient, type BookLabProject } from "@/components/admin/book-lab/book-lab-client"
import { canUseInEditorialLab, parseQuestionnairePayload } from "@/lib/books/lifecycle"
import { getActivePalettes } from "@/lib/data/assets"
import { getCompletedBookProjects } from "@/lib/data/books"
import { getStyles } from "@/lib/data/reference"
import { isContentGenerationConfigured } from "@/lib/content-generation/provider"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"

export const metadata: Metadata = {
  title: "Book Lab",
}

export default async function AdminBookLabPage() {
  const [projects, palettes, styles] = await Promise.all([
    getCompletedBookProjects(),
    getActivePalettes(),
    getStyles(),
  ])

  const labProjects: BookLabProject[] = []
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
        title="Book Lab"
        description="Mini-cahier 8 pages : couverture, 3 jeux thématiques, corrections. Sans persistence ni PDF."
      />
      <BookLabClient
        projects={labProjects}
        palettes={palettes}
        styles={styles}
        aiConfigured={isContentGenerationConfigured()}
      />
    </div>
  )
}
