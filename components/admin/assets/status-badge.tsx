import { cn } from "@/lib/utils"
import type { AssetStatus } from "@/lib/supabase/types"

const STATUS_META: Record<AssetStatus, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  VALIDATED: { label: "Validé", className: "bg-chart-4/15 text-chart-4" },
  REJECTED: { label: "Rejeté", className: "bg-destructive/10 text-destructive" },
}

export function StatusBadge({ status, className }: { status: AssetStatus; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}
