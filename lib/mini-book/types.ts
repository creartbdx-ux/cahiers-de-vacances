/** In-memory Mini Book Lab model — never persisted. */

export type MiniBookPageKind =
  | "COVER"
  | "QUIZ"
  | "WORDSEARCH"
  | "CROSSWORD"
  | "CORRECTIONS_DIVIDER"

export type MiniBookPageMode = "GAME" | "CORRECTION"

export interface MiniBookVisualIdentity {
  styleId: string
  paletteId: string
  /** True when style or palette came from AUTO resolution. */
  styleFromAuto: boolean
  paletteFromAuto: boolean
}

export interface MiniBookPageBase {
  pageNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  kind: MiniBookPageKind
  label: string
  /** Show discrete page number (false on cover). */
  showPageNumber: boolean
}

export interface MiniBookCoverPage extends MiniBookPageBase {
  kind: "COVER"
  displayName: string
  subtitle: string
}

export interface MiniBookCorrectionsDividerPage extends MiniBookPageBase {
  kind: "CORRECTIONS_DIVIDER"
  title: string
  body: string
}

export interface MiniBookGamePage extends MiniBookPageBase {
  kind: "QUIZ" | "WORDSEARCH" | "CROSSWORD"
  mode: MiniBookPageMode
  /** Slot id from the editorial plan. */
  slotId: string
  universeId: string | null
  universeName: string | null
  title: string
}

export type MiniBookPage =
  | MiniBookCoverPage
  | MiniBookCorrectionsDividerPage
  | MiniBookGamePage

export interface MiniBookPreviewV1 {
  version: 1
  bookProjectId: string
  seed: string
  visualIdentity: MiniBookVisualIdentity
  pages: MiniBookPage[]
}

export const MINI_BOOK_PAGE_COUNT = 8
