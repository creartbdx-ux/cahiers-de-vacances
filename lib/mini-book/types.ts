/** In-memory Mini Book Lab model V2 — never persisted. */

export type MiniBookPageKind =
  | "COVER"
  | "QUIZ"
  | "WORDSEARCH"
  | "CROSSWORD"
  | "QUIZ_CORRECTION"
  | "LETTERS_CORRECTION"

export type MiniBookPageMode = "GAME" | "CORRECTION"

export interface MiniBookVisualIdentity {
  styleId: string
  paletteId: string
  /** True when style or palette came from AUTO resolution. */
  styleFromAuto: boolean
  paletteFromAuto: boolean
}

export interface MiniBookPageBase {
  pageNumber: number
  kind: MiniBookPageKind
  label: string
  /** Show discrete page number (false on cover). */
  showPageNumber: boolean
  /** Key for resolveMiniBookPageColors — same as kind for V2. */
  colorKey: MiniBookPageKind
}

export interface MiniBookCoverPage extends MiniBookPageBase {
  kind: "COVER"
  colorKey: "COVER"
  displayName: string
  subtitle: string
}

export interface MiniBookGamePage extends MiniBookPageBase {
  kind: "QUIZ" | "WORDSEARCH" | "CROSSWORD"
  colorKey: "QUIZ" | "WORDSEARCH" | "CROSSWORD"
  mode: "GAME"
  slotId: string
  universeId: string | null
  universeName: string | null
  title: string
}

export interface MiniBookQuizCorrectionPage extends MiniBookPageBase {
  kind: "QUIZ_CORRECTION"
  colorKey: "QUIZ_CORRECTION"
  slotId: string
  universeId: string | null
  universeName: string | null
  title: string
}

/** Compact combined wordsearch + crossword answers. */
export interface MiniBookLettersCorrectionPage extends MiniBookPageBase {
  kind: "LETTERS_CORRECTION"
  colorKey: "LETTERS_CORRECTION"
  wordsearch: {
    slotId: string
    universeId: string | null
    universeName: string | null
    title: string
  }
  crossword: {
    slotId: string
    universeId: string | null
    universeName: string | null
    title: string
  }
}

export type MiniBookPage =
  | MiniBookCoverPage
  | MiniBookGamePage
  | MiniBookQuizCorrectionPage
  | MiniBookLettersCorrectionPage

export interface MiniBookPreviewV1 {
  version: 1
  bookProjectId: string
  seed: string
  visualIdentity: MiniBookVisualIdentity
  pages: MiniBookPage[]
}

/** V2 compact structure — no full-page game corrections. */
export const MINI_BOOK_PAGE_COUNT = 6
