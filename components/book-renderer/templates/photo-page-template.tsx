import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { PhotoPageItem, PhotoPageV1 } from "@/lib/photo-pages"
import {
  selectPhotoTemplate,
  type PhotoTemplateSelection,
} from "@/lib/photo-pages/templates/select"
import type { PhotoTemplateId } from "@/lib/photo-pages/templates/types"
import {
  objectPositionForOrientation,
} from "@/lib/photo-pages/orientation"
import type { PhotoSlotDefinition } from "@/lib/photo-pages/templates/types"

/**
 * Structural photo page renderer — geometry from template registry only.
 * Used by Book Lab and future book output (same path).
 */
export function PhotoPageTemplateView({
  page,
  style,
  palette: _palette,
  visualRole: _visualRole = "LIGHT",
  seed = "photo-page",
  aspectRatios,
  forceTemplateId,
  selection: selectionOverride,
}: {
  page: PhotoPageV1
  style: BookStyleTokens
  palette: Palette
  visualRole?: VisualRole
  seed?: string
  aspectRatios?: Record<string, number>
  forceTemplateId?: PhotoTemplateId | null
  selection?: PhotoTemplateSelection
}) {
  void _palette
  void _visualRole
  const selection =
    selectionOverride ??
    selectPhotoTemplate({
      photos: page.photos,
      pageType: page.kind,
      seed: `${seed}:${page.pageKey}`,
      aspectRatios,
      forceTemplateId: forceTemplateId ?? page.templateId ?? null,
    })

  const tpl = selection.template
  const byId = new Map(selection.orderedPhotos.map((p) => [p.sourcePhotoId, p]))

  return (
    <div
      className="relative h-full w-full min-h-0"
      data-layout="photo-page-template"
      data-template-id={selection.templateId}
      data-page-type={page.kind}
      data-photo-count={selection.orderedPhotos.length}
      style={{
        background:
          "linear-gradient(165deg, color-mix(in srgb, var(--book-light) 88%, var(--book-secondary)) 0%, var(--book-light) 58%, color-mix(in srgb, var(--book-light) 94%, var(--book-accent)) 100%)",
      }}
    >
      {selection.showPageTitle &&
      selection.pageTitle &&
      tpl.pageTitleSlot ? (
        <p
          className={style.gameLabelClassName}
          data-page-title=""
          style={{
            position: "absolute",
            left: `${tpl.pageTitleSlot.x}%`,
            top: `${tpl.pageTitleSlot.y}%`,
            width: `${tpl.pageTitleSlot.width}%`,
            height: `${tpl.pageTitleSlot.height}%`,
            margin: 0,
            fontSize: 12,
            letterSpacing: "0.18em",
            color:
              "color-mix(in srgb, var(--book-dark) 70%, var(--book-secondary))",
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selection.pageTitle}
        </p>
      ) : null}

      {page.kind === "TIMELINE" ? <TimelineSpine slotCount={tpl.slots.length} /> : null}

      {tpl.slots.map((slot, i) => {
        const assignment = selection.assignments.find((a) => a.slotId === slot.id)
        const photo = assignment ? byId.get(assignment.sourcePhotoId) : null
        if (!photo) return null
        return (
          <PolaroidSlot
            key={slot.id}
            slot={slot}
            photo={photo}
            style={style}
            index={i}
            showDate={page.kind === "TIMELINE"}
          />
        )
      })}
    </div>
  )
}

function TimelineSpine({ slotCount }: { slotCount: number }) {
  return (
    <div
      aria-hidden
      data-timeline-spine=""
      style={{
        position: "absolute",
        left: "18%",
        top: "6%",
        bottom: "6%",
        width: 2,
        background:
          "color-mix(in srgb, var(--book-secondary) 50%, var(--book-dark))",
        opacity: 0.4,
      }}
    >
      {Array.from({ length: slotCount }).map((_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: -4,
            top: `${(i / Math.max(1, slotCount - 1)) * 100}%`,
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: "var(--book-accent)",
            border: `1.5px solid ${bookColor.dark}`,
          }}
        />
      ))}
    </div>
  )
}

