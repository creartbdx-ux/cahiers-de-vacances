/** Structural photo page templates — geometry only (no colors). */

import type { PhotoOrientation } from "../orientation"
import type { PhotoPageKind } from "../types"

export type PhotoTemplateId =
  | "PHOTO_2_A"
  | "PHOTO_2_B"
  | "PHOTO_3_A"
  | "PHOTO_3_B"
  | "PHOTO_3_C"
  | "PHOTO_4_A"
  | "PHOTO_4_B"
  | "PHOTO_TIMELINE_3_A"
  | "PHOTO_TIMELINE_4_A"

export type PhotoSlotCaptionMode =
  | "BELOW"
  | "POLAROID_BOTTOM"
  | "SIDE"
  | "NONE"

export type PhotoSlotRole = "hero" | "secondary" | "timeline"

/**
 * Percent of the page content box (0–100).
 * Deterministic print geometry — not free-form layout.
 */
export interface PhotoSlotDefinition {
  id: string
  role: PhotoSlotRole
  x: number
  y: number
  width: number
  height: number
  /** Fixed rotation in degrees for this slot. */
  rotationDeg: number
  imageFit: "cover" | "contain"
  preferredOrientations: PhotoOrientation[]
  captionMode: PhotoSlotCaptionMode
}

export interface PhotoPageTitleSlot {
  x: number
  y: number
  width: number
  height: number
}

export interface PhotoPageTemplateDefinition {
  id: PhotoTemplateId
  label: string
  pageType: PhotoPageKind
  photoCount: number
  slots: PhotoSlotDefinition[]
  pageTitleSlot: PhotoPageTitleSlot | null
  /** Soft orientation patterns this template prefers (for scoring). */
  supportedOrientationPatterns: Array<{
    landscapes?: number
    portraits?: number
    squares?: number
    weight: number
  }>
}
