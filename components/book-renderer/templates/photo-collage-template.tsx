import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { Palette } from "@/lib/supabase/types"
import type { PhotoCollageLayoutId, PhotoPageItem, PhotoPageV1 } from "@/lib/photo-pages"
import type { PhotoTemplateId } from "@/lib/photo-pages/templates/types"
import type { PhotoTemplateSelection } from "@/lib/photo-pages/templates/select"
import { PhotoPageTemplateView } from "./photo-page-template"

/**
 * PHOTO_COLLAGE_PAGE — renders via structural photo templates.
 */
export function PhotoCollageTemplate({
  layoutId,
  photos,
  style,
  palette,
  visualRole = "LIGHT",
  seed = "photo-collage",
  aspectRatios,
  forceTemplateId,
  selection,
  pageKey = "collage",
  templateId,
}: {
  layoutId: PhotoCollageLayoutId
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
  void layoutId
  const page: PhotoPageV1 = {
    pageKey,
    kind: "COLLAGE",
    layoutId,
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
