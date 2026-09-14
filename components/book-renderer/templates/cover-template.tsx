import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { Palette } from "@/lib/supabase/types"

/**
 * COVER V1 — simple branded cover. No IA, no photo required.
 */
export function CoverTemplate({
  displayName,
  subtitle,
  style,
  palette: _palette,
}: {
  displayName: string
  subtitle: string
  style: BookStyleTokens
  palette: Palette
}) {
  void _palette
  const decor: CSSProperties = {
    borderRadius: style.badgeRadius === 999 ? 999 : style.frameRadius,
  }

  return (
    <div className="relative flex h-full w-full flex-col justify-between" style={{ padding: 8 }}>
      <div className="flex items-center justify-between">
        <span
          style={{
            ...decor,
            width: 56,
            height: 56,
            backgroundColor: "color-mix(in srgb, var(--book-accent) 55%, var(--book-light))",
            border: `${style.frameBorderWidth}px solid ${bookColor.accent}`,
          }}
          aria-hidden
        />
        <span
          style={{
            ...decor,
            width: 36,
            height: 36,
            backgroundColor: "color-mix(in srgb, var(--book-secondary) 45%, var(--book-light))",
            border: `${style.frameBorderWidth}px solid ${bookColor.secondary}`,
          }}
          aria-hidden
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ gap: 20 }}>
        <p
          className={style.gameLabelClassName}
          style={{
            fontSize: 13,
            letterSpacing: "0.28em",
            color: bookColor.primary,
          }}
        >
          CAHIER DE VACANCES
        </p>
        <h1
          className={style.titleClassName}
          style={{
            fontSize: 52,
            color: bookColor.primary,
            maxWidth: 420,
            lineHeight: 0.95,
          }}
        >
          {displayName}
        </h1>
        <p
          className={style.instructionClassName}
          style={{ fontSize: 16, color: bookColor.dark, opacity: 0.8 }}
        >
          {subtitle}
        </p>
      </div>

      <div className="flex items-end justify-between">
        <span
          style={{
            ...decor,
            width: 72,
            height: 18,
            backgroundColor: bookColor.primary,
          }}
          aria-hidden
        />
        <span
          className={style.clueHeadingClassName}
          style={{ fontSize: 11, color: bookColor.dark, opacity: 0.55 }}
        >
          Édition unique
        </span>
      </div>
    </div>
  )
}
