import type { Metadata } from "next"
import Link from "next/link"
import { FlaskConical } from "lucide-react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { Button } from "@/components/ui/button"
import { getGames, getTemplates } from "@/lib/data/reference"
import { resolveEngineStatus } from "@/lib/game-engines/registry"

export const metadata: Metadata = {
  title: "Templates",
}

/**
 * Read-only view of the TEMPLATES catalogue. A TEMPLATE is a graphic structure
 * bound to a TECHNICAL ENGINE (not to a single game), so every game running on
 * that engine can reuse it. Engine implementation status comes from the registry.
 */
export default async function AdminTemplatesPage() {
  const [templates, games] = await Promise.all([getTemplates(), getGames()])

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Templates"
        description="Gabarits graphiques. Chaque template est lié à un moteur technique et réutilisable par tous les jeux de ce moteur."
        actions={
          <Button render={<Link href="/admin/page-lab" />}>
            <FlaskConical />
            Ouvrir le Page Lab
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState message="Aucun template enregistré pour le moment." />
      ) : (
        <div className="flex flex-col gap-4">
          {templates.map((template) => {
            const status = resolveEngineStatus(template.technical_engine)
            const compatibleGames = games.filter(
              (g) => g.technical_engine != null && g.technical_engine === template.technical_engine,
            )
            return (
              <div key={template.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{template.name}</h2>
                    <p className="font-mono text-xs text-muted-foreground">{template.id}</p>
                  </div>
                  <StatusDot active={template.active} />
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Field label="Moteur technique">
                    {status.id ? (
                      status.implemented ? (
                        <span className="font-mono text-foreground">
                          {status.id} · v{status.version}
                        </span>
                      ) : (
                        <span className="font-mono text-destructive">
                          {status.id} · non implémenté
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Field>
                  <Field label="Clé de structure">
                    <span className="font-mono text-foreground">{template.structure_key}</span>
                  </Field>
                  <Field label="Jeux compatibles">
                    <span className="text-foreground">{compatibleGames.length}</span>
                  </Field>
                </dl>

                {compatibleGames.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    {compatibleGames.map((g) => (
                      <span
                        key={g.id}
                        className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`size-2 rounded-full ${active ? "bg-chart-4" : "bg-muted-foreground/40"}`} />
      {active ? "Actif" : "Inactif"}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
