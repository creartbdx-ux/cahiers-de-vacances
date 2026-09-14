import type { AudienceType } from "@/lib/questionnaire/types"

/** Raw memory source — always from BookProfile, never invented. */
export interface MemoryPageSource {
  memoryId: string
  participantIds: string[]
  originalText: string
  title?: string
  place?: string
  /**
   * Explicit photo links only. Never filled by participant-overlap heuristics.
   * V1: always empty — MEMORY_TEXT_PAGE stays TEXT_ONLY without an explicit link.
   */
  linkedPhotoIds: string[]
}

/** MEMORY_TEXT_PAGE is always text-only in V1 (no heuristic photo attach). */
export type MemoryPageVariant = "TEXT_ONLY"

/** App-computed density of the selected memory (not LLM). */
export type MemoryDensity = "SHORT" | "MEDIUM" | "RICH"

export interface MemoryPageEditorial {
  title: string
  eyebrow: string | null
  body: string
  sourceMemoryId: string
  /** Always empty for MEMORY_TEXT_PAGE V1. */
  sourcePhotoIds: string[]
  place: string | null
  variant: MemoryPageVariant
  density: MemoryDensity
  /** False for SHORT — weak full-page candidate. */
  fullPageRecommended: boolean
  /** True when LLM reformulated; false for deterministic fallback. */
  usedAi: boolean
  audience: AudienceType
}

export interface BuildMemoryPageResult {
  ok: true
  source: MemoryPageSource
  editorial: MemoryPageEditorial
  /** Always null for MEMORY_TEXT_PAGE V1. */
  photo: null
  density: MemoryDensity
  fullPageRecommended: boolean
}

export interface BuildMemoryPageFailure {
  ok: false
  code: "NO_MEMORY" | "VALIDATION_FAILED" | "FORBIDDEN"
  message: string
  details?: string[]
}

export type MemoryPageBuildResult = BuildMemoryPageResult | BuildMemoryPageFailure

export const MEMORY_PAGE_FALLBACK_TITLE = "Un souvenir à garder"
/** Absolute ceiling — real cap is density-proportional via maxBodyWordsForSource. */
export const MEMORY_PAGE_MAX_BODY_WORDS = 140

// ---------------------------------------------------------------------------
// PHOTO_MEMORY_PAGE — separate editorial source (book photo metadata)
// ---------------------------------------------------------------------------

/**
 * Editorial source for PHOTO_MEMORY_PAGE.
 * Fields mirror public.book_photos + questionnaire photo metadata (no invention).
 */
export interface PhotoMemorySourceV1 {
  photoId: string
  storagePath: string
  signedUrl: string | null
  participantIds: string[]
  caption: string | null
  anecdote: string | null
  /** Always true for selected sources (use_authorized). */
  authorization: true
  /** width / height when known from client metadata; omit if unknown. */
  aspectRatio?: number
}

export type PhotoMemoryLayout = "LANDSCAPE" | "PORTRAIT" | "SQUARE"

export interface PhotoMemoryEditorial {
  title: string
  eyebrow: string | null
  body: string
  sourcePhotoId: string
  density: MemoryDensity
  layout: PhotoMemoryLayout
  fullPageRecommended: boolean
  usedAi: boolean
  audience: AudienceType
  /** True when caption and anecdote are both empty. */
  weakSource: boolean
}

export interface BuildPhotoMemoryPageResult {
  ok: true
  source: PhotoMemorySourceV1
  editorial: PhotoMemoryEditorial
  density: MemoryDensity
  fullPageRecommended: boolean
}

export interface BuildPhotoMemoryPageFailure {
  ok: false
  code: "NO_PHOTO" | "VALIDATION_FAILED" | "FORBIDDEN"
  message: string
  details?: string[]
}

export type PhotoMemoryPageBuildResult =
  | BuildPhotoMemoryPageResult
  | BuildPhotoMemoryPageFailure

export const PHOTO_MEMORY_FALLBACK_TITLE = "Un moment à garder"
export const PHOTO_MEMORY_MAX_BODY_WORDS = 140
