/** Book Blueprint V1 — editorial structure only. No IA, no page generation. */

import type { MemoryContentHint } from "./memory-hints"

export type { MemoryContentHint }

export const BOOK_BLUEPRINT_VERSION = 1 as const
export const DEFAULT_TARGET_INTERIOR_PAGES = 50

export type PageFamily =
  | "OPENING"
  | "THEME_GAME"
  | "PERSONAL_GAME"
  | "MEMORY"
  | "PHOTO"
  | "PERSONAL_EDITORIAL"
  | "QUICK_GAME"
  | "BREATHER"
  | "CORRECTION"
  | "CLOSING"

export type ImplementationStatus = "READY" | "PARTIAL" | "MISSING"

export type PageDensity = "LIGHT" | "MEDIUM" | "HEAVY"

export type PersonalizationType = "THEME" | "PERSONAL" | "NONE"

/**
 * What profile matter a page needs.
 * Blueprint mixes NEUTRAL/THEME/LIGHT_PERSONAL for LIGHT profiles;
 * DEEP_PERSONAL/PHOTO only when capabilities allow.
 */
export type PageDataNeed =
  | "NEUTRAL"
  | "THEME"
  | "LIGHT_PERSONAL"
  | "DEEP_PERSONAL"
  | "PHOTO"

export type {
  PersonalizationTouch,
  PersonalizationTouchType,
  PersonalizationTouchUsage,
} from "./personalization-touches"

export type VisualRole = "PRIMARY" | "SECONDARY" | "ACCENT" | "LIGHT" | "NEUTRAL"

export type BlueprintSectionKind =
  | "OPENING"
  | "PART_1"
  | "PART_2"
  | "PART_3"
  | "CORRECTIONS"
  | "CLOSING"

export type GapPriority = "HIGH" | "MEDIUM" | "LOW"

export interface PageArchetype {
  id: string
  family: PageFamily
  label: string
  estimatedDensity: PageDensity
  correctionRequired: boolean
  /** Contribution to a compact correction page (0 when none). */
  correctionWeight: number
  implementationStatus: ImplementationStatus
  supportedAudiences: Array<"ME" | "OTHER_PERSON" | "DUO" | "GROUP" | "*">
  /** Soft requirements used by the planner — never invent data. */
  minimumProfileRequirements: {
    minPhotos?: number
    minMemories?: number
    minPersonalFacts?: number
    requiresDuo?: boolean
    requiresGroup?: boolean
  }
  tags: string[]
  mechanicFamily?: string
  gameId?: string
  technicalEngine?: string
  personalizationType: PersonalizationType
  /** Data need for capability-based selection (orthogonal to page family). */
  dataNeed?: PageDataNeed
  /**
   * Suggested default touches this archetype can accept when capabilities allow.
   * Planner may assign a subset onto the page slot.
   */
  suggestedTouchTypes?: import("./personalization-touches").PersonalizationTouchType[]
}

export interface BlueprintPageSlot {
  slotId: string
  pageNumber: number
  family: PageFamily
  archetypeId: string
  label: string
  personalizationType: PersonalizationType
  gameId?: string
  technicalEngine?: string
  universeId?: string | null
  participantIds?: string[]
  sourceNeeds?: string[]
  implementationStatus: ImplementationStatus
  correctionOf?: string[]
  visualRole: VisualRole
  density: PageDensity
  section: BlueprintSectionKind
  reason: string
  /** Effective data need (from archetype; orthogonal to family / personalizationType). */
  dataNeed?: PageDataNeed
  /** Diffuse personalization applied to this page — may decorate THEME/NEUTRAL games. */
  personalizationTouches?: import("./personalization-touches").PersonalizationTouch[]
  /** PERSONAL_EDITORIAL_PAGE layout when composed (lab / experimental). */
  personalLayoutId?: string
  /** PHOTO_COLLAGE_PAGE layout family (COLLAGE_2/3/4). */
  photoLayoutId?: string
  /** Structural photo template id (PHOTO_3_B, …). */
  photoTemplateId?: string
  sourceMemoryIds?: string[]
  sourcePhotoIds?: string[]
}

