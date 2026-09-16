import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { PhotoPageItem } from "@/lib/photo-pages"
import {
  classifyPhotoOrientation,
  objectPositionForOrientation,
} from "@/lib/photo-pages/orientation"

/**
 * PHOTO_TIMELINE_PAGE — vertical scrapbook timeline.
 * Only used when every photo has a reliable date (planner rule unchanged).
 */
export function PhotoTimelineTemplate({
  photos,
  style,
  palette: _palette,
  visualRole: _visualRole = "LIGHT",
}: {
  photos: PhotoPageItem[]
  style: BookStyleTokens
  palette: Palette
  visualRole?: VisualRole
}) {
  void _palette
  void _visualRole
  const items = photos.slice(0, 4)

  return (
    <div
      className="relative flex h-full min-h-0 flex-col justify-center"
      data-layout="photo-timeline"
      data-photo-count={items.length}
      style={{
        gap: 14,
        padding: "12px 10px",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--book-light) 90%, var(--book-secondary)) 0%, var(--book-light) 100%)",
      }}
    >
      {items.map((photo, i) => {
        const orientation = classifyPhotoOrientation(photo.aspectRatio)
        const polaroid: CSSProperties = {
          backgroundColor: "color-mix(in srgb, var(--book-light) 92%, #fff)",
          borderRadius: 3,
          boxShadow: "0 3px 12px rgba(20, 16, 12, 0.14)",
          padding: "8px 8px 18px",
          width: "100%",
          maxWidth: 220,
          transform: i % 2 === 0 ? "rotate(-0.9deg)" : "rotate(0.8deg)",
          flexShrink: 0,
        }
        return (
          <div
            key={photo.sourcePhotoId}
            data-source-photo-id={photo.sourcePhotoId}
            data-orientation={orientation}
            className="grid items-center gap-3"
            style={{
              gridTemplateColumns: "64px 16px minmax(0, 1fr)",
              minHeight: 0,
            }}
          >
            <div className="text-right">
              <span
                className={style.gameLabelClassName}
                style={{
                  fontSize: 15,
                  letterSpacing: "0.06em",
                  color: bookColor.dark,
                }}
              >
                {photo.dateLabel ?? "—"}
              </span>
            </div>
            <div className="relative flex h-full flex-col items-center self-stretch">
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: "var(--book-accent)",
                  border: `1.5px solid ${bookColor.dark}`,
                  zIndex: 1,
                  flexShrink: 0,
                }}
              />
              {i < items.length - 1 ? (
                <div
                  style={{
                    flex: 1,
                    width: 2,
                    marginTop: 4,
                    backgroundColor:
                      "color-mix(in srgb, var(--book-secondary) 55%, var(--book-dark))",
                    minHeight: 36,
                    opacity: 0.45,
                  }}
                />
              ) : null}
            </div>
            <div className="flex min-h-0 items-center gap-4">
              <figure style={polaroid}>
                <div
                  style={{
                    aspectRatio: orientation === "PORTRAIT" ? "3 / 4" : "4 / 3",
                    overflow: "hidden",
                    backgroundColor:
                      "color-mix(in srgb, var(--book-secondary) 10%, var(--book-light))",
                    minHeight: 96,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: objectPositionForOrientation(orientation),
                      display: "block",
                    }}
                  />
                </div>
              </figure>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
                {photo.kicker ? (
                  <span
                    className={style.gameLabelClassName}
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      color: bookColor.dark,
                      opacity: 0.75,
                    }}
                  >
                    {photo.kicker}
                  </span>
                ) : null}
                {photo.caption ? (
                  <p
                    className={style.instructionClassName}
                    style={{
                      fontSize: 13,
                      lineHeight: 1.35,
                      color: bookColor.dark,
                      fontStyle: "normal",
                    }}
                  >
                    {photo.caption}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
