/**
 * Central registry of technical engines. Resolves a `technical_engine` string
 * (as stored on GAMES / TEMPLATES in Supabase) to the actual generator, and
 * stamps every result with the engine id + version. This is the single place
 * that maps ids to algorithms — no engine switch should live anywhere else.
 */
import { generateCrossword } from "./crossword"
import type { CrosswordResult, GenerateCrosswordOptions } from "./crossword/types"
import {
  UnknownGameEngineError,
  type GameEngineDescriptor,
  type GameEngineId,
  type WithEngineMeta,
} from "./types"

/** Ties each engine id to its own Input and Result types for full type-safety. */
export interface GameEngineMap {
  CROSSWORD: { input: GenerateCrosswordOptions; result: CrosswordResult }
}

export const CROSSWORD_ENGINE: GameEngineDescriptor<GenerateCrosswordOptions, CrosswordResult> = {
  id: "CROSSWORD",
  version: 1,
  generate: generateCrossword,
}

/** The registry. Adding an engine = add one entry here (and to GameEngineMap). */
const ENGINES: { [K in GameEngineId]: GameEngineDescriptor<GameEngineMap[K]["input"], GameEngineMap[K]["result"]> } = {
  CROSSWORD: CROSSWORD_ENGINE,
}

/** Every registered engine id, e.g. for iteration in admin tooling. */
export const GAME_ENGINE_IDS = Object.keys(ENGINES) as GameEngineId[]

/** Narrowing guard: is this arbitrary string a known engine id? */
export function isGameEngineId(id: string | null | undefined): id is GameEngineId {
  return id != null && Object.prototype.hasOwnProperty.call(ENGINES, id)
}

/** Resolve a stored `technical_engine` string to an engine id, or null. */
export function resolveEngineId(technicalEngine: string | null | undefined): GameEngineId | null {
  return isGameEngineId(technicalEngine) ? technicalEngine : null
}

/** Look up an engine descriptor, or null when the id is unknown. */
export function getEngine<K extends GameEngineId>(id: K): (typeof ENGINES)[K]
export function getEngine(id: string | null | undefined): GameEngineDescriptor<unknown, GameEngineResultLike> | null
export function getEngine(id: string | null | undefined) {
  return isGameEngineId(id) ? ENGINES[id] : null
}

type GameEngineResultLike = GameEngineMap[GameEngineId]["result"]

/**
 * Resolve + run an engine in one call, stamping the result with engineId and
 * engineVersion so a generated page always records which algorithm produced it.
 * Throws UnknownGameEngineError for an unknown id (fail loud, never fabricate).
 */
export function generateGame<K extends GameEngineId>(
  id: K,
  input: GameEngineMap[K]["input"],
): WithEngineMeta<GameEngineMap[K]["result"]> {
  const engine = ENGINES[id]
  if (!engine) throw new UnknownGameEngineError(String(id))
  const result = engine.generate(input)
  return { ...result, engineId: engine.id, engineVersion: engine.version }
}

export { UnknownGameEngineError } from "./types"
export type { GameEngineId, GameEngineMeta, WithEngineMeta } from "./types"
