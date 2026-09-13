"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { recolorSvg, sanitizeSvg } from "@/lib/svg/transform"
import type { Palette } from "@/lib/supabase/types"

/**
 * Renders a decorative asset from its single master SVG. Recolorable assets are
 * repainted in-memory with the active palette (technical colors -> palette
 * colors) so we keep ONE master file and stay fully vectorial — no per-palette
 * copies. Assets are purely decorative and hidden from assistive tech.
 */
export function RecolorableAsset({
  master,
  palette,
  recolorable,
  className,
}: {
  master: string | null
  palette: Palette
  recolorable: boolean
  className?: string
}) {
  const svg = useMemo(() => {
    if (!master) return null
    return recolorable ? recolorSvg(master, palette) : sanitizeSvg(master)
  }, [master, palette, recolorable])

  if (!svg) return null

  return (
    <div
      aria-hidden="true"
      className={cn("[&_svg]:h-full [&_svg]:w-full [&_svg]:object-contain", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
