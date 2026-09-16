import type { BookProfileV1, QuestionnairePhoto } from "@/lib/questionnaire/types"
import type {
  PhotoCollageLayoutId,
  PhotoPageItem,
  PhotoPageV1,
  PlanPhotoPagesResult,
} from "./types"
import { editorializePhotoCopy } from "./copy"

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Photos SAVED (storagePath) + authorized only. */
export function usableAlbumPhotos(profile: BookProfileV1): QuestionnairePhoto[] {
  return (profile.photos ?? []).filter(
    (p) => p.useAuthorized && Boolean(p.storagePath?.trim()),
  )
}

/**
 * Extract a reliable date label from photo metadata or text.
 * Never invents — only explicit years / takenAt.
 */
export function extractReliableDate(photo: QuestionnairePhoto): {
  dateLabel: string | null
  sortKey: number | null
} {
  const takenAt = (photo as QuestionnairePhoto & { takenAt?: string }).takenAt?.trim()
  if (takenAt) {
    const y = takenAt.match(/\b((?:19|20)\d{2})\b/)
    if (y) {
      const year = Number(y[1])
      const full = Date.parse(takenAt)
      return {
        dateLabel: Number.isFinite(full) ? String(year) : y[1]!,
        sortKey: Number.isFinite(full) ? full : year * 10000,
      }
    }
  }
  const blob = [photo.caption, photo.anecdote].filter(Boolean).join("\n")
  const years = [...blob.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1]))
  if (years.length === 1) {
    const year = years[0]!
    return { dateLabel: String(year), sortKey: year * 10000 }
  }
  return { dateLabel: null, sortKey: null }
}

export function extractPhotoPlace(photo: QuestionnairePhoto): string | null {
  const place = (photo as QuestionnairePhoto & { place?: string }).place?.trim()
  if (place) return place
  const caption = photo.caption?.trim() || ""
  const m = caption.match(
    /\b(?:à|au|en|sur)\s+([A-ZÀ-Ü][\wÀ-ÿ' -]{1,40}?)(?:\s+pendant|\s+lors|\.|,|$)/,
  )
  if (m?.[1]) return m[1].trim()
  return null
}

function resolveImageUrl(
  photo: QuestionnairePhoto,
  urlById?: Record<string, string>,
): string {
  return (
    urlById?.[photo.id] ||
    photo.previewDataUrl ||
    (photo.storagePath ? `photo://${photo.storagePath}` : "")
  )
}

export function toPhotoPageItem(
  photo: QuestionnairePhoto,
  urlById?: Record<string, string>,
): PhotoPageItem {
  const { dateLabel, sortKey } = extractReliableDate(photo)
  const place = extractPhotoPlace(photo)
  const copy = editorializePhotoCopy({
    caption: photo.caption ?? null,
    anecdote: photo.anecdote ?? null,
    place,
  })
  return {
    sourcePhotoId: photo.id,
    imageUrl: resolveImageUrl(photo, urlById),
    kicker: copy.kicker,
    caption: copy.caption,
    anecdote: copy.anecdote,
    place,
    dateLabel,
    sortKey,
    participantIds: photo.participantIds ?? [],
  }
}

function isStrongSinglePhoto(item: PhotoPageItem): boolean {
  const text = [item.caption, item.anecdote, item.kicker].filter(Boolean).join(" ")
  return text.trim().length >= 24 || Boolean(item.anecdote?.trim())
}

function collageLayoutForCount(n: number): PhotoCollageLayoutId {
  if (n <= 2) return "COLLAGE_2"
  if (n === 3) return "COLLAGE_3"
  return "COLLAGE_4"
}

/**
 * Split N photos into page sizes (max 4 per page). Deterministic.
 */
export function splitPhotoCounts(n: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [1]
  if (n <= 4) return [n]
  const pages: number[] = []
  let left = n
  while (left > 0) {
    if (left === 5) {
      pages.push(3, 2)
      break
    }
    if (left === 6) {
      pages.push(3, 3)
      break
    }
    if (left === 7) {
      pages.push(4, 3)
      break
    }
    if (left === 8) {
      pages.push(4, 4)
      break
    }
    if (left === 9) {
      pages.push(3, 3, 3)
      break
    }
    const take = Math.min(4, left)
    if (left - take === 1 && take === 4) {
      pages.push(3)
      left -= 3
      continue
    }
    pages.push(take)
    left -= take
  }
  return pages
}

function canBuildTimeline(items: PhotoPageItem[]): boolean {
  const dated = items.filter((p) => p.sortKey != null && p.dateLabel)
  return dated.length >= 2
}

/**
 * Plan photo album pages from authorized+saved photos.
 * No independent memories are injected.
 */
export function planPhotoPages(input: {
  photos: QuestionnairePhoto[]
  seed: string
  urlById?: Record<string, string>
  allowStrongSingle?: boolean
}): PlanPhotoPagesResult {
  const { seed, urlById } = input
  const allowStrongSingle = input.allowStrongSingle ?? false
  const usable = input.photos.filter(
    (p) => p.useAuthorized && Boolean(p.storagePath?.trim()),
  )
  const ordered = [...usable].sort((a, b) => {
    const da = hash(`${seed}:photo:${a.id}`)
    const db = hash(`${seed}:photo:${b.id}`)
    return da - db || a.id.localeCompare(b.id)
  })

  const items = ordered.map((p) => toPhotoPageItem(p, urlById))
  if (!items.length) {
    return { pages: [], usedPhotoIds: [], unusedPhotoIds: [] }
  }

  if (items.length === 1) {
    if (!allowStrongSingle || !isStrongSinglePhoto(items[0]!)) {
      return {
        pages: [],
        usedPhotoIds: [],
        unusedPhotoIds: items.map((i) => i.sourcePhotoId),
      }
    }
  }

  const counts = splitPhotoCounts(items.length)
  const pages: PhotoPageV1[] = []
  let offset = 0
  let pageIndex = 0

  for (const count of counts) {
    const slice = items.slice(offset, offset + count)
    offset += count
    if (!slice.length) continue

    const preferTimeline = canBuildTimeline(slice) && slice.length >= 2
    if (preferTimeline) {
      const timed = [...slice].sort((a, b) => {
        const sa = a.sortKey ?? Number.MAX_SAFE_INTEGER
        const sb = b.sortKey ?? Number.MAX_SAFE_INTEGER
        return sa - sb || a.sourcePhotoId.localeCompare(b.sourcePhotoId)
      })
      if (timed.every((p) => p.sortKey != null)) {
        pages.push({
          pageKey: `photo:${seed}:${pageIndex}`,
          kind: "TIMELINE",
          photos: timed,
        })
        pageIndex++
        continue
      }
    }

    pages.push({
      pageKey: `photo:${seed}:${pageIndex}`,
      kind: "COLLAGE",
      layoutId: collageLayoutForCount(slice.length),
      photos: slice,
    })
    pageIndex++
  }

  const usedPhotoIds = pages.flatMap((p) => p.photos.map((x) => x.sourcePhotoId))
  const used = new Set(usedPhotoIds)
  return {
    pages,
    usedPhotoIds,
    unusedPhotoIds: items
      .map((i) => i.sourcePhotoId)
      .filter((id) => !used.has(id)),
  }
}

export function planPhotoPagesFromProfile(
  profile: BookProfileV1,
  seed: string,
  urlById?: Record<string, string>,
): PlanPhotoPagesResult {
  return planPhotoPages({
    photos: usableAlbumPhotos(profile),
    seed,
    urlById,
  })
}
