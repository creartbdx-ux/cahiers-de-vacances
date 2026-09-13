import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { getGames } from "@/lib/data/reference"
import { resolveEngineStatus } from "@/lib/game-engines/registry"

export const metadata: Metadata = {
  title: "Jeux",
}

/**
 * Read-only view of the GAMES catalogue. A GAME is an editorial choice
 * (personalised vs thematic crossword…), distinct from the TECHNICAL ENGINE
 * that actually generates it. Implementation status comes from the registry —
 * never from a hardcoded engine→version map in this page.
 */
export default async function AdminJeuxPage() {
  const games = await getGames()
  const active = games.filter((g) => g.active).length

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Jeux"
        description="Catalogue éditorial des jeux. Chaque jeu s'appuie sur un moteur technique qui le génère."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Jeux au total" value={games.length} />
        <StatChip label="Actifs" value={active} className="text-chart-4" />
      </div>

      {games.length === 0 ? (
        <EmptyState message="Aucun jeu enregistré pour le moment." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <Th>Jeu</Th>
                <Th>Personnalisation</Th>
                <Th>Moteur technique</Th>
                <Th>Difficulté</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => {
                const status = resolveEngineStatus(game.technical_engine)
                return (
                  <tr key={game.id} className="border-b border-border last:border-0">
                    <Td>
                      <span className="font-medium text-foreground">{game.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{game.id}</span>
                    </Td>
                    <Td>
                      <Badge>{game.personalization_type}</Badge>
                    </Td>
                    <Td>
                      {status.id ? (
                        status.implemented ? (
                          <span className="font-mono text-xs text-foreground">
                            {status.id} · v{status.version}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-destructive">
                            {status.id} · non implémenté
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-muted-foreground">
                        {game.min_difficulty} – {game.max_difficulty}
                      </span>
                    </Td>
                    <Td>
                      <StatusDot active={game.active} />
                    </Td>
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

function StatChip({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card px-4 py-3">
      <span className={`font-serif text-2xl font-semibold ${className ?? "text-foreground"}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 font-mono text-xs text-foreground">
      {children}
    </span>
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
