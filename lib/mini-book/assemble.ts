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
 * Assemble Mini Book V2 — 6 pages, compact corrections.
 * Does not call IA.
 */
export function assembleMiniBookPreview(input: AssembleMiniBookInput): MiniBookPreviewV1 {
  const pages: MiniBookPreviewV1["pages"] = [
    {
      pageNumber: 1,
      kind: "COVER",
      colorKey: "COVER",
      label: "Couverture",
      showPageNumber: false,
      displayName: resolveCoverDisplayName(input.profile),
      subtitle: resolveCoverSubtitle(input.profile),
    },
    gamePage(2, "QUIZ", "Quiz", input.quiz),
    gamePage(3, "WORDSEARCH", "Mots mêlés", input.wordsearch),
    gamePage(4, "CROSSWORD", "Mots croisés", input.crossword),
    {
      pageNumber: 5,
      kind: "QUIZ_CORRECTION",
      colorKey: "QUIZ_CORRECTION",
      label: "Réponses Quiz",
      showPageNumber: true,
      slotId: input.quiz.slotId,
      universeId: input.quiz.universeId,
      universeName: input.quiz.universeName,
      title: input.quiz.title,
    },
    {
      pageNumber: 6,
      kind: "LETTERS_CORRECTION",
      colorKey: "LETTERS_CORRECTION",
      label: "Réponses lettres",
      showPageNumber: true,
      wordsearch: {
        slotId: input.wordsearch.slotId,
        universeId: input.wordsearch.universeId,
        universeName: input.wordsearch.universeName,
        title: input.wordsearch.title,
      },
      crossword: {
        slotId: input.crossword.slotId,
        universeId: input.crossword.universeId,
        universeName: input.crossword.universeName,
        title: input.crossword.title,
      },
    },
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
  pageNumber: number,
  kind: MiniBookGamePage["kind"],
  label: string,
  ref: MiniBookGameSlotRef,
): MiniBookGamePage {
  return {
    pageNumber,
    kind,
    colorKey: kind,
    mode: "GAME",
    label,
    showPageNumber: true,
    slotId: ref.slotId,
    universeId: ref.universeId,
    universeName: ref.universeName,
    title: ref.title,
  }
}

/** Corrections reuse the same slot ids / titles as game pages. */
export function miniBookCorrectionSharesGameContent(book: MiniBookPreviewV1): boolean {
  const quizGame = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "QUIZ" && p.mode === "GAME",
  )
  const quizCorr = book.pages.find((p) => p.kind === "QUIZ_CORRECTION")
  const wsGame = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "WORDSEARCH" && p.mode === "GAME",
  )
  const cwGame = book.pages.find(
    (p): p is MiniBookGamePage => p.kind === "CROSSWORD" && p.mode === "GAME",
  )
  const letters = book.pages.find((p) => p.kind === "LETTERS_CORRECTION")

  if (!quizGame || !quizCorr || !wsGame || !cwGame || !letters) return false
  if (quizCorr.kind !== "QUIZ_CORRECTION" || letters.kind !== "LETTERS_CORRECTION") return false

  return (
    quizGame.slotId === quizCorr.slotId &&
    quizGame.title === quizCorr.title &&
    wsGame.slotId === letters.wordsearch.slotId &&
    cwGame.slotId === letters.crossword.slotId
  )
}
