/**
 * Template registry. A template defines the STRUCTURE of a page (what blocks
 * exist and where), independently of style, palette and universe.
 *
 * CROSSWORD_01 is defined here in code as the first structural template while
 * the Supabase `templates` table does not yet contain it. Later steps can move
 * this to the database without changing the renderer contract.
 */
import type { GameEngineId } from "@/lib/game-engines/types"

export type BookTemplateId = "CROSSWORD_01" | "WORDSEARCH_01"

export interface BookTemplateDef {
  id: BookTemplateId
  name: string
  structureKey: string
  /**
   * Technical engine this template renders. A template is bound to an ENGINE
   * (data shape), not to a single game — so every game sharing the engine can
   * reuse it (e.g. CROSSWORD_PERSONAL and CROSSWORD_THEME both use CROSSWORD).
   */
  engineId: GameEngineId
}

export const BOOK_TEMPLATES: BookTemplateDef[] = [
  { id: "CROSSWORD_01", name: "Mots croisés · 01", structureKey: "CROSSWORD_01", engineId: "CROSSWORD" },
  { id: "WORDSEARCH_01", name: "Mots mêlés · 01", structureKey: "WORDSEARCH_01", engineId: "WORDSEARCH" },
]

/** Resolve a template id to its technical engine, or null if unknown. */
export function resolveTemplateEngine(templateId: string): GameEngineId | null {
  return BOOK_TEMPLATES.find((t) => t.id === templateId)?.engineId ?? null
}

/**
 * Local placeholder content used ONLY to visualize the structure in the lab.
 * This is never persisted to Supabase and will be replaced by generated
 * content once the real engine exists.
 */
export interface CrosswordSampleClue {
  number: number
  clue: string
}

export interface CrosswordSample {
  gameLabel: string
  title: string
  instruction: string
  horizontal: CrosswordSampleClue[]
  vertical: CrosswordSampleClue[]
}

export interface WordsearchSample {
  gameLabel: string
  title: string
  instruction: string
  words: string[]
}

export const CROSSWORD_01_SAMPLE: CrosswordSample = {
  gameLabel: "Jeu · Mots croisés",
  title: "Les cimes en toutes lettres",
  instruction:
    "Complétez la grille à l'aide des définitions. Chaque mot évoque la montagne et ses trésors.",
  horizontal: [
    { number: 1, clue: "Randonnée sur les sentiers d'altitude." },
    { number: 2, clue: "Abri de pierre où loge le berger." },
    { number: 3, clue: "Grand sommet rocheux et escarpé." },
    { number: 4, clue: "Manteau blanc qui recouvre les pentes." },
  ],
  vertical: [
    { number: 1, clue: "Cours d'eau vif dévalant la pente." },
    { number: 2, clue: "Rapace majestueux des hautes cimes." },
    { number: 3, clue: "Sport de glisse de la saison froide." },
    { number: 4, clue: "Vallée étroite et profondément encaissée." },
  ],
}

export const WORDSEARCH_01_SAMPLE: WordsearchSample = {
  gameLabel: "Jeu · Mots mêlés",
  title: "Les cimes se cachent",
  instruction:
    "Retrouve les mots dans la grille. Ils se lisent de gauche à droite, de haut en bas, ou en diagonale — jamais à l'envers.",
  words: ["Montagne", "Chalet", "Sommet", "Sentier", "Glacier", "Neige", "Aigle", "Vallée"],
}
