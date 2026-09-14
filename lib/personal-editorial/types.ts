import type { MemoryDensity, PhotoMemoryLayout } from "@/lib/memory-pages/types"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { PersonalFactPerspective } from "./perspective"
import type { PersonalSemanticCategory } from "./semantic"

/** Editorial unit from a memory — not yet a page. */
export interface MemoryBlockV1 {
  type: "MEMORY"
  sourceMemoryId: string
  /** Raw questionnaire text — debug / provenance only. */
  originalText: string
  title: string
  body: string
  density: MemoryDensity
  participantIds: string[]
  fullPageRecommended: boolean
  eyebrow?: string | null
  place?: string | null
  /** Editorial layer */
  kicker?: string | null
  shortTitle?: string | null
  displayText: string
  semanticCategory: PersonalSemanticCategory
  semanticTags: string[]
  locations: string[]
  trips: string[]
  perspective: PersonalFactPerspective
  attributedQuote: boolean
  usedAi: boolean
}

/** Editorial unit from a photo + its metadata — not yet a page. */
export interface PhotoMemoryBlockV1 {
  type: "PHOTO_MEMORY"
  sourcePhotoId: string
  signedUrl: string | null
  /** Raw caption/anecdote — debug. */
  caption: string | null
  anecdote: string | null
  originalText: string
  title: string
  body: string
  density: MemoryDensity
  aspectRatio?: number
  photoLayout: PhotoMemoryLayout
  participantIds: string[]
  fullPageRecommended: boolean
  weakSource: boolean
  eyebrow?: string | null
  kicker?: string | null
  shortTitle?: string | null
  displayText: string
  semanticCategory: PersonalSemanticCategory
  semanticTags: string[]
  locations: string[]
  trips: string[]
  perspective: PersonalFactPerspective
  attributedQuote: boolean
  usedAi: boolean
}

export type PersonalBlockV1 = MemoryBlockV1 | PhotoMemoryBlockV1

/** Packing shape (capacity rules). */
export type PersonalEditorialLayoutId =
  | "PHOTO_PLUS_MEMORY"
  | "TWO_PHOTOS"
  | "TWO_MEMORIES"
  | "THREE_SNIPPETS"
  | "PHOTO_PLUS_TWO_SNIPPETS"
  | "HERO_MEMORY"
  | "HERO_PHOTO_MEMORY"
  | "SINGLE_MEMORY"
  | "SINGLE_PHOTO_MEMORY"

/** Visual editorial family (V1 — 3 + hero/single). */
export type PersonalEditorialFamily =
  | "FEATURE_NOTES"
  | "STORY_STRIP"
  | "MOSAIC_EDITORIAL"
  | "HERO"
  | "SINGLE"

export type PhotoPlusMemoryVariant = "STACK" | "ASYMMETRIC"

export type PersonalPageThemeType =
  | "THEMED"
  | "NEUTRAL_MOMENTS"
  | "HERO"
  | "SINGLE"

export interface PersonalEditorialPageTheme {
  themeType: PersonalPageThemeType
  title: string
  subtitle?: string | null
  semanticTags: string[]
  sourceIds: string[]
  groupingReason: string
}

/**
 * Composed personal page — real Blueprint unit.
 * Blocks share a page editorially; they are NOT fused into one narrative.
 */
export interface PersonalEditorialPageV1 {
  pageKey: string
  layoutId: PersonalEditorialLayoutId
  editorialFamily: PersonalEditorialFamily
  theme: PersonalEditorialPageTheme
  blocks: PersonalBlockV1[]
  visualRole: VisualRole
  weight: number
  packingFillScore: number
  /** @deprecated Alias of packingFillScore — packing only. */
  pageFillScore: number
  isHero: boolean
  heroReason: string | null
  layoutVariant?: PhotoPlusMemoryVariant | null
  /** Mean pairwise semantic compatibility (0–1). */
  compatibilityScore: number
}

export const PERSONAL_PAGE_CAPACITY = 4
export const PERSONAL_PAGE_MAX_BLOCKS = 3
export const PERSONAL_PAGE_MAX_PHOTOS = 2
