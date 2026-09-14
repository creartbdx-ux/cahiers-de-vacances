import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { MemoryDensity, MemoryPageVariant } from "@/lib/memory-pages/types"

/**
 * MEMORY_PAGE V1 — editorial memory page (not a game).
 * TEXT_ONLY adapts to density: SHORT (quote/typo), MEDIUM (classic), RICH (longer body).
 * Never shows a "photo manquante" placeholder.
 */
export function MemoryTemplate({
  title,
  body,
  eyebrow,
  place,
  style,
  palette: _palette,
  visualRole: _visualRole = "LIGHT",
  variant = "TEXT_ONLY",
  density = "MEDIUM",
  photoUrl,
  photoCaption,
}: {
  title: string
  body: string
  eyebrow?: string | null
  place?: string | null
  style: BookStyleTokens
  palette: Palette
  visualRole?: VisualRole
  variant?: MemoryPageVariant
  density?: MemoryDensity
  photoUrl?: string | null
  photoCaption?: string | null
}) {
  void _palette
  void _visualRole
  const showPhoto = variant === "PHOTO" && Boolean(photoUrl)
  const decor: CSSProperties = {
    borderRadius: style.badgeRadius === 999 ? 999 : style.frameRadius,
  }

  if (showPhoto) {
    return (
      <div
        className="flex h-full w-full flex-col"
        style={{ gap: 18 }}
        data-memory-variant="PHOTO"
        data-memory-density={density}
      >
        <div
          className="relative overflow-hidden"
          style={{
            ...decor,
            flex: "0 0 auto",
            height: density === "SHORT" ? 380 : 340,
            border: `${style.frameBorderWidth}px solid ${bookColor.dark}`,
            backgroundColor: "color-mix(in srgb, var(--book-secondary) 12%, var(--book-light))",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl!}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        <header className="flex flex-col" style={{ gap: 8 }}>
          {(eyebrow || place) && (
            <p
              className={style.gameLabelClassName}
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                color: "var(--book-page-band, var(--book-secondary))",
              }}
            >
              {eyebrow || place}
            </p>
          )}
          <h1
            className={style.titleClassName}
            style={{ fontSize: 36, color: bookColor.primary, lineHeight: 1.05, maxWidth: 520 }}
          >
            {title}
          </h1>
        </header>

        <p
          className={style.instructionClassName}
          style={{
            fontSize: density === "SHORT" ? 18 : 16,
            color: bookColor.dark,
            lineHeight: 1.55,
            maxWidth: 540,
            opacity: 0.92,
          }}
        >
          {body}
        </p>

        {photoCaption ? (
          <p className="font-sans" style={{ fontSize: 12, color: bookColor.dark, opacity: 0.55 }}>
            {photoCaption}
          </p>
        ) : null}

        {place && eyebrow && place !== eyebrow ? (
          <p className="font-sans" style={{ fontSize: 12, color: bookColor.dark, opacity: 0.5 }}>
            {place}
          </p>
        ) : null}
      </div>
    )
  }

  if (density === "SHORT") {
    return (
      <div
        className="relative flex h-full w-full flex-col justify-between"
        style={{ padding: 6 }}
        data-memory-variant="TEXT_ONLY"
        data-memory-density="SHORT"
        data-memory-layout="quote"
      >
        <div className="flex items-start justify-between">
          <span
            aria-hidden
            style={{
              ...decor,
              width: 56,
              height: 56,
              backgroundColor: "color-mix(in srgb, var(--book-accent) 45%, var(--book-light))",
              border: `${style.frameBorderWidth}px solid ${bookColor.accent}`,
            }}
          />
          <span
            className={style.gameLabelClassName}
            style={{
              fontSize: 11,
              letterSpacing: "0.28em",
              color: "var(--book-page-band, var(--book-primary))",
            }}
          >
            SOUVENIR
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ gap: 22, padding: "24px 12px" }}>
          {(eyebrow || place) && (
            <p
              className={style.gameLabelClassName}
              style={{
                fontSize: 12,
                letterSpacing: "0.2em",
                color: "var(--book-page-band, var(--book-secondary))",
                opacity: 0.85,
              }}
            >
              {eyebrow || place}
            </p>
          )}
          <h1
            className={style.titleClassName}
            style={{
              fontSize: 52,
              color: bookColor.primary,
              lineHeight: 0.92,
              maxWidth: 440,
            }}
          >
            {title}
          </h1>
          <div
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `${style.frameBorderWidth}px solid ${bookColor.accent}`,
              backgroundColor: "color-mix(in srgb, var(--book-secondary) 25%, var(--book-light))",
            }}
          />
          <blockquote
            className={style.instructionClassName}
            style={{
              fontSize: 22,
              color: bookColor.dark,
              lineHeight: 1.45,
              maxWidth: 460,
              margin: 0,
              opacity: 0.92,
            }}
          >
            {body}
          </blockquote>
        </div>

        <div className="flex items-end justify-between">
          <span
            aria-hidden
            style={{
              ...decor,
              width: 96,
              height: 20,
              backgroundColor: "color-mix(in srgb, var(--book-secondary) 55%, var(--book-light))",
            }}
          />
          <span
            aria-hidden
            style={{
              width: 36,
              height: 36,
              ...decor,
              backgroundColor: bookColor.primary,
            }}
          />
        </div>
      </div>
    )
  }

  const paragraphs =
    density === "RICH"
      ? body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
      : [body]
  const bodySize = density === "RICH" ? 16 : 17
  const titleSize = density === "RICH" ? 42 : 48

  return (
    <div
      className="relative flex h-full w-full flex-col"
      style={{ gap: 20, padding: 4 }}
      data-memory-variant="TEXT_ONLY"
      data-memory-density={density}
      data-memory-layout={density === "RICH" ? "editorial-long" : "editorial"}
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden
          style={{
            ...decor,
            width: 48,
            height: 48,
            backgroundColor: "color-mix(in srgb, var(--book-accent) 40%, var(--book-light))",
            border: `${style.frameBorderWidth}px solid ${bookColor.accent}`,
          }}
        />
        <span
          className={style.gameLabelClassName}
          style={{
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "var(--book-page-band, var(--book-primary))",
          }}
        >
          SOUVENIR
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center" style={{ gap: 18 }}>
        {(eyebrow || place) && (
          <p
            className={style.instructionClassName}
            style={{ fontSize: 14, color: bookColor.dark, opacity: 0.65 }}
          >
            {eyebrow || place}
          </p>
        )}
        <h1
          className={style.titleClassName}
          style={{
            fontSize: titleSize,
            color: bookColor.primary,
            lineHeight: 0.95,
            maxWidth: 460,
          }}
        >
          {title}
        </h1>
        <div
          aria-hidden
          style={{
            width: 64,
            height: 4,
            borderRadius: 999,
            backgroundColor: bookColor.accent,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 500 }}>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={style.instructionClassName}
              style={{
                fontSize: bodySize,
                color: bookColor.dark,
                lineHeight: 1.6,
                margin: 0,
                opacity: 0.9,
              }}
            >
              {p}
            </p>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <span
          aria-hidden
          style={{
            ...decor,
            width: 72,
            height: 16,
            backgroundColor: "color-mix(in srgb, var(--book-secondary) 55%, var(--book-light))",
          }}
        />
        {place ? (
          <span className="font-sans" style={{ fontSize: 12, color: bookColor.dark, opacity: 0.5 }}>
            {place}
          </span>
        ) : (
          <span aria-hidden style={{ width: 28, height: 28, ...decor, backgroundColor: bookColor.primary }} />
        )}
      </div>
    </div>
  )
}
