import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { ContentGenerationProvider } from "@/lib/content-generation/types"
import { editorializePhotoMemoryPage } from "./editorialize-photo"
import {
  classifyPhotoMemoryDensity,
  recommendFullPhotoMemoryPage,
} from "./photo-layout"
import {
  selectPhotoForMemoryPage,
  selectPhotoMemorySource,
} from "./select-photo"
import type {
  BuildPhotoMemoryPageFailure,
  PhotoMemoryPageBuildResult,
  PhotoMemorySourceV1,
} from "./types"
import { validatePhotoMemoryEditorial } from "./validate-photo"

export interface BuildPhotoMemoryPageInput {
  profile: BookProfileV1
  seed: string
  /** Explicit photo id; otherwise selected among authorized+stored. */
  photoId?: string
  usedPhotoIds?: ReadonlySet<string> | string[]
  photoSignedUrls?: Record<string, string>
  /** Optional width/height ratios by photo id. */
  aspectRatios?: Record<string, number>
  provider?: ContentGenerationProvider
  forceFallback?: boolean
}

/**
 * PHOTO_MEMORY_PAGE build from a persisted authorized photo + its own metadata.
 * Never attaches an independent memory. Works without IA.
 */
export async function buildPhotoMemoryPage(
  input: BuildPhotoMemoryPageInput,
): Promise<PhotoMemoryPageBuildResult> {
  let source: PhotoMemorySourceV1 | null = null

  if (input.photoId) {
    source = selectPhotoMemorySource({
      profile: input.profile,
      photoId: input.photoId,
      photoSignedUrls: input.photoSignedUrls,
      aspectRatios: input.aspectRatios,
    })
  } else {
    source = selectPhotoForMemoryPage({
      profile: input.profile,
      seed: input.seed,
      usedPhotoIds: input.usedPhotoIds,
      photoSignedUrls: input.photoSignedUrls,
      aspectRatios: input.aspectRatios,
    })
  }

  if (!source) {
    return fail("NO_PHOTO", "Aucune photo autorisée et persistée utilisable.")
  }

  const density = classifyPhotoMemoryDensity(source)
  const hasRenderablePhoto = Boolean(source.signedUrl)
  const fullPageRecommended = recommendFullPhotoMemoryPage({
    source,
    hasRenderablePhoto,
  })

  const editorial = await editorializePhotoMemoryPage({
    source,
    profile: input.profile,
    seed: input.seed,
    provider: input.provider,
    forceFallback: input.forceFallback,
  })

  const validation = validatePhotoMemoryEditorial({
    editorial,
    source,
    profile: input.profile,
  })
  if (!validation.ok) {
    return fail("VALIDATION_FAILED", "Éditorialisation photo invalide.", validation.errors)
  }

  return {
    ok: true,
    source,
    editorial: {
      ...editorial,
      density,
      fullPageRecommended,
      sourcePhotoId: source.photoId,
    },
    density,
    fullPageRecommended,
  }
}

function fail(
  code: BuildPhotoMemoryPageFailure["code"],
  message: string,
  details?: string[],
): BuildPhotoMemoryPageFailure {
  return { ok: false, code, message, details }
}
