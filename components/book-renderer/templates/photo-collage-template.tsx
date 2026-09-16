import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { PhotoCollageLayoutId, PhotoPageItem } from "@/lib/photo-pages"
import {
  resolveCollageComposition,
  type CollageComposition,
  type EnrichedPhotoItem,
} from "@/lib/photo-pages/collage-composition"
import {
  objectPositionForOrientation,
  preferredFrameRatio,
} from "@/lib/photo-pages/orientation"

function polaroidRotation(sourcePhotoId: string, index: number): number {
  let h = 2166136261
  const key = `${sourcePhotoId}:${index}`
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = (h >>> 0) % 9
  return (n - 4) * 0.45 // ~-1.8° … +1.8°
}

function TapeAccent({ side }: { side: "tl" | "tr" }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: side === "tl" ? -6 : -5,
        left: side === "tl" ? 10 : undefined,
        right: side === "tr" ? 12 : undefined,
        width: 28,
        height: 10,
        backgroundColor: "color-mix(in srgb, var(--book-secondary) 55%, var(--book-accent))",
        opacity: 0.55,
        transform: side === "tl" ? "rotate(-8deg)" : "rotate(6deg)",
        borderRadius: 1,
        pointerEvents: "none",
      }}
    />
  )
}

function PolaroidFrame({
  photo,
  index,
  style,
  size = "md",
  showTape = false,
}: {
  photo: EnrichedPhotoItem
  index: number
  style: BookStyleTokens
  size?: "sm" | "md" | "lg"
  showTape?: boolean
}) {
  const rot = polaroidRotation(photo.sourcePhotoId, index)
  const pad = size === "lg" ? 12 : size === "sm" ? 8 : 10
  const captionMin = size === "lg" ? 44 : size === "sm" ? 36 : 40
  const kickerSize = size === "sm" ? 10 : 11
  const captionSize = size === "sm" ? 12 : size === "lg" ? 14 : 13
  const frameRatio = preferredFrameRatio(photo.orientation)
  const objectPosition = objectPositionForOrientation(photo.orientation)

  const frame: CSSProperties = {
    position: "relative",
    backgroundColor: "color-mix(in srgb, var(--book-light) 92%, #fff)",
    borderRadius: Math.min(4, style.frameRadius || 4),
    boxShadow:
      "0 3px 14px rgba(20, 16, 12, 0.16), 0 0 0 1px color-mix(in srgb, var(--book-dark) 8%, transparent)",
    padding: `${pad}px ${pad}px ${pad + (size === "lg" ? 8 : 4)}px`,
    transform: `rotate(${rot}deg)`,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    height: "100%",
  }

  return (
    <figure
      data-source-photo-id={photo.sourcePhotoId}
      data-orientation={photo.orientation}
      data-polaroid=""
      style={frame}
      className="min-h-0"
    >
      {showTape ? <TapeAccent side={index % 2 === 0 ? "tl" : "tr"} /> : null}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          backgroundColor: "color-mix(in srgb, var(--book-secondary) 12%, var(--book-light))",
          borderRadius: 2,
          // Hint preferred ratio without forcing a rigid crop when cell is constrained
          aspectRatio: size === "lg" ? undefined : frameRatio,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt=""
          data-object-fit="cover"
          data-object-position={objectPosition}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition,
            display: "block",
          }}
        />
      </div>
      <figcaption
        className="mt-2 flex flex-col gap-1"
        style={{ minHeight: captionMin, flexShrink: 0 }}
      >
        {photo.kicker ? (
          <span
            className={style.gameLabelClassName}
            style={{
              fontSize: kickerSize,
              letterSpacing: "0.14em",
              color: bookColor.dark,
              opacity: 0.78,
            }}
          >
            {photo.kicker}
          </span>
        ) : null}
        {photo.caption ? (
          <span
            className={style.instructionClassName}
            style={{
              fontSize: captionSize,
              lineHeight: 1.3,
              color: bookColor.dark,
              fontStyle: "normal",
            }}
          >
            {photo.caption}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

function PageTitle({
  title,
  style,
}: {
  title: string
  style: BookStyleTokens
}) {
  return (
    <p
      className={style.gameLabelClassName}
      data-page-title=""
      style={{
        fontSize: 12,
        letterSpacing: "0.18em",
        color: "color-mix(in srgb, var(--book-dark) 70%, var(--book-secondary))",
        marginBottom: 10,
        textAlign: "center",
      }}
    >
      {title}
    </p>
  )
}

function CornerDecor() {
  return (
    <>
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          width: 18,
          height: 18,
          borderTop: "2px solid color-mix(in srgb, var(--book-accent) 50%, transparent)",
          borderLeft: "2px solid color-mix(in srgb, var(--book-accent) 50%, transparent)",
          opacity: 0.7,
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          width: 18,
          height: 18,
          borderBottom: "2px solid color-mix(in srgb, var(--book-secondary) 55%, transparent)",
          borderRight: "2px solid color-mix(in srgb, var(--book-secondary) 55%, transparent)",
          opacity: 0.7,
          pointerEvents: "none",
        }}
      />
    </>
  )
}

