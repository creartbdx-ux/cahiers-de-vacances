import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HomeHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -left-24 top-[-6rem] size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 size-72 rounded-full bg-highlight/15 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Cahiers de vacances pour adultes
          </span>

          <h1 className="mt-6 font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Le plaisir de jouer,{' '}
            <span className="text-primary">pensé pour les grands.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Composez un cahier unique à partir de vos envies : énigmes,
            jeux d&apos;esprit et univers soignés. Chic, malin et jamais
            enfantin.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              render={<Link href="/creer" />}
              nativeButton={false}
              size="lg"
              className="rounded-full"
            >
              Créer mon cahier
              <ArrowRight className="size-4" />
            </Button>
            <Button
              render={<Link href="/apercu" />}
              nativeButton={false}
              size="lg"
              variant="outline"
              className="rounded-full"
            >
              Voir un aperçu
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
