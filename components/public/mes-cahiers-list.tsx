"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { deleteBookProjectAction } from "@/app/(public)/questionnaire/actions"
import { Button } from "@/components/ui/button"
import {
  isQuestionnaireCompleted,
  isQuestionnaireInProgress,
  statusLabelFr,
} from "@/lib/books/lifecycle"

export type MesCahiersItem = {
  id: string
  title: string
  audience: string
  status: string
  createdAt: string
  updatedAt: string
  progress: number
  richness: string | null
}

export function MesCahiersList({ projects }: { projects: MesCahiersItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">Vous n&apos;avez pas encore de cahier.</p>
        <Button render={<Link href="/creer" />} nativeButton={false} className="mt-4 rounded-full">
          Créer mon cahier
        </Button>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {projects.map((p) => (
        <li key={p.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.audience} · {statusLabelFr(p.status)}
                {p.richness ? ` · ${p.richness}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Créé le {new Date(p.createdAt).toLocaleDateString("fr-FR")} · Modifié le{" "}
                {new Date(p.updatedAt).toLocaleDateString("fr-FR")}
              </p>
              {isQuestionnaireInProgress(p.status) && (
                <p className="mt-2 text-sm">Progression questionnaire : {p.progress}%</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isQuestionnaireInProgress(p.status) && (
                <Button
                  render={<Link href={`/questionnaire?project=${p.id}`} />}
                  nativeButton={false}
                  size="sm"
                >
                  Continuer
                </Button>
              )}
              {isQuestionnaireCompleted(p.status) && (
                <Button
                  render={<Link href={`/questionnaire?project=${p.id}`} />}
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                >
                  Voir
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                className="text-destructive"
                onClick={() => {
                  if (!confirm("Supprimer ce cahier ? Cette action est définitive.")) return
                  startTransition(async () => {
                    const result = await deleteBookProjectAction(p.id)
                    if (result.ok) router.refresh()
                  })
                }}
              >
                Supprimer
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
