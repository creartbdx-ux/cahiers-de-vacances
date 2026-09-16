/** Photo album / Polaroid pages — photos only, no independent memory injection. */

export type PhotoCollageLayoutId = "COLLAGE_2" | "COLLAGE_3" | "COLLAGE_4"

export type PhotoPageKind = "COLLAGE" | "TIMELINE"

export interface PhotoPageItem {
  sourcePhotoId: string
  imageUrl: string
  /** Short kicker / place (1–2 words). */
  kicker: string | null
  /** 1–2 line caption under the photo. */
  caption: string | null
  /** Optional short anecdote (1 line). */
  anecdote: string | null
  place: string | null
  /** ISO date or year string when reliably known — never invented. */
  dateLabel: string | null
  /** Sort key when date known (null = undated). */
  sortKey: number | null
  participantIds: string[]
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
