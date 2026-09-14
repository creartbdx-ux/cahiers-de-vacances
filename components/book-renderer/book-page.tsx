import type { CSSProperties, ReactNode } from "react"
import { PAGE_HEIGHT, PAGE_WIDTH, SAFE_MARGIN } from "@/lib/book-renderer/constants"
import { bookColor, paletteToVars } from "@/lib/book-renderer/palette"
import type { MiniBookPageSurface } from "@/lib/mini-book/page-colors"
import type { Palette } from "@/lib/supabase/types"

/**
 * The physical A4 page surface. It owns the fixed pixel geometry and the
 * palette CSS vars; everything inside reads colors from those vars. The page
 * is always rendered at full size — scaling to fit the screen is the job of
 * the surrounding <PagePreview>.
 */
export function BookPage({
  palette,
  showSafeArea = false,
  surface,
  children,
}: {
  palette: Palette
  showSafeArea?: boolean
  /** Optional per-page surface from resolveMiniBookPageColors. */
  surface?: MiniBookPageSurface
  children: ReactNode
}) {
  const pageStyle: CSSProperties = {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    backgroundColor: surface?.background ?? bookColor.light,
    color: bookColor.dark,
    ...paletteToVars(palette),
    ...(surface
      ? ({
          ["--book-page-panel" as string]: surface.panel,
          ["--book-page-band" as string]: surface.band,
        } as CSSProperties)
      : {}),
  }

  return (
    <div style={pageStyle} className="relative overflow-hidden shadow-2xl">
      <div className="absolute inset-0" style={{ padding: SAFE_MARGIN }}>
        {children}
      </div>

      {showSafeArea && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            inset: SAFE_MARGIN,
            border: "1.5px dashed color-mix(in srgb, var(--book-dark) 45%, transparent)",
            borderRadius: 4,
          }}
        />
      )}
    </div>
  )
}
