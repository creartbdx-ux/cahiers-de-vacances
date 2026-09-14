import type { AudienceType } from "@/lib/questionnaire/types"

/** Raw memory source — always from BookProfile, never invented. */
export interface MemoryPageSource {
  memoryId: string
  participantIds: string[]
  originalText: string
  title?: string
  place?: string
  /** Profile photo ids (authorized + storage) linked by participant overlap. */
  linkedPhotoIds: string[]
}

export type MemoryPageVariant = "PHOTO" | "TEXT_ONLY"

export interface MemoryPageEditorial {
  title: string
  eyebrow: string | null
  body: string
  sourceMemoryId: string
  sourcePhotoIds: string[]
  place: string | null
  variant: MemoryPageVariant
  /** True when LLM reformulated; false for deterministic fallback. */
  usedAi: boolean
  audience: AudienceType
}

export interface MemoryPagePhotoRef {
  photoId: string
  signedUrl: string | null
  caption?: string
}

export interface BuildMemoryPageResult {
  ok: true
  source: MemoryPageSource
  editorial: MemoryPageEditorial
  photo: MemoryPagePhotoRef | null
}

export interface BuildMemoryPageFailure {
  ok: false
  code: "NO_MEMORY" | "VALIDATION_FAILED" | "FORBIDDEN"
  message: string
  details?: string[]
}

export type MemoryPageBuildResult = BuildMemoryPageResult | BuildMemoryPageFailure

export const MEMORY_PAGE_FALLBACK_TITLE = "Un souvenir à garder"
export const MEMORY_PAGE_MAX_BODY_WORDS = 140
export const MEMORY_PAGE_MIN_BODY_WORDS = 12
