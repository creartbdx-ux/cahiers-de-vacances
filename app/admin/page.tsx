import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { adminNav } from "@/lib/navigation"
import { getLibraryCounts } from "@/lib/data/stats"

const modules = adminNav.filter((item) => item.href !== "/admin")

const statLabels: { key: keyof Awaited<ReturnType<typeof getLibraryCounts>>; label: string }[] = [
  { key: "books", label: "Cahiers" },
  { key: "games", label: "Jeux" },
  { key: "templates", label: "Templates" },
  { key: "assets", label: "Assets" },
  { key: "universes", label: "Univers" },
  { key: "styles", label: "Styles" },
  { key: "palettes", label: "Palettes" },
]

export default async function AdminDashboardPage() {
  const counts = await getLibraryCounts()

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Dashboard"
        description="Vue d'ensemble de la fabrique de cahiers. Accédez rapidement à chaque module d'administration."
      />

      <section aria-label="Statistiques" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {statLabels.map(({ key, label }) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="font-serif text-2xl text-foreground">{counts[key]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <item.icon className="size-5" />
            </span>
            <div className="flex-1">
              <h2 className="flex items-center gap-1.5 font-semibold text-foreground">
                {item.label}
                <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
