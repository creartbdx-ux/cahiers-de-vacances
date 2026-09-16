import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { PhotoPageItem } from "@/lib/photo-pages"

/**
 * PHOTO_TIMELINE_PAGE — vertical scrapbook timeline.
 * Only used when every photo has a reliable date.
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
      className="flex h-full min-h-0 flex-col justify-center"
      data-layout="photo-timeline"
      data-photo-count={items.length}
      style={{ gap: 10, padding: "6px 4px" }}
    >
      {items.map((photo, i) => {
        const polaroid: CSSProperties = {
          backgroundColor: "#fffef9",
          borderRadius: 3,
          boxShadow: "0 2px 8px rgba(20, 16, 12, 0.12)",
          padding: "6px 6px 16px",
          width: "100%",
          maxWidth: 200,
          transform: i % 2 === 0 ? "rotate(-0.8deg)" : "rotate(0.7deg)",
        }
        return (
          <div
            key={photo.sourcePhotoId}
            data-source-photo-id={photo.sourcePhotoId}
            className="grid items-center gap-3"
            style={{
              gridTemplateColumns: "52px 14px 1fr",
              minHeight: 0,
            }}
          >
            <div className="text-right">
              <span
                className={style.gameLabelClassName}
                style={{
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  color: bookColor.dark,
                }}
              >
                {photo.dateLabel ?? "—"}
              </span>
            </div>
            <div className="relative flex h-full flex-col items-center">
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "var(--book-secondary)",
                  border: `1.5px solid ${bookColor.dark}`,
                  zIndex: 1,
                }}
              />
              {i < items.length - 1 ? (
                <div
                  style={{
                    flex: 1,
                    width: 1.5,
                    marginTop: 2,
                    backgroundColor: "color-mix(in srgb, var(--book-dark, #111) 28%, transparent)",
                    minHeight: 24,
                  }}
                />
              ) : null}
            </div>
            <div className="flex min-h-0 items-start gap-3">
              <figure style={polaroid}>
                <div
                  style={{
                    aspectRatio: "4 / 3",
                    overflow: "hidden",
                    backgroundColor: "#eee",
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
                      display: "block",
                    }}
                  />
                </div>
              </figure>
              <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
                {photo.kicker ? (
                  <span
                    className={style.gameLabelClassName}
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      color: bookColor.dark,
                      opacity: 0.7,
                    }}
                  >
                    {photo.kicker}
                  </span>
                ) : null}
                {photo.caption ? (
                  <p
                    className={style.instructionClassName}
                    style={{
                      fontSize: 11,
                      lineHeight: 1.3,
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
