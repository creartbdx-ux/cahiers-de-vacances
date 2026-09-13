import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

const CHECKER =
  "repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%) 50% / 16px 16px"

/**
 * Renders an already-sanitized SVG string inside a bounded, centered box.
 * The inner <svg> is forced to fit while preserving its aspect ratio.
 */
export function SvgFrame({
  svg,
  className,
  checker = false,
  label,
}: {
  svg: string | null
  className?: string
  checker?: boolean
  label?: string
}) {
  if (!svg) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={label ? `${label} (aperçu indisponible)` : "Aperçu indisponible"}
      >
        <ImageOff className="size-6" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden [&_svg]:h-full [&_svg]:w-full",
        className,
      )}
      style={checker ? { background: CHECKER } : undefined}
      role="img"
      aria-label={label ?? "Aperçu de l'asset"}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
