import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { ContentGenerationProvider } from "@/lib/content-generation/types"
import { editorializeMemoryPage } from "./editorialize"
import { selectMemoryForPage, toMemoryPageSource } from "./select-memory"
import type {
  BuildMemoryPageFailure,
  MemoryPageBuildResult,
  MemoryPagePhotoRef,
  MemoryPageSource,
} from "./types"
import { validateMemoryEditorial } from "./validate"

export interface BuildMemoryPageInput {
  profile: BookProfileV1
  seed: string
  /** Explicit memory id; otherwise selected deterministically. */
  memoryId?: string
  usedMemoryIds?: ReadonlySet<string> | string[]
  /** Map photoId → signed URL (optional). */
  photoSignedUrls?: Record<string, string>
  provider?: ContentGenerationProvider
  forceFallback?: boolean
}

/**
 * Full MEMORY_PAGE build: select → editorialize → validate.
 * Never invents a memory. Works without IA.
 */
export async function buildMemoryPage(
  input: BuildMemoryPageInput,
): Promise<MemoryPageBuildResult> {
  let source: MemoryPageSource | null = null

  if (input.memoryId) {
    const memory = input.profile.memories.find((m) => m.id === input.memoryId)
    if (!memory) {
      return fail("NO_MEMORY", "Souvenir introuvable dans le profil.")
    }
    source = toMemoryPageSource(memory, input.profile)
  } else {
    source = selectMemoryForPage({
      profile: input.profile,
      seed: input.seed,
      usedMemoryIds: input.usedMemoryIds,
    })
  }

  if (!source) {
    return fail("NO_MEMORY", "Aucun souvenir utilisable dans le profil.")
  }

  const photoId = source.linkedPhotoIds[0] ?? null
  const editorial = await editorializeMemoryPage({
    source,
    profile: input.profile,
    seed: input.seed,
    photoId,
    provider: input.provider,
    forceFallback: input.forceFallback,
  })

  const validation = validateMemoryEditorial({
    editorial,
    source,
    profile: input.profile,
  })
  if (!validation.ok) {
    return fail("VALIDATION_FAILED", "Éditorialisation invalide.", validation.errors)
  }

  let photo: MemoryPagePhotoRef | null = null
  if (photoId) {
    const profilePhoto = input.profile.photos.find((p) => p.id === photoId)
    photo = {
      photoId,
      signedUrl: input.photoSignedUrls?.[photoId] ?? null,
      caption: profilePhoto?.caption,
    }
  }

  // Without a usable signed URL, render TEXT_ONLY (never a "photo manquante" placeholder).
  const canShowPhoto = Boolean(photo?.signedUrl)
  const resolvedEditorial = {
    ...editorial,
    variant: (canShowPhoto ? "PHOTO" : "TEXT_ONLY") as typeof editorial.variant,
    sourcePhotoIds: canShowPhoto && photo ? [photo.photoId] : [],
  }

  return {
    ok: true,
    source,
    editorial: resolvedEditorial,
    photo: canShowPhoto ? photo : null,
  }
}

function fail(
  code: BuildMemoryPageFailure["code"],
  message: string,
  details?: string[],
): BuildMemoryPageFailure {
  return { ok: false, code, message, details }
}
