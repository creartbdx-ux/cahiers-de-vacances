/** Book Blueprint V1 — editorial structure only. No IA, no page generation. */

export const BOOK_BLUEPRINT_VERSION = 1 as const
export const DEFAULT_TARGET_INTERIOR_PAGES = 50

export type PageFamily =
  | "OPENING"
  | "THEME_GAME"
  | "PERSONAL_GAME"
  | "MEMORY"
  | "PHOTO"
  | "QUICK_GAME"
  | "BREATHER"
  | "CORRECTION"
  | "CLOSING"

export type ImplementationStatus = "READY" | "PARTIAL" | "MISSING"

export type PageDensity = "LIGHT" | "MEDIUM" | "HEAVY"

export type PersonalizationType = "THEME" | "PERSONAL" | "NONE"

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
  personalPercent: number
  readyPercent: number
  missingPercent: number
  photoPages: number
  memoryPages: number
  mainGamePages: number
  quickGamePages: number
  correctionPages: number
  readyThemeGamePages: number
  missingMechanicPages: number
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
  richnessLevel: "INSUFFICIENT" | "ENOUGH" | "RICH"
  targetInteriorPages: number
  cover: BlueprintCover
  visualIdentity: BlueprintVisualIdentity
  sections: BlueprintSection[]
  pages: BlueprintPageSlot[]
  stats: BlueprintStats
  capabilityGaps: CapabilityGap[]
}

export interface CompositionTargets {
  opening: number
  closing: number
  mainGames: number
  personalBlock: number
  quickLight: number
  breathers: number
  /** Soft estimate before packing. */
  estimatedCorrectionPages: number
  maxReadyThemeGames: number
  photoSlots: number
  memorySlots: number
  personalGameSlots: number
}
