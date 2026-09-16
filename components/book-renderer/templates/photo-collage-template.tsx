import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { PhotoCollageLayoutId, PhotoPageItem } from "@/lib/photo-pages"

function polaroidRotation(sourcePhotoId: string, index: number): number {
  let h = 2166136261
  const key = `${sourcePhotoId}:${index}`
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = (h >>> 0) % 7
  return (n - 3) * 0.55 // ~-1.65° … +1.65°
}

function PolaroidFrame({
  photo,
  index,
  style,
  size = "md",
}: {
  photo: PhotoPageItem
  index: number
  style: BookStyleTokens
  size?: "sm" | "md" | "lg"
}) {
  const rot = polaroidRotation(photo.sourcePhotoId, index)
  const pad = size === "lg" ? 10 : size === "sm" ? 6 : 8
  const frame: CSSProperties = {
    backgroundColor: "#fffef9",
    borderRadius: Math.min(4, style.frameRadius || 4),
    boxShadow: "0 2px 10px rgba(20, 16, 12, 0.14), 0 0 0 1px rgba(20,16,12,0.06)",
    padding: `${pad}px ${pad}px ${size === "lg" ? 28 : size === "sm" ? 18 : 22}px`,
    transform: `rotate(${rot}deg)`,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    height: "100%",
  }
  return (
    <figure
      data-source-photo-id={photo.sourcePhotoId}
      data-polaroid=""
      style={frame}
      className="min-h-0"
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          backgroundColor: "color-mix(in srgb, var(--book-secondary) 10%, #f3f0ea)",
          borderRadius: 2,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
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
      </div>
      <figcaption
        className="mt-2 flex flex-col gap-0.5"
        style={{ minHeight: size === "sm" ? 28 : 36 }}
      >
        {photo.kicker ? (
          <span
            className={style.gameLabelClassName}
            style={{
              fontSize: size === "sm" ? 8 : 9,
              letterSpacing: "0.16em",
              color: bookColor.dark,
              opacity: 0.72,
            }}
          >
            {photo.kicker}
          </span>
        ) : null}
        {photo.caption ? (
          <span
            className={style.instructionClassName}
            style={{
              fontSize: size === "sm" ? 9 : 10,
              lineHeight: 1.25,
              color: bookColor.dark,
              fontStyle: "normal",
            }}
          >
            {photo.caption}
          </span>
        ) : null}
        {photo.anecdote ? (
          <span
            className={style.instructionClassName}
            style={{
              fontSize: 9,
              lineHeight: 1.2,
              fontStyle: "normal",
              color: "color-mix(in srgb, var(--book-dark, #111) 65%, transparent)",
            }}
          >
            {photo.anecdote}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

/**
 * PHOTO_COLLAGE_PAGE — album / Polaroid layout.
 * Photos only; no independent memory injection.
 */
export function PhotoCollageTemplate({
  layoutId,
  photos,
  style,
  palette: _palette,
  visualRole: _visualRole = "LIGHT",
}: {
  layoutId: PhotoCollageLayoutId
  photos: PhotoPageItem[]
  style: BookStyleTokens
  palette: Palette
  visualRole?: VisualRole
}) {
  void _palette
  void _visualRole
  const items = photos.slice(0, 4)

  let grid: CSSProperties = {
    display: "grid",
    gap: 14,
    height: "100%",
    minHeight: 0,
    padding: "4px 2px",
    alignContent: "center",
  }

  if (layoutId === "COLLAGE_2" || items.length <= 2) {
    grid = {
      ...grid,
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr",
    }
  } else if (layoutId === "COLLAGE_3" || items.length === 3) {
    grid = {
      ...grid,
      gridTemplateColumns: "1.15fr 0.85fr",
      gridTemplateRows: "1fr 1fr",
    }
  } else {
    grid = {
      ...grid,
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-layout="photo-collage"
      data-layout-id={layoutId}
      data-photo-count={items.length}
    >
      <div style={grid}>
        {items.map((photo, i) => {
          const cellStyle: CSSProperties =
            layoutId === "COLLAGE_3" && items.length === 3 && i === 0
              ? { gridRow: "1 / span 2", minHeight: 0 }
              : { minHeight: 0 }
          const size =
            layoutId === "COLLAGE_3" && i === 0
              ? "lg"
              : items.length >= 4
                ? "sm"
                : "md"
          return (
            <div key={photo.sourcePhotoId} style={cellStyle}>
              <PolaroidFrame photo={photo} index={i} style={style} size={size} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
