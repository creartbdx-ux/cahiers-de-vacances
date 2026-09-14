import type { MemoryDensity, PhotoMemoryLayout } from "@/lib/memory-pages/types"
import type { VisualRole } from "@/lib/book-blueprint/types"

/** Editorial unit from a memory — not yet a page. */
export interface MemoryBlockV1 {
  type: "MEMORY"
  sourceMemoryId: string
  title: string
  body: string
  density: MemoryDensity
  participantIds: string[]
  fullPageRecommended: boolean
  eyebrow?: string | null
  place?: string | null
}

/** Editorial unit from a photo + its metadata — not yet a page. */
export interface PhotoMemoryBlockV1 {
  type: "PHOTO_MEMORY"
  sourcePhotoId: string
  signedUrl: string | null
  caption: string | null
  anecdote: string | null
  title: string
  body: string
  density: MemoryDensity
  aspectRatio?: number
  photoLayout: PhotoMemoryLayout
  participantIds: string[]
  fullPageRecommended: boolean
  weakSource: boolean
  eyebrow?: string | null
}

export type PersonalBlockV1 = MemoryBlockV1 | PhotoMemoryBlockV1

export type PersonalEditorialLayoutId =
  | "PHOTO_PLUS_MEMORY"
  | "TWO_PHOTOS"
  | "TWO_MEMORIES"
  | "THREE_SNIPPETS"
  | "PHOTO_PLUS_TWO_SNIPPETS"
  | "HERO_MEMORY"
  | "HERO_PHOTO_MEMORY"

/**
 * Composed personal page — real Blueprint unit.
 * Blocks share a page editorially; they are NOT fused into one narrative.
 */
export interface PersonalEditorialPageV1 {
  pageKey: string
  layoutId: PersonalEditorialLayoutId
  blocks: PersonalBlockV1[]
  visualRole: VisualRole
  /** Sum of block weights. */
  weight: number
  /** 0–1 fill vs PERSONAL_PAGE_CAPACITY. */
  pageFillScore: number
  /** True when a single true-HERO block occupies the page. */
  isHero: boolean
  /** Why this page is HERO, if applicable. */
  heroReason: string | null
}

export const PERSONAL_PAGE_CAPACITY = 4
export const PERSONAL_PAGE_MAX_BLOCKS = 3
export const PERSONAL_PAGE_MAX_PHOTOS = 2
