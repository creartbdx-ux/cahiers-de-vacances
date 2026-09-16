/**
 * @deprecated Free-form collage composition — use selectPhotoTemplate instead.
 * Kept as a thin adapter for older call sites / tests during migration.
 */

import type { PhotoCollageLayoutId, PhotoPageItem } from "./types"
import { classifyPhotoOrientation, type PhotoOrientation } from "./orientation"
import { selectPhotoTemplate } from "./templates/select"

export type Collage3Variant = "HERO_LEFT" | "HERO_TOP" | "HERO_RIGHT"
export type Collage2Variant = "SIDE_BY_SIDE" | "STACKED"
export type Collage4Variant = "GRID_2X2" | "HERO_PLUS_THREE"
export type CollageVariant = Collage3Variant | Collage2Variant | Collage4Variant

export interface EnrichedPhotoItem extends PhotoPageItem {
  orientation: PhotoOrientation
  aspectRatio: number | null
}

export interface CollageComposition {
  layoutId: PhotoCollageLayoutId
  /** Mapped from structural template id for legacy consumers. */
  variant: CollageVariant
  heroPhotoId: string | null
  photos: EnrichedPhotoItem[]
  showPageTitle: boolean
  pageTitle: string | null
  templateId?: string
}

export function enrichPhotoOrientation(
  photo: PhotoPageItem,
  aspectRatio?: number | null,
): EnrichedPhotoItem {
  const ratio = aspectRatio ?? photo.aspectRatio ?? null
  return {
    ...photo,
    aspectRatio: ratio,
    orientation: classifyPhotoOrientation(ratio),
  }
}

function templateToLegacyVariant(templateId: string): CollageVariant {
  if (templateId === "PHOTO_2_A") return "SIDE_BY_SIDE"
  if (templateId === "PHOTO_2_B") return "STACKED"
  if (templateId === "PHOTO_3_A") return "HERO_LEFT"
  if (templateId === "PHOTO_3_B") return "HERO_TOP"
  if (templateId === "PHOTO_3_C") return "HERO_RIGHT"
  if (templateId === "PHOTO_4_B") return "HERO_PLUS_THREE"
  return "GRID_2X2"
}

/**
 * @deprecated Use selectPhotoTemplate.
 */
export function resolveCollageComposition(input: {
  layoutId: PhotoCollageLayoutId
  photos: PhotoPageItem[]
  seed: string
  aspectRatios?: Record<string, number>
}): CollageComposition {
  const selection = selectPhotoTemplate({
    photos: input.photos,
    pageType: "COLLAGE",
    seed: input.seed,
    aspectRatios: input.aspectRatios,
  })
  const hero =
    selection.assignments.find((a) => a.role === "hero")?.sourcePhotoId ?? null
  return {
    layoutId: input.layoutId,
    variant: templateToLegacyVariant(selection.templateId),
    heroPhotoId: hero,
    photos: selection.orderedPhotos,
    showPageTitle: selection.showPageTitle,
    pageTitle: selection.pageTitle,
    templateId: selection.templateId,
  }
}
