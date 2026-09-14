import type { BookProfileV1 } from "@/lib/questionnaire/types"
import type { ContentGenerationProvider } from "@/lib/content-generation/types"
import { createDefaultContentGenerationProvider } from "@/lib/content-generation/provider"
import { buildPersonalEditorialAudienceContext } from "./audience-context"
import { collectPersonalBlocks } from "./editorialize-block"
import { composePersonalEditorialPages } from "./compose"
import {
  editorializeComposedPersonalPages,
  type PersonalEditorialMode,
  type PageEditorialResult,
} from "./page-ai-copy"
import type { PersonalEditorialPageV1 } from "./types"

export interface ComposePersonalEditorialWithAiResult {
  pages: PersonalEditorialPageV1[]
  /** Packed pages before AI copy (stable for « Régénérer la rédaction »). */
  packedPages: PersonalEditorialPageV1[]
  blockCount: number
  pageCount: number
  overallMode: PersonalEditorialMode | "MIXED"
  aiCallCount: number
  aiConfigured: boolean
  results: PageEditorialResult[]
  fallbackBanner: boolean
}

/**
 * Full Lab/production pipeline:
 * sources → fact model blocks → packing → page-level AI copy → validation.
 */
export async function composePersonalEditorialWithAi(input: {
  profile: BookProfileV1
  seed: string
  photoSignedUrls?: Record<string, string>
  aspectRatios?: Record<string, number>
  maxMemories?: number
  maxPhotos?: number
  creatorName?: string | null
  provider?: ContentGenerationProvider
  forceFallback?: boolean
  /**
   * If provided, skip packing and only re-run AI copy on these pages.
   * Used by « Régénérer la rédaction ».
   */
  packedPages?: PersonalEditorialPageV1[]
}): Promise<ComposePersonalEditorialWithAiResult> {
  const provider = input.provider ?? createDefaultContentGenerationProvider()
  const ctx = buildPersonalEditorialAudienceContext(input.profile, {
    creatorName: input.creatorName,
  })

  let packedPages = input.packedPages
  let blockCount = 0

  if (!packedPages) {
    const blocks = collectPersonalBlocks({
      profile: input.profile,
      photoSignedUrls: input.photoSignedUrls,
      aspectRatios: input.aspectRatios,
      maxMemories: input.maxMemories,
      maxPhotos: input.maxPhotos,
      creatorName: input.creatorName,
    })
    blockCount = blocks.length
    packedPages = composePersonalEditorialPages(
      blocks,
      `${input.seed}:personal-editorial`,
    ).map((p) => ({
      ...p,
      editorialMode: "FALLBACK" as const,
      pageKicker: null,
      pageIntro: null,
    }))
  } else {
    blockCount = packedPages.reduce((n, p) => n + p.blocks.length, 0)
  }

  const forceFallback = input.forceFallback || !provider.configured
  const edited = await editorializeComposedPersonalPages({
    pages: packedPages,
    ctx,
    seed: `${input.seed}:ai-copy`,
    provider,
    forceFallback,
  })

  return {
    pages: edited.pages,
    packedPages,
    blockCount,
    pageCount: edited.pages.length,
    overallMode: forceFallback ? "FALLBACK" : edited.overallMode,
    aiCallCount: forceFallback ? 0 : edited.aiCallCount,
    aiConfigured: provider.configured,
    results: edited.results,
    fallbackBanner: forceFallback || edited.overallMode !== "AI",
  }
}
