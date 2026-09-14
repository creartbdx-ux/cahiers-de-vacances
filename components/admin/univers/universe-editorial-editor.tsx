"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import type { Universe } from "@/lib/supabase/types"
import {
  updateUniverseEditorialAction,
  type UpdateUniverseEditorialState,
} from "@/app/admin/univers/actions"

function topicsToText(topics: string[] | null | undefined): string {
  return (topics ?? []).join("\n")
}

export function UniverseEditorialEditor({ universe }: { universe: Universe }) {
  const [state, action, pending] = useActionState<
    UpdateUniverseEditorialState,
    FormData
  >(updateUniverseEditorialAction, null)

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">{universe.name}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {universe.id}
        </span>
        <span
          className={`size-2 rounded-full ${universe.active ? "bg-primary" : "bg-muted-foreground/40"}`}
          aria-hidden
        />
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={universe.id} />

        <label className="flex flex-col gap-1 text-sm">
          Nom public
          <input
            name="name"
            defaultValue={universe.name}
            className="h-10 rounded-lg border border-input bg-background px-3"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description éditoriale
          <textarea
            name="editorial_description"
            defaultValue={universe.editorial_description ?? ""}
            rows={3}
            className="rounded-lg border border-input bg-background px-3 py-2"
            placeholder="Cadre précis de l'univers pour la génération de contenu…"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Sujets autorisés
            <span className="text-xs text-muted-foreground">Un sujet par ligne</span>
            <textarea
              name="allowed_topics"
              defaultValue={topicsToText(universe.allowed_topics)}
              rows={8}
              className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
              placeholder={"maquillage\nskincare\n…"}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sujets exclus
            <span className="text-xs text-muted-foreground">Un sujet par ligne</span>
            <textarea
              name="excluded_topics"
              defaultValue={topicsToText(universe.excluded_topics)}
              rows={8}
              className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
              placeholder={"peinture\narchitecture\n…"}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Guidance quiz (optionnel)
          <textarea
            name="quiz_guidance"
            defaultValue={universe.quiz_guidance ?? ""}
            rows={3}
            className="rounded-lg border border-input bg-background px-3 py-2"
            placeholder="Consignes spécifiques pour QUIZ_THEME…"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={universe.active}
            className="size-4 rounded border-input"
          />
          Actif (proposé dans le questionnaire)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          {state?.ok && (
            <span className="text-sm text-muted-foreground">Enregistré.</span>
          )}
          {state?.error && (
            <span className="text-sm text-destructive">{state.error}</span>
          )}
        </div>
      </form>
    </article>
  )
}
