/**
 * Shared contract for ALL game engines (crossword, wordsearch, quiz, sudoku,
 * maze, …). Every engine keeps its OWN business Input/Result types — this file
 * only describes the minimum common shape so the registry can resolve and
 * version engines without a giant switch scattered across the app.
 *
 * Concept separation preserved on purpose (never fuse these):
 *   GAME            — editorial choice, e.g. CROSSWORD_PERSONAL
 *   TECHNICAL ENGINE — algorithm, e.g. CROSSWORD  (this file)
 *   TEMPLATE        — graphic structure, e.g. CROSSWORD_01
 *   STYLE / PALETTE / UNIVERSE / ASSET — presentation & content
 */

/** Typed identifier of a technical engine (the algorithm). Grows over time. */
export type GameEngineId = "CROSSWORD"

/** Identity + version stamped onto every generation so results stay reproducible. */
export interface GameEngineMeta {
  engineId: GameEngineId
  engineVersion: number
}

/**
 * Minimum shape the registry relies on for any engine result. Engines return
 * richer objects (grids, clues, stats, failure reasons); the registry only
 * needs to know a result reports success and, when present, its seed.
 */
export interface GameEngineResultBase {
  success: boolean
  seed?: string
}

/** A generation result decorated with the engine identity that produced it. */
export type WithEngineMeta<Result> = Result & GameEngineMeta

/**
 * A registered engine. Generic over its own Input and Result so each engine
 * stays fully typed while sharing one resolution mechanism.
 */
export interface GameEngineDescriptor<Input, Result extends GameEngineResultBase> {
  id: GameEngineId
  /**
   * Bumped when the algorithm changes in a way that alters output for the same
   * input+seed. A book generated at version N must stay reproducible by keeping
   * the engine at that version available.
   */
  version: number
  generate: (input: Input) => Result
}

/** Structured error thrown/returned when a technical engine cannot be resolved. */
export class UnknownGameEngineError extends Error {
  readonly requestedId: string
  constructor(requestedId: string) {
    super(`Moteur de jeu inconnu : "${requestedId}".`)
    this.name = "UnknownGameEngineError"
    this.requestedId = requestedId
  }
}
