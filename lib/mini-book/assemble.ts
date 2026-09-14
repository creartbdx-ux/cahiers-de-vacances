import type { BookProfileV1 } from "@/lib/questionnaire/types"
import { resolveCoverDisplayName, resolveCoverSubtitle } from "./cover-name"
import type {
  MiniBookGamePage,
  MiniBookPreviewV1,
  MiniBookVisualIdentity,
} from "./types"
import { MINI_BOOK_PAGE_COUNT } from "./types"

export interface MiniBookGameSlotRef {
  slotId: string
  universeId: string | null
  universeName: string | null
  title: string
}

export interface AssembleMiniBookInput {
  bookProjectId: string
  seed: string
  profile: BookProfileV1
  visualIdentity: MiniBookVisualIdentity
  quiz: MiniBookGameSlotRef
  wordsearch: MiniBookGameSlotRef
  crossword: MiniBookGameSlotRef
}

/**
 * Assemble the fixed 8-page Mini Book structure.
 * Does not call IA — only wires already-generated game refs into pages.
 */
export function assembleMiniBookPreview(input: AssembleMiniBookInput): MiniBookPreviewV1 {
  const quizGame = gamePage(2, "QUIZ", "GAME", "Quiz", input.quiz)
  const wsGame = gamePage(3, "WORDSEARCH", "GAME", "Mots mêlés", input.wordsearch)
  const cwGame = gamePage(4, "CROSSWORD", "GAME", "Mots croisés", input.crossword)

  const quizCorr = gamePage(6, "QUIZ", "CORRECTION", "Corr. Quiz", input.quiz)
  const wsCorr = gamePage(7, "WORDSEARCH", "CORRECTION", "Corr. Mots mêlés", input.wordsearch)
  const cwCorr = gamePage(8, "CROSSWORD", "CORRECTION", "Corr. Mots croisés", input.crossword)

  const pages: MiniBookPreviewV1["pages"] = [
    {
      pageNumber: 1,
      kind: "COVER",
      label: "Couverture",
      showPageNumber: false,
      displayName: resolveCoverDisplayName(input.profile),
      subtitle: resolveCoverSubtitle(input.profile),
    },
    quizGame,
    wsGame,
    cwGame,
    {
      pageNumber: 5,
      kind: "CORRECTIONS_DIVIDER",
      label: "Corrections",
      showPageNumber: true,
      title: "CORRECTIONS",
      body: "Les réponses sont juste après.\nPromis, on ne dira rien.",
    },
    quizCorr,
    wsCorr,
    cwCorr,
  ]

  if (pages.length !== MINI_BOOK_PAGE_COUNT) {
    throw new Error(`Mini-cahier invalide : ${pages.length} pages au lieu de ${MINI_BOOK_PAGE_COUNT}.`)
  }

  return {
    version: 1,
    bookProjectId: input.bookProjectId,
    seed: input.seed,
    visualIdentity: input.visualIdentity,
    pages,
  }
}

function gamePage(
  pageNumber: 2 | 3 | 4 | 6 | 7 | 8,
  kind: MiniBookGamePage["kind"],
  mode: MiniBookGamePage["mode"],
  label: string,
  ref: MiniBookGameSlotRef,
): MiniBookGamePage {
  return {
    pageNumber,
    kind,
    mode,
    label,
    showPageNumber: true,
    slotId: ref.slotId,
    universeId: ref.universeId,
    universeName: ref.universeName,
    title: ref.title,
  }
}

/** Assert correction pages point to the same slots as game pages (no regen). */
export function miniBookCorrectionSharesGameContent(book: MiniBookPreviewV1): boolean {
  const quizGame = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "QUIZ" && p.mode === "GAME",
  )
  const quizCorr = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "QUIZ" && p.mode === "CORRECTION",
  )
  const wsGame = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "WORDSEARCH" && p.mode === "GAME",
  )
  const wsCorr = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "WORDSEARCH" && p.mode === "CORRECTION",
  )
  const cwGame = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "CROSSWORD" && p.mode === "GAME",
  )
  const cwCorr = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "CROSSWORD" && p.mode === "CORRECTION",
  )

  if (!quizGame || !quizCorr || !wsGame || !wsCorr || !cwGame || !cwCorr) return false
  return (
    quizGame.slotId === quizCorr.slotId &&
    quizGame.title === quizCorr.title &&
    wsGame.slotId === wsCorr.slotId &&
    cwGame.slotId === cwCorr.slotId
  )
}
