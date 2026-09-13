import type { Metadata } from "next"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { getBookProjects } from "@/lib/data/books"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"
import type { QuestionnaireV1 } from "@/lib/questionnaire/types"

export const metadata: Metadata = {
  title: "Questionnaires",
}

function asQuestionnaire(data: Record<string, unknown>): QuestionnaireV1 | null {
  const nested = data.questionnaire
  if (nested && typeof nested === "object") return nested as QuestionnaireV1
  if (data.schemaVersion === 1) return data as unknown as QuestionnaireV1
  return null
}

export default async function AdminQuestionnairesPage() {
  const projects = await getBookProjects()
  const rows = projects.filter(
    (p) =>
      p.status === "QUESTIONNAIRE_COMPLETED" ||
      p.status === "DRAFT" ||
      Boolean(p.questionnaire_data && Object.keys(p.questionnaire_data).length > 0),
  )

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Questionnaires"
        description="Projets issus du questionnaire public. Lecture seule — aucune génération ici."
      />

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aucun questionnaire enregistré pour le moment.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Audience</th>
                <th className="px-4 py-3 font-medium">Participants</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Style</th>
                <th className="px-4 py-3 font-medium">Palette</th>
                <th className="px-4 py-3 font-medium">Richesse</th>
                <th className="px-4 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((project) => {
                const q = asQuestionnaire(project.questionnaire_data)
                const richness = q ? calculateProfileRichness(q) : null
                const names =
                  q?.participants.map((p) => p.firstName).filter(Boolean).join(", ") ||
                  project.recipient_first_name ||
                  "—"
                return (
                  <tr key={project.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{q?.audience ?? "—"}</td>
                    <td className="px-4 py-3">{names}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(project.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{project.status}</td>
                    <td className="px-4 py-3 font-mono text-xs">{project.style_id ?? "AUTO"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{project.palette_id ?? "AUTO"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{richness?.level ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/questionnaires/${project.id}`}
                        className="text-sm font-medium underline underline-offset-4"
                      >
                        Détail
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
