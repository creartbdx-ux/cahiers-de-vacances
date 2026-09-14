import type { BookProfileV1 } from "@/lib/questionnaire/types"
import {
  classifyMemoryDensity,
  recommendFullMemoryPage,
  toMemoryPageSource,
  editorializeMemoryPageFallback,
} from "@/lib/memory-pages"
import {
  classifyPhotoMemoryDensity,
  classifyPhotoMemoryLayout,
  recommendFullPhotoMemoryPage,
  toPhotoMemorySource,
  editorializePhotoMemoryPageFallback,
} from "@/lib/memory-pages"
import type { MemoryBlockV1, PhotoMemoryBlockV1, PersonalBlockV1 } from "./types"

/** Build a MemoryBlock from a profile memory (fallback editorial, no IA). */
export function memoryToBlock(
  memory: BookProfileV1["memories"][number],
  profile: BookProfileV1,
): MemoryBlockV1 | null {
  const source = toMemoryPageSource(memory)
  if (!source) return null
  const density = classifyMemoryDensity({ source })
  const editorial = editorializeMemoryPageFallback({
    source,
    audience: profile.audience,
  })
  return {
    type: "MEMORY",
    sourceMemoryId: source.memoryId,
    title: editorial.title,
    body: editorial.body,
    density,
    participantIds: [...source.participantIds],
    fullPageRecommended: recommendFullMemoryPage({ density }),
    eyebrow: editorial.eyebrow,
    place: editorial.place,
  }
}

/** Build a PhotoMemoryBlock from a profile photo (fallback editorial, no IA). */
export function photoToBlock(
  photo: BookProfileV1["photos"][number],
  profile: BookProfileV1,
  signedUrl: string | null = null,
  aspectRatio?: number,
): PhotoMemoryBlockV1 | null {
  const source = toPhotoMemorySource(photo, signedUrl, aspectRatio)
  if (!source) return null
  const density = classifyPhotoMemoryDensity(source)
  const editorial = editorializePhotoMemoryPageFallback({
    source,
    audience: profile.audience,
  })
  return {
    type: "PHOTO_MEMORY",
    sourcePhotoId: source.photoId,
    signedUrl: source.signedUrl,
    caption: source.caption,
    anecdote: source.anecdote,
    title: editorial.title,
    body: editorial.body,
    density,
    aspectRatio: source.aspectRatio,
    photoLayout: classifyPhotoMemoryLayout(source.aspectRatio),
    participantIds: [...source.participantIds],
    fullPageRecommended: recommendFullPhotoMemoryPage({
      source,
      hasRenderablePhoto: Boolean(source.signedUrl),
    }),
    weakSource: editorial.weakSource,
    eyebrow: editorial.eyebrow,
  }
}

/**
 * Collect all usable personal blocks from a profile (deterministic order).
 * Weak photos (no caption/anecdote) are included but marked weak / not full-page.
 */
export function collectPersonalBlocks(input: {
  profile: BookProfileV1
  photoSignedUrls?: Record<string, string>
  aspectRatios?: Record<string, number>
  /** Cap memories included (blueprint soft budget). */
  maxMemories?: number
  maxPhotos?: number
}): PersonalBlockV1[] {
  const memories = (input.profile.memories ?? []).filter((m) => m.text?.trim())
  const photos = (input.profile.photos ?? []).filter(
    (p) => p.useAuthorized && Boolean(p.storagePath),
  )

  const memLimit = input.maxMemories ?? memories.length
  const photoLimit = input.maxPhotos ?? photos.length

  const out: PersonalBlockV1[] = []

  for (const m of memories.slice(0, memLimit)) {
    const block = memoryToBlock(m, input.profile)
    if (block) out.push(block)
  }

  for (const p of photos.slice(0, photoLimit)) {
    const block = photoToBlock(
      p,
      input.profile,
      input.photoSignedUrls?.[p.id] ?? null,
      input.aspectRatios?.[p.id],
    )
    if (block) out.push(block)
  }

  return out
}
