import type { Metadata } from "next"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import {
  isInactiveByUpdatedAt,
  matchesAdminFilter,
  parseQuestionnairePayload,
  projectDisplayTitle,
  questionnaireProgressPercent,
  statusLabelFr,
  type AdminProjectFilter,
} from "@/lib/books/lifecycle"
import { getBookProjects } from "@/lib/data/books"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Questionnaires",
}

const FILTERS: { id: AdminProjectFilter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "in_progress", label: "En cours" },
  { id: "completed", label: "Terminés" },
  { id: "inactive", label: "Inactifs" },
]

export default async function AdminQuestionnairesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const params = await searchParams
  const filter = (FILTERS.some((f) => f.id === params.filter)
    ? params.filter
    : "all") as AdminProjectFilter

  const projects = await getBookProjects()
  const now = Date.now()
  const rows = projects.filter((p) => matchesAdminFilter(filter, p.status, p.updated_at, now))

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Questionnaires"
        description="Suivi des projets utilisateurs : brouillons, questionnaires en cours et terminés. Lecture seule."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "all" ? "/admin/questionnaires" : `/admin/questionnaires?filter=${f.id}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aucun projet pour ce filtre.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Participants</th>
                <th className="px-4 py-3 font-medium">Audience</th>
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Créé</th>
                <th className="px-4 py-3 font-medium">Activité</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Progression</th>
                <th className="px-4 py-3 font-medium">Richesse</th>
                <th className="px-4 py-3 font-medium">Style</th>
                <th className="px-4 py-3 font-medium">Palette</th>
                <th className="px-4 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((project) => {
                const { questionnaire, profile, richnessLevel, ownerEmail } =
                  parseQuestionnairePayload(project.questionnaire_data)
                const richness =
                  richnessLevel ??
                  (questionnaire
                    ? calculateProfileRichness(questionnaire, profile ?? undefined).level
                    : null)
                const title = projectDisplayTitle(
                  questionnaire,
                  profile,
                  project.recipient_first_name,
                )
                const inactive =
                  isInactiveByUpdatedAt(project.updated_at, now) &&
                  project.status !== "QUESTIONNAIRE_COMPLETED"
                return (
                  <tr key={project.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{title}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {questionnaire?.audience ?? profile?.audience ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ownerEmail ??
                        (project.user_id ? `${project.user_id.slice(0, 8)}…` : "—")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(project.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(project.updated_at).toLocaleDateString("fr-FR")}
                      {inactive ? " · inactif" : ""}
                    </td>
                    <td className="px-4 py-3 text-xs">{statusLabelFr(project.status)}</td>
                    <td className="px-4 py-3">{questionnaireProgressPercent(questionnaire)}%</td>
                    <td className="px-4 py-3 font-mono text-xs">{richness ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{project.style_id ?? "AUTO"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{project.palette_id ?? "AUTO"}</td>
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
