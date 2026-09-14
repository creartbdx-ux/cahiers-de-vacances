import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { MemoryDensity, PhotoMemoryLayout } from "@/lib/memory-pages/types"
import { photoShareForLayout } from "@/lib/memory-pages/photo-layout"

/**
 * PHOTO_MEMORY_PAGE V1 — adaptive photo + caption/anecdote editorial.
 * Layouts: LANDSCAPE | PORTRAIT | SQUARE. No forced oval/circle crops.
 * object-fit: cover without distorting the bitmap (no stretch).
 */
export function PhotoMemoryTemplate({
  title,
  body,
  eyebrow,
  style,
  palette: _palette,
  visualRole: _visualRole = "LIGHT",
  density = "MEDIUM",
  layout = "LANDSCAPE",
  photoUrl,
  weakSource = false,
}: {
  title: string
  body: string
  eyebrow?: string | null
  style: BookStyleTokens
  palette: Palette
  visualRole?: VisualRole
  density?: MemoryDensity
  layout?: PhotoMemoryLayout
  photoUrl: string
  weakSource?: boolean
}) {
  void _palette
  void _visualRole
  const share = photoShareForLayout(layout, density)
  const frameRadius =
    style.badgeRadius === 999 ? Math.min(16, style.frameRadius || 12) : style.frameRadius
  const frame: CSSProperties = {
    borderRadius: frameRadius,
    border: `${style.frameBorderWidth}px solid ${bookColor.dark}`,
    overflow: "hidden",
    backgroundColor: "color-mix(in srgb, var(--book-secondary) 12%, var(--book-light))",
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt=""
      data-object-fit="cover"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        display: "block",
      }}
    />
  )

  const textBlock = (
    <div className="flex min-h-0 flex-col justify-center" style={{ gap: density === "SHORT" ? 10 : 14 }}>
      {eyebrow ? (
        <p
          className={style.gameLabelClassName}
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--book-page-band, var(--book-secondary))",
          }}
        >
          {eyebrow}
        </p>
      ) : null}
      <h1
        className={style.titleClassName}
        style={{
          fontSize: density === "SHORT" ? 40 : density === "RICH" ? 30 : 34,
          color: bookColor.primary,
          lineHeight: 1.05,
          maxWidth: 420,
        }}
      >
        {title}
      </h1>
      {body.trim() ? (
        <p
          className={style.instructionClassName}
          style={{
            fontSize: density === "RICH" ? 15 : 16,
            color: bookColor.dark,
            lineHeight: 1.55,
            maxWidth: 440,
            opacity: 0.92,
            whiteSpace: "pre-wrap",
          }}
        >
          {body}
        </p>
      ) : weakSource ? null : null}
    </div>
  )

  if (layout === "PORTRAIT") {
    return (
      <div
        className="flex h-full w-full"
        style={{ gap: 20 }}
        data-photo-memory-layout="PORTRAIT"
        data-memory-density={density}
        data-photo-share={share.toFixed(2)}
      >
        <div
          className="relative shrink-0"
          style={{
            ...frame,
            width: `${Math.round(share * 100)}%`,
            alignSelf: "stretch",
            minHeight: 280,
          }}
        >
          {img}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ paddingBlock: 8 }}>
          {textBlock}
        </div>
      </div>
    )
  }

  if (layout === "SQUARE") {
    return (
      <div
        className="relative flex h-full w-full flex-col"
        style={{ gap: 16, padding: 4 }}
        data-photo-memory-layout="SQUARE"
        data-memory-density={density}
        data-photo-share={share.toFixed(2)}
      >
        <div className="flex flex-1 items-start" style={{ gap: 18 }}>
          <div
            className="relative shrink-0"
            style={{
              ...frame,
              width: `${Math.round(share * 100)}%`,
              aspectRatio: "1 / 1",
              marginTop: density === "SHORT" ? 0 : 24,
              marginLeft: density === "RICH" ? 8 : 0,
            }}
          >
            {img}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-end" style={{ paddingBottom: 12 }}>
            {eyebrow ? (
              <p
                className={style.gameLabelClassName}
                style={{
                  fontSize: 11,
                  letterSpacing: "0.2em",
                  color: "var(--book-page-band, var(--book-secondary))",
                  marginBottom: 8,
                }}
              >
                {eyebrow}
              </p>
            ) : null}
            <h1
              className={style.titleClassName}
              style={{
                fontSize: density === "SHORT" ? 38 : 32,
                color: bookColor.primary,
                lineHeight: 1.05,
              }}
            >
              {title}
            </h1>
          </div>
        </div>
        {body.trim() ? (
          <p
            className={style.instructionClassName}
            style={{
              fontSize: density === "RICH" ? 15 : 16,
              color: bookColor.dark,
              lineHeight: 1.55,
              maxWidth: 500,
              opacity: 0.92,
              whiteSpace: "pre-wrap",
            }}
          >
            {body}
          </p>
        ) : null}
      </div>
    )
  }

  // LANDSCAPE — photo as a large editorial plane, not forced to the top edge.
  const photoHeightPct = Math.round(share * 100)
  return (
    <div
      className="flex h-full w-full flex-col justify-between"
      style={{ gap: 16, paddingTop: density === "SHORT" ? 4 : 28 }}
      data-photo-memory-layout="LANDSCAPE"
      data-memory-density={density}
      data-photo-share={share.toFixed(2)}
    >
      <div
        className="relative w-full shrink-0"
        style={{
          ...frame,
          height: `${photoHeightPct}%`,
          minHeight: density === "SHORT" ? 300 : density === "RICH" ? 240 : 270,
          maxHeight: density === "RICH" ? 320 : 380,
        }}
      >
        {img}
      </div>
      <div className="flex flex-1 flex-col justify-center" style={{ paddingBottom: 8 }}>
        {textBlock}
      </div>
    </div>
  )
}