function PolaroidSlot({
  slot,
  photo,
  style,
  index,
  showDate,
}: {
  slot: PhotoSlotDefinition
  photo: PhotoPageItem & { orientation?: string }
  style: BookStyleTokens
  index: number
  showDate: boolean
}) {
  const captionBelow =
    slot.captionMode === "POLAROID_BOTTOM" || slot.captionMode === "BELOW"
  const captionSide = slot.captionMode === "SIDE"

  const frame: CSSProperties = {
    position: "absolute",
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    width: `${slot.width}%`,
    height: `${slot.height}%`,
    transform: `rotate(${slot.rotationDeg}deg)`,
    display: "flex",
    flexDirection: captionSide ? "row" : "column",
    gap: captionSide ? 8 : 0,
    minHeight: 0,
  }

  const polaroid: CSSProperties = {
    flex: captionSide ? "0 0 48%" : 1,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: "color-mix(in srgb, var(--book-light) 92%, #fff)",
    borderRadius: Math.min(4, style.frameRadius || 4),
    boxShadow:
      "0 3px 14px rgba(20, 16, 12, 0.16), 0 0 0 1px color-mix(in srgb, var(--book-dark) 8%, transparent)",
    padding: captionBelow ? "7% 6% 14%" : "6%",
    display: "flex",
    flexDirection: "column",
  }

  const objectPosition = objectPositionForOrientation(
    (photo.orientation as "LANDSCAPE" | "PORTRAIT" | "SQUARE") || "LANDSCAPE",
  )

  return (
    <div
      style={frame}
      data-slot-id={slot.id}
      data-slot-role={slot.role}
      data-source-photo-id={photo.sourcePhotoId}
    >
      {showDate && photo.dateLabel ? (
        <span
          className={style.gameLabelClassName}
          style={{
            position: "absolute",
            left: "-42%",
            top: "8%",
            width: "38%",
            textAlign: "right",
            fontSize: 13,
            letterSpacing: "0.06em",
            color: bookColor.dark,
          }}
        >
          {photo.dateLabel}
        </span>
      ) : null}
      <figure style={polaroid} data-polaroid="">
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            borderRadius: 2,
            backgroundColor:
              "color-mix(in srgb, var(--book-secondary) 12%, var(--book-light))",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.imageUrl}
            alt=""
            data-object-fit={slot.imageFit}
            style={{
              width: "100%",
              height: "100%",
              objectFit: slot.imageFit,
              objectPosition,
              display: "block",
            }}
          />
        </div>
        {captionBelow && (photo.kicker || photo.caption) ? (
          <figcaption
            className="mt-1 flex flex-col gap-0.5"
            style={{ flexShrink: 0, minHeight: "18%" }}
          >
            {photo.kicker ? (
              <span
                className={style.gameLabelClassName}
                style={{
                  fontSize: slot.role === "hero" ? 11 : 10,
                  letterSpacing: "0.12em",
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
                  fontSize: slot.role === "hero" ? 13 : 12,
                  lineHeight: 1.25,
                  color: bookColor.dark,
                  fontStyle: "normal",
                }}
              >
                {photo.caption}
              </span>
            ) : null}
          </figcaption>
        ) : null}
      </figure>
      {captionSide && (photo.kicker || photo.caption) ? (
        <div
          className="flex min-w-0 flex-1 flex-col justify-center gap-1"
          style={{ paddingRight: 4 }}
        >
          {photo.kicker ? (
            <span
              className={style.gameLabelClassName}
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                color: bookColor.dark,
                opacity: 0.75,
              }}
            >
              {photo.kicker}
            </span>
          ) : null}
          {photo.caption ? (
            <span
              className={style.instructionClassName}
              style={{
                fontSize: 12,
                lineHeight: 1.3,
                color: bookColor.dark,
                fontStyle: "normal",
              }}
            >
              {photo.caption}
            </span>
          ) : null}
        </div>
      ) : null}
      {/* index unused except for deterministic future accents */}
      {void index}
    </div>
  )
}
