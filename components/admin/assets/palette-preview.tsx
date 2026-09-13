"use client"

import { useMemo } from "react"
import { SvgFrame } from "@/components/admin/assets/svg-frame"
import { recolorSvg } from "@/lib/svg/transform"
import type { Palette } from "@/lib/supabase/types"

/**
 * Renders the single master SVG recolored on the fly with every active palette.
 * No extra files are created — recoloring is a pure string substitution done in
 * the browser, so the output stays vectorial and tracks palette edits live.
 */
export function PalettePreview({ svg, palettes }: { svg: string | null; palettes: Palette[] }) {
  const variants = useMemo(
    () => (svg ? palettes.map((palette) => ({ palette, recolored: recolorSvg(svg, palette) })) : []),
    [svg, palettes],
  )

  if (!svg) {
    return <p className="text-sm text-muted-foreground">Aperçu indisponible : le fichier maître est illisible.</p>
  }
  if (palettes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune palette active à prévisualiser.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {variants.map(({ palette, recolored }) => (
        <figure key={palette.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div
            className="aspect-square p-5"
            style={{ backgroundColor: palette.background_color }}
          >
            <SvgFrame svg={recolored} className="h-full w-full" label={`${palette.name}`} />
          </div>
          <figcaption className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <span className="truncate text-xs font-medium text-foreground">{palette.name}</span>
            <span className="flex shrink-0 gap-1">
              {[palette.primary_color, palette.secondary_color, palette.accent_color].map((c, i) => (
                <span
                  key={i}
                  className="size-3 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
