import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { ContentGenerationProvider } from "@/lib/content-generation/types"
import { editorializeMemoryPage } from "./editorialize"
import {
  classifyMemoryDensity,
  recommendFullMemoryPage,
} from "./density"
import { selectMemoryForPage, toMemoryPageSource } from "./select-memory"
import type {
  BuildMemoryPageFailure,
  MemoryPageBuildResult,
  MemoryPageSource,
} from "./types"
import { validateMemoryEditorial } from "./validate"

export interface BuildMemoryPageInput {
  profile: BookProfileV1
  seed: string
  /** Explicit memory id; otherwise selected deterministically. */
  memoryId?: string
  usedMemoryIds?: ReadonlySet<string> | string[]
  provider?: ContentGenerationProvider
  forceFallback?: boolean
}

/**
 * MEMORY_TEXT_PAGE build: select → density → editorialize → validate.
 * Never invents a memory. Never attaches an unrelated photo.
 * Always TEXT_ONLY in V1.
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
    source = toMemoryPageSource(memory)
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

  const density = classifyMemoryDensity({ source })
  const fullPageRecommended = recommendFullMemoryPage({ density })

  const editorial = await editorializeMemoryPage({
    source,
    profile: input.profile,
    seed: input.seed,
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

  const resolvedEditorial = {
    ...editorial,
    density,
    fullPageRecommended,
    variant: "TEXT_ONLY" as const,
    sourcePhotoIds: [] as string[],
  }

  return {
    ok: true,
    source,
    editorial: resolvedEditorial,
    photo: null,
    density,
    fullPageRecommended,
  }
}

function fail(
  code: BuildMemoryPageFailure["code"],
  message: string,
  details?: string[],
): BuildMemoryPageFailure {
  return { ok: false, code, message, details }
}
