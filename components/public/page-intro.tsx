import type { ReactNode } from 'react'

type PageIntroProps = {
  eyebrow?: string
  title: string
  description: string
  children?: ReactNode
}

export function PageIntro({ eyebrow, title, description, children }: PageIntroProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        {eyebrow && (
          <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children && <div className="mt-10">{children}</div>}
    </section>
  )
}
