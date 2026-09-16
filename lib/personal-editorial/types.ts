import type { MemoryDensity, PhotoMemoryLayout } from "@/lib/memory-pages/types"
import type { VisualRole } from "@/lib/book-blueprint/types"
import type { EditorialPerspectiveV2 } from "./editorial-copy"
import type { PersonalSourceFacts } from "./facts"
import type { PersonalSemanticCategory } from "./semantic"

/** @deprecated Prefer EditorialPerspectiveV2 on blocks. */
export type PersonalFactPerspective =
  | "CREATOR_PERSPECTIVE_FACT"
  | "RECIPIENT_FACT"
  | "SHARED_FACT"
  | "CREATOR_ATTRIBUTED"
  | "RECIPIENT"
  | "SHARED"
  | "NEUTRAL_EDITORIAL"

interface PersonalBlockEditorialFields {
  originalText: string
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
  claimsUsed: string[]
  facts: PersonalSourceFacts
}

export interface MemoryBlockV1 extends PersonalBlockEditorialFields {
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

export interface PhotoMemoryBlockV1 extends PersonalBlockEditorialFields {
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
  | "SINGLE_MEMORY"
  | "SINGLE_PHOTO_MEMORY"

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

export interface PersonalEditorialPageV1 {
  pageKey: string
  layoutId: PersonalEditorialLayoutId
  editorialFamily: PersonalEditorialFamily
  theme: PersonalEditorialPageTheme
  blocks: PersonalBlockV1[]
  visualRole: VisualRole
  weight: number
  packingFillScore: number
  pageFillScore: number
  isHero: boolean
  heroReason: string | null
  layoutVariant?: PhotoPlusMemoryVariant | null
  compatibilityScore: number
  /** Editorial relation strength for the packed page. */
  pageRelationType?: "STRONG" | "NEUTRAL"
  pageRelationReason?: string
  /** AI page copy vs deterministic fallback. */
  editorialMode?: "AI" | "FALLBACK"
  pageKicker?: string | null
  pageIntro?: string | null
}

export const PERSONAL_PAGE_CAPACITY = 4
export const PERSONAL_PAGE_MAX_BLOCKS = 3
export const PERSONAL_PAGE_MAX_PHOTOS = 2

export type { EditorialPerspectiveV2 }