function gridForComposition(comp: CollageComposition): CSSProperties {
  const base: CSSProperties = {
    display: "grid",
    gap: 16,
    height: "100%",
    minHeight: 0,
    flex: 1,
    alignContent: "stretch",
  }

  if (comp.layoutId === "COLLAGE_2") {
    if (comp.variant === "STACKED") {
      return { ...base, gridTemplateColumns: "1fr", gridTemplateRows: "1fr 1fr" }
    }
    return { ...base, gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr" }
  }

  if (comp.layoutId === "COLLAGE_4") {
    if (comp.variant === "HERO_PLUS_THREE") {
      return {
        ...base,
        gridTemplateColumns: "1.25fr 0.75fr",
        gridTemplateRows: "1fr 1fr 1fr",
      }
    }
    return {
      ...base,
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
    }
  }

  // COLLAGE_3
  if (comp.variant === "HERO_TOP") {
    return {
      ...base,
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1.25fr 0.85fr",
    }
  }
  if (comp.variant === "HERO_RIGHT") {
    return {
      ...base,
      gridTemplateColumns: "0.85fr 1.15fr",
      gridTemplateRows: "1fr 1fr",
    }
  }
  // HERO_LEFT
  return {
    ...base,
    gridTemplateColumns: "1.15fr 0.85fr",
    gridTemplateRows: "1fr 1fr",
  }
}

function cellStyleFor(
  comp: CollageComposition,
  index: number,
): CSSProperties {
  if (comp.layoutId === "COLLAGE_3") {
    if (comp.variant === "HERO_TOP" && index === 0) {
      return { gridColumn: "1 / span 2", minHeight: 0 }
    }
    if (comp.variant === "HERO_LEFT" && index === 0) {
      return { gridRow: "1 / span 2", minHeight: 0 }
    }
    if (comp.variant === "HERO_RIGHT" && index === 0) {
      return { gridColumn: 2, gridRow: "1 / span 2", minHeight: 0 }
    }
    if (comp.variant === "HERO_RIGHT" && index > 0) {
      return { gridColumn: 1, minHeight: 0 }
    }
  }
  if (comp.layoutId === "COLLAGE_4" && comp.variant === "HERO_PLUS_THREE") {
    if (index === 0) return { gridRow: "1 / span 3", minHeight: 0 }
  }
  return { minHeight: 0 }
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
  seed = "photo-collage",
  aspectRatios,
  composition: compositionOverride,
}: {
  layoutId: PhotoCollageLayoutId
  photos: PhotoPageItem[]
  style: BookStyleTokens
  palette: Palette
  visualRole?: VisualRole
  seed?: string
  aspectRatios?: Record<string, number>
  /** Precomputed composition (Book Lab debug). */
  composition?: CollageComposition
}) {
  void _palette
  void _visualRole
  const comp =
    compositionOverride ??
    resolveCollageComposition({
      layoutId,
      photos: photos.slice(0, 4),
      seed,
      aspectRatios,
    })
  const grid = gridForComposition(comp)

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      data-layout="photo-collage"
      data-layout-id={comp.layoutId}
      data-variant={comp.variant}
      data-hero-photo-id={comp.heroPhotoId ?? ""}
      data-photo-count={comp.photos.length}
      data-show-page-title={comp.showPageTitle ? "1" : "0"}
      style={{
        padding: "10px 8px",
        background:
          "linear-gradient(165deg, color-mix(in srgb, var(--book-light) 88%, var(--book-secondary)) 0%, var(--book-light) 55%, color-mix(in srgb, var(--book-light) 94%, var(--book-accent)) 100%)",
      }}
    >
      <CornerDecor />
      {comp.showPageTitle && comp.pageTitle ? (
        <PageTitle title={comp.pageTitle} style={style} />
      ) : null}
      <div style={grid}>
        {comp.photos.map((photo, i) => {
          const isHero = comp.heroPhotoId === photo.sourcePhotoId
          const size =
            isHero || (comp.layoutId === "COLLAGE_2" && comp.photos.length <= 2)
              ? "lg"
              : comp.layoutId === "COLLAGE_4"
                ? "sm"
                : "md"
          return (
            <div key={photo.sourcePhotoId} style={cellStyleFor(comp, i)}>
              <PolaroidFrame
                photo={photo}
                index={i}
                style={style}
                size={size}
                showTape={isHero || i === 0}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
