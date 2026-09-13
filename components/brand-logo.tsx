import Link from 'next/link'
import { cn } from '@/lib/utils'

type BrandLogoProps = {
  href?: string
  className?: string
}

export function BrandLogo({ href = '/', className }: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-2.5 text-foreground',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-6"
      >
        <span className="font-serif text-lg font-semibold leading-none">C</span>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-serif text-lg font-semibold tracking-tight">
          Carnet
        </span>
        <span className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Cahiers sur mesure
        </span>
      </span>
    </Link>
  )
}
