import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { PhotoPageItem, PhotoPageV1 } from "@/lib/photo-pages"
import type { PhotoTemplateId } from "@/lib/photo-pages/templates/types"
import type { PhotoTemplateSelection } from "@/lib/photo-pages/templates/select"
import { PhotoPageTemplateView } from "./photo-page-template"

/**
 * PHOTO_TIMELINE_PAGE — structural timeline templates only.
 */
export function PhotoTimelineTemplate({
  photos,
  style,
  palette,
  visualRole = "LIGHT",
  seed = "photo-timeline",
  aspectRatios,
  forceTemplateId,
  selection,
  pageKey = "timeline",
  templateId,
}: {
  photos: PhotoPageItem[]
  style: BookStyleTokens
  palette: Palette
  visualRole?: VisualRole
  seed?: string
  aspectRatios?: Record<string, number>
  forceTemplateId?: PhotoTemplateId | null
  selection?: PhotoTemplateSelection
  pageKey?: string
  templateId?: PhotoTemplateId
}) {
  const page: PhotoPageV1 = {
    pageKey,
    kind: "TIMELINE",
    templateId,
    photos,
  }
  return (
    <PhotoPageTemplateView
      page={page}
      style={style}
      palette={palette}
      visualRole={visualRole}
      seed={seed}
      aspectRatios={aspectRatios}
      forceTemplateId={forceTemplateId}
      selection={selection}
    />
  )
}
