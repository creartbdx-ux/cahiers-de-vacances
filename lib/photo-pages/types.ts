/** Photo album / Polaroid pages — photos only, no independent memory injection. */

import type { PhotoOrientation } from "./orientation"

export type { PhotoOrientation }

export type PhotoCollageLayoutId = "COLLAGE_2" | "COLLAGE_3" | "COLLAGE_4"

export type PhotoPageKind = "COLLAGE" | "TIMELINE"

export interface PhotoPageItem {
  sourcePhotoId: string
  imageUrl: string
  /** Short kicker / place (1–2 words). */
  kicker: string | null
  /** Single short phrase under the photo. */
  caption: string | null
  /** @deprecated Prefer a single caption line — kept null by buildPhotoCaption. */
  anecdote: string | null
  place: string | null
  /** ISO date or year string when reliably known — never invented. */
  dateLabel: string | null
  /** Sort key when date known (null = undated). */
  sortKey: number | null
  participantIds: string[]
  /** Optional width/height ratio when known. */
  aspectRatio?: number | null
  /** Derived orientation for layout (optional until composition). */
  orientation?: PhotoOrientation
}

export interface PhotoCollagePageV1 {
  pageKey: string
  kind: "COLLAGE"
  layoutId: PhotoCollageLayoutId
  photos: PhotoPageItem[]
}

export interface PhotoTimelinePageV1 {
  pageKey: string
  kind: "TIMELINE"
  photos: PhotoPageItem[]
}

export type PhotoPageV1 = PhotoCollagePageV1 | PhotoTimelinePageV1

export interface PlanPhotoPagesResult {
  pages: PhotoPageV1[]
  usedPhotoIds: string[]
  unusedPhotoIds: string[]
}
