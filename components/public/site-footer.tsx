import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { publicNav } from '@/lib/navigation'

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-secondary/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs space-y-3">
          <BrandLogo />
          <p className="text-sm text-muted-foreground">
            Des cahiers de vacances pensés pour les adultes : élégants, malins
            et faits pour prendre le temps.
          </p>
        </div>

        <nav aria-label="Liens de pied de page" className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Parcours
          </span>
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Carnet. Tous droits réservés.</p>
          <Link
            href="/admin"
            className="font-medium transition-colors hover:text-foreground"
          >
            Espace administration
          </Link>
        </div>
      </div>
    </footer>
  )
}
