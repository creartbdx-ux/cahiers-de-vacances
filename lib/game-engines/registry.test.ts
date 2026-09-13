import { test } from "node:test"
import assert from "node:assert/strict"
import {
  GAME_ENGINE_IDS,
  generateGame,
  getEngine,
  isGameEngineId,
  resolveEngineId,
  resolveEngineStatus,
  UnknownGameEngineError,
} from "./registry"
import { resolveLabTemplates, resolveTemplateEngine } from "../book-renderer/templates"

const ENTRIES = [
  { answer: "MONTAGNE", clue: "Relief." },
  { answer: "CHALET", clue: "Maison d'altitude." },
  { answer: "SOMMET", clue: "Point culminant." },
  { answer: "SENTIER", clue: "Chemin de randonnée." },
  { answer: "NEIGE", clue: "Manteau blanc." },
  { answer: "GLACIER", clue: "Fleuve de glace." },
]

const WORDSEARCH_ENTRIES = [
  { word: "MONTAGNE" },
  { word: "CHALET" },
  { word: "SOMMET" },
  { word: "SENTIER" },
  { word: "NEIGE" },
  { word: "GLACIER" },
  { word: "AIGLE" },
  { word: "VALLEE" },
  { word: "REFUGE" },
  { word: "TORRENT" },
]

test("A. CROSSWORD is registered and discoverable", () => {
  assert.ok(GAME_ENGINE_IDS.includes("CROSSWORD"))
  assert.equal(isGameEngineId("CROSSWORD"), true)
  assert.equal(isGameEngineId(null), false)
})

test("M. WORDSEARCH v1 is registered and discoverable", () => {
  assert.ok(GAME_ENGINE_IDS.includes("WORDSEARCH"))
  assert.equal(isGameEngineId("WORDSEARCH"), true)
  const engine = getEngine("WORDSEARCH")
  assert.ok(engine)
  assert.equal(engine.id, "WORDSEARCH")
  assert.equal(engine.version, 1)
  const result = generateGame("WORDSEARCH", { entries: WORDSEARCH_ENTRIES, seed: "reg-ws", minWords: 8 })
  assert.equal(result.engineId, "WORDSEARCH")
  assert.equal(result.engineVersion, 1)
  assert.equal(result.success, true)
})

test("B. resolveEngineId narrows only known ids", () => {
  assert.equal(resolveEngineId("CROSSWORD"), "CROSSWORD")
  assert.equal(resolveEngineId("nope"), null)
  assert.equal(resolveEngineId(undefined), null)
})

test("C. getEngine returns a versioned descriptor or null", () => {
  const engine = getEngine("CROSSWORD")
  assert.ok(engine)
  assert.equal(engine.id, "CROSSWORD")
  assert.equal(typeof engine.version, "number")
  assert.equal(getEngine("unknown"), null)
})

test("D. generateGame stamps engine identity onto the result", () => {
  const result = generateGame("CROSSWORD", { entries: ENTRIES, seed: "reg-1" })
  assert.equal(result.engineId, "CROSSWORD")
  assert.equal(result.engineVersion, getEngine("CROSSWORD").version)
  assert.equal(result.success, true)
})

test("E. generateGame is deterministic for a given seed", () => {
  const a = generateGame("CROSSWORD", { entries: ENTRIES, seed: "same" })
  const b = generateGame("CROSSWORD", { entries: ENTRIES, seed: "same" })
  assert.deepEqual(a, b)
})

test("F. unknown engine id fails loud, never fabricates", () => {
  assert.throws(
    // @ts-expect-error deliberately passing an unregistered id
    () => generateGame("SUDOKU", { entries: ENTRIES, seed: "x" }),
    UnknownGameEngineError,
  )
})

test("G. template resolves to its technical engine", () => {
  assert.equal(resolveTemplateEngine("CROSSWORD_01"), "CROSSWORD")
  assert.equal(resolveTemplateEngine("WORDSEARCH_01"), "WORDSEARCH")
  assert.equal(resolveTemplateEngine("DOES_NOT_EXIST"), null)
})

test("H. resolveEngineStatus uses the registry (WORDSEARCH v1)", () => {
  const ws = resolveEngineStatus("WORDSEARCH")
  assert.equal(ws.implemented, true)
  if (ws.implemented) {
    assert.equal(ws.id, "WORDSEARCH")
    assert.equal(ws.version, 1)
  }
  const unknown = resolveEngineStatus("SUDOKU")
  assert.equal(unknown.implemented, false)
})

test("I. resolveLabTemplates keeps WORDSEARCH_01 when active in DB", () => {
  const labs = resolveLabTemplates([
    { id: "CROSSWORD_01", active: true },
    { id: "WORDSEARCH_01", active: true },
    { id: "UNKNOWN_99", active: true },
  ])
  assert.deepEqual(
    labs.map((t) => t.id),
    ["CROSSWORD_01", "WORDSEARCH_01"],
  )
})
