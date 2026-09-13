import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { getBookPhotos, getBookProject } from "@/lib/data/books"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"
import type { BookProfileV1, QuestionnaireV1 } from "@/lib/questionnaire/types"

export const metadata: Metadata = {
  title: "Détail questionnaire",
}

function parsePayload(data: Record<string, unknown>): {
  questionnaire: QuestionnaireV1 | null
  profile: BookProfileV1 | null
} {
  const questionnaire =
    data.questionnaire && typeof data.questionnaire === "object"
      ? (data.questionnaire as QuestionnaireV1)
      : data.schemaVersion === 1
        ? (data as unknown as QuestionnaireV1)
        : null
  const profile =
    data.bookProfile && typeof data.bookProfile === "object"
      ? (data.bookProfile as BookProfileV1)
      : null
  return { questionnaire, profile }
}

export default async function AdminQuestionnaireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getBookProject(id)
  if (!project) notFound()

  const photos = await getBookPhotos(project.id)
  const { questionnaire, profile } = parsePayload(project.questionnaire_data)
  const richness = questionnaire ? calculateProfileRichness(questionnaire, profile ?? undefined) : null

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Questionnaire"
        description={`Projet ${project.id}`}
        actions={
          <Link href="/admin/questionnaires" className="text-sm underline underline-offset-4">
            Retour à la liste
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Statut" value={project.status} />
        <Meta label="Style" value={project.style_id ?? "AUTO"} />
        <Meta label="Palette" value={project.palette_id ?? "AUTO"} />
        <Meta label="Richesse" value={richness?.level ?? "—"} />
      </div>

      {richness && (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm">{richness.message}</p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Questionnaire brut</h2>
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-muted/50 p-4 text-xs">
          {JSON.stringify(questionnaire ?? project.questionnaire_data, null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">BookProfileV1</h2>
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-muted/50 p-4 text-xs">
          {profile ? JSON.stringify(profile, null, 2) : "— profil non stocké —"}
        </pre>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Photos ({photos.length})</h2>
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune photo.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {photos.map((p) => (
              <li key={p.id} className="font-mono text-xs">
                {p.storage_path}
                {p.caption ? ` — ${p.caption}` : ""}
                {p.use_authorized ? " · autorisée" : " · non autorisée"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  )
}
