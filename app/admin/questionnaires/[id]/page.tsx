import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import {
  canUseInEditorialLab,
  parseQuestionnairePayload,
  statusLabelFr,
} from "@/lib/books/lifecycle"
import { getBookPhotos, getBookProject } from "@/lib/data/books"
import { calculateProfileRichness } from "@/lib/questionnaire/richness"

export const metadata: Metadata = {
  title: "Détail questionnaire",
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
  const { questionnaire, profile, richnessLevel, ownerEmail } = parseQuestionnairePayload(
    project.questionnaire_data,
  )
  const richness =
    richnessLevel != null && questionnaire
      ? { level: richnessLevel, message: "" }
      : questionnaire
        ? calculateProfileRichness(questionnaire, profile ?? undefined)
        : null
  const editorialOk = canUseInEditorialLab({
    status: project.status,
    profile,
    richnessLevel: richness?.level ?? null,
  })

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Meta label="Statut" value={statusLabelFr(project.status)} />
        <Meta label="Utilisateur" value={ownerEmail ?? project.user_id?.slice(0, 8) ?? "—"} />
        <Meta
          label="Éligible Editorial Lab"
          value={editorialOk ? "Oui" : "Non"}
        />
        <Meta label="Créé le" value={new Date(project.created_at).toLocaleString("fr-FR")} />
        <Meta
          label="Dernière modification"
          value={new Date(project.updated_at).toLocaleString("fr-FR")}
        />
        <Meta label="Richesse" value={richness?.level ?? "—"} />
        <Meta label="Style" value={project.style_id ?? "AUTO"} />
        <Meta label="Palette" value={project.palette_id ?? "AUTO"} />
      </div>

      {richness && "message" in richness && richness.message ? (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm">{richness.message}</p>
      ) : null}

      {editorialOk && (
        <p className="text-sm">
          <Link
            href="/admin/editorial-lab"
            className="underline underline-offset-4"
          >
            Ouvrir l&apos;Editorial Lab
          </Link>
        </p>
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
          {profile ? JSON.stringify(profile, null, 2) : "— profil non stocké (brouillon) —"}
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