export interface BlueprintCover {
  displayName: string
  subtitle: string
  outsideInteriorPagination: true
}

export interface BlueprintVisualIdentity {
  styleId: string
  paletteId: string
  styleFromAuto: boolean
  paletteFromAuto: boolean
}

export interface BlueprintSection {
  kind: BlueprintSectionKind
  label: string
  pageNumbers: number[]
}

export interface BlueprintStats {
  interiorPageCount: number
  byFamily: Record<PageFamily, number>
  byStatus: Record<ImplementationStatus, number>
  byPersonalization: Record<"THEME" | "PERSONAL" | "NONE", number>
  byDensity: Record<PageDensity, number>
  byVisualRole: Record<VisualRole, number>
  universeCounts: Record<string, number>
  themePercent: number
  /**
   * Share of pages touched by personalization:
   * pages with ≥1 PersonalizationTouch + DEEP_PERSONAL + PHOTO.
   * Not limited to personalizationType === PERSONAL.
   */
  personalPercent: number
  /** Count of pages with at least one PersonalizationTouch. */
  pagesWithTouches: number
  readyPercent: number
  missingPercent: number
  photoPages: number
  memoryPages: number
  personalEditorialPages: number
  mainGamePages: number
  quickGamePages: number
  correctionPages: number
  readyThemeGamePages: number
  missingMechanicPages: number
  byDataNeed: Record<PageDataNeed, number>
}

export interface CapabilityGap {
  family: PageFamily
  archetypeId?: string
  label: string
  pagesNeeded: number
  ready: number
  gap: number
  priority: GapPriority
  audiences: Array<"ME" | "OTHER_PERSON" | "DUO" | "GROUP">
  availableData: string[]
  mechanicTags: string[]
  recommendation: string
}

export interface BookBlueprintV1 {
  version: typeof BOOK_BLUEPRINT_VERSION
  bookProjectId: string
  seed: string
  audience: "ME" | "OTHER_PERSON" | "DUO" | "GROUP"
  richnessLevel: "LIGHT" | "PERSONALIZED" | "RICH" | "INSUFFICIENT" | "ENOUGH"
  targetInteriorPages: number
  /** Snapshot of capabilities depth used for selection. */
  personalizationDepth?: "LIGHT" | "PERSONALIZED" | "RICH"
  cover: BlueprintCover
  visualIdentity: BlueprintVisualIdentity
  sections: BlueprintSection[]
  pages: BlueprintPageSlot[]
  stats: BlueprintStats
  capabilityGaps: CapabilityGap[]
  /**
   * Per-memory hints (sources for PERSONAL games — not dedicated V1 pages).
   */
  memoryContentHints: MemoryContentHint[]
}

export interface CompositionTargets {
  opening: number
  closing: number
  mainGames: number
  /**
   * Dedicated personal *content* budget: photos + optional deep/audience games.
   * Does NOT include a quota of generic "Page personnelle ludique".
   */
  personalBlock: number
  quickLight: number
  breathers: number
  /** Soft estimate before packing. */
  estimatedCorrectionPages: number
  maxReadyThemeGames: number
  /** Max photos considered for album pages. */
  photoSlots: number
  /**
   * Memory count kept for personal-game budgeting / hints.
   * Memories do not create dedicated Blueprint V1 pages.
   */
  memorySlots: number
  /** @deprecated V1 no longer plans PERSONAL_EDITORIAL pages — always 0. */
  personalEditorialSlots: number
  /** Planned PHOTO_COLLAGE / PHOTO_TIMELINE pages. */
  photoPageSlots: number
  /**
   * Max dedicated DEEP / audience-interaction personal games (not generic reflection).
   * Usually 0–3 — never a large PERSONAL_REFLECTION fill.
   */
  personalGameSlots: number
  /**
   * Target number of pages that should receive ≥1 PersonalizationTouch
   * (theme/neutral games decorated + intentional light-touch mechanics).
   * ~12–18 for a 50-page book.
   */
  touchBudget: number
  /** Intentional light-touch mechanic slots (logic/age, secret word, …). */
  touchMechanicSlots: number
}
