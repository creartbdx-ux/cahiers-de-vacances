import { cn } from "@/lib/utils"

type PreviewKind = "pop" | "retro" | "minimal" | "nature" | "creative" | "fun" | "default"

function resolveKind(name: string, id: string): PreviewKind {
  const key = `${name} ${id}`.toLowerCase()
  if (/pop|coloré|colore/.test(key)) return "pop"
  if (/rétro|retro|vacances/.test(key)) return "retro"
  if (/chic|minimal/.test(key)) return "minimal"
  if (/nature|doux/.test(key)) return "nature"
  if (/créatif|creatif|illustr/.test(key)) return "creative"
  if (/fun|décalé|decale/.test(key)) return "fun"
  return "default"
}

const KIND_STYLES: Record<
  PreviewKind,
  {
    shell: string
    title: string
    shape: string
    badge: string
    dots: string
    rule: string
  }
> = {
  pop: {
    shell: "bg-gradient-to-br from-amber-200 via-rose-200 to-sky-200",
    title: "font-sans text-base font-black tracking-tight text-rose-700",
    shape: "rounded-2xl bg-fuchsia-500/90 shadow-md shadow-fuchsia-300/50",
    badge: "rounded-full bg-amber-400 text-amber-950",
    dots: "bg-sky-500",
    rule: "border-rose-400/60",
  },
  retro: {
    shell: "bg-[#f3e6c8] bg-[radial-gradient(circle_at_20%_20%,#e8d5a3_0,transparent_45%)]",
    title: "font-serif text-base italic tracking-wide text-[#5c3d2e]",
    shape: "rounded-sm bg-[#c45c26]/85 rotate-[-3deg]",
    badge: "rounded-none border border-[#5c3d2e]/40 bg-[#efe0b8] text-[#5c3d2e]",
    dots: "bg-[#8b5a2b]",
    rule: "border-[#c45c26]/50 border-dashed",
  },
  minimal: {
    shell: "bg-stone-50",
    title: "font-serif text-sm font-medium tracking-[0.12em] uppercase text-stone-800",
    shape: "rounded-none bg-stone-800",
    badge: "rounded-none border border-stone-300 bg-white text-stone-600",
    dots: "bg-stone-400",
    rule: "border-stone-200",
  },
  nature: {
    shell: "bg-gradient-to-b from-emerald-50 to-lime-50",
    title: "font-serif text-base font-semibold text-emerald-900",
    shape: "rounded-full bg-emerald-600/80",
    badge: "rounded-full bg-lime-200/80 text-emerald-900",
    dots: "bg-teal-500",
    rule: "border-emerald-200",
  },
  creative: {
    shell: "bg-[conic-gradient(at_top_left,_#fde68a,_#fbcfe8,_#c7d2fe,_#fde68a)]",
    title: "font-sans text-base font-bold text-indigo-800 -rotate-1",
    shape: "rounded-[40%_60%_55%_45%] bg-violet-500/80 rotate-6",
    badge: "rounded-xl bg-white/80 text-violet-800 shadow-sm",
    dots: "bg-pink-400",
    rule: "border-violet-300/70 border-dotted",
  },
  fun: {
    shell: "bg-yellow-100",
    title: "font-sans text-base font-extrabold text-sky-700 rotate-[-2deg]",
    shape: "rounded-lg bg-sky-400 rotate-12 shadow-[3px_3px_0_#0ea5e9]",
    badge: "rounded-md bg-lime-300 text-lime-950 shadow-[2px_2px_0_#84cc16]",
    dots: "bg-orange-400",
    rule: "border-sky-400 border-2",
  },
  default: {
    shell: "bg-muted",
    title: "font-serif text-base font-semibold text-foreground",
    shape: "rounded-lg bg-primary/70",
    badge: "rounded-full bg-background text-foreground border border-border",
    dots: "bg-primary",
    rule: "border-border",
  },
}

export function StylePreview({
  name,
  styleId,
  className,
}: {
  name: string
  styleId: string
  className?: string
}) {
  const kind = resolveKind(name, styleId)
  const s = KIND_STYLES[kind]

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-black/5 p-3",
        s.shell,
        className,
      )}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-2">
        <p className={s.title}>Titre</p>
        <span className={cn("px-2 py-0.5 text-[10px] font-medium", s.badge)}>badge</span>
      </div>
      <div className={cn("mt-3 h-8 w-8", s.shape)} />
      <div className={cn("mt-3 border-t pt-2", s.rule)}>
        <div className="flex gap-1">
          <span className={cn("size-1.5 rounded-full", s.dots)} />
          <span className={cn("size-1.5 rounded-full opacity-70", s.dots)} />
          <span className={cn("size-1.5 rounded-full opacity-40", s.dots)} />
        </div>
        <p className="mt-1 text-[10px] leading-tight text-black/50">Petite déco · encadré</p>
      </div>
    </div>
  )
}
