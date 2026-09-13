import assert from "node:assert/strict"
import { test } from "node:test"
import { generateCrossword } from "./index"
import { normalizeAnswer, normalizeEntries, partitionEligible } from "./normalize"
import { computeNumbering } from "./numbering"
import { toPlayerCells, toSolutionCells } from "./solution"
import type { CrosswordEntry, CrosswordSuccess } from "./types"

/** A themed mountain word list with plenty of shared letters. */
const MOUNTAIN: CrosswordEntry[] = [
  { answer: "MONTAGNE", clue: "Relief naturel élevé." },
  { answer: "CHALET", clue: "Maison typique d'altitude." },
  { answer: "SOMMET", clue: "Point le plus haut." },
  { answer: "SENTIER", clue: "Chemin de randonnée." },
  { answer: "GLACIER", clue: "Fleuve de glace." },
  { answer: "NEIGE", clue: "Manteau blanc hivernal." },
  { answer: "AIGLE", clue: "Rapace des cimes." },
  { answer: "VALLEE", clue: "Creux entre deux reliefs." },
  { answer: "REFUGE", clue: "Abri de montagne." },
  { answer: "TORRENT", clue: "Cours d'eau vif." },
  { answer: "MARMOTTE", clue: "Rongeur siffleur." },
  { answer: "RANDONNEE", clue: "Longue marche." },
]

function expectSuccess(result: ReturnType<typeof generateCrossword>): CrosswordSuccess {
  assert.equal(result.success, true, `expected success, got: ${JSON.stringify(result)}`)
  return result as CrosswordSuccess
}

/** Re-read the letters of a clue slot straight from the cells matrix. */
function readAnswer(
  cells: CrosswordSuccess["cells"],
  clue: CrosswordSuccess["across"][number],
  orientation: "across" | "down",
): string {
  let out = ""
  for (let i = 0; i < clue.length; i++) {
    const r = orientation === "across" ? clue.row : clue.row + i
    const c = orientation === "across" ? clue.column + i : clue.column
    out += cells[r]?.[c]?.solution ?? "?"
  }
  return out
}

test("normalizeAnswer strips accents, spaces, hyphens and apostrophes", () => {
  assert.equal(normalizeAnswer("Vélo"), "VELO")
  assert.equal(normalizeAnswer("Saint-Émilion"), "SAINTEMILION")
  assert.equal(normalizeAnswer("l'aigle des cimes"), "LAIGLEDESCIMES")
  assert.equal(normalizeAnswer("Œuf 123"), "UF") // non A-Z removed
})

test("A. a normal list of 10-12 compatible words builds a valid grid", () => {
  const result = expectSuccess(generateCrossword({ entries: MOUNTAIN, seed: "alpha" }))
  assert.ok(result.stats.placed >= 8, `placed ${result.stats.placed} words, expected >= 8`)
  assert.ok(result.stats.crossings >= result.stats.placed - 1, "not enough crossings for connectivity")
  assert.ok(result.width > 0 && result.height > 0)
})

test("B. accents / spaces / hyphens are normalized before placement", () => {
  const entries: CrosswordEntry[] = [
    { answer: "Montagne", clue: "" },
    { answer: "Château-fort", clue: "" },
    { answer: "Forêt", clue: "" },
    { answer: "Névé", clue: "" },
    { answer: "Col", clue: "" },
    { answer: "Cîme", clue: "" },
  ]
  const norm = normalizeEntries(entries).map((e) => e.answer)
  assert.ok(norm.includes("CHATEAUFORT"))
  assert.ok(norm.includes("FORET"))
  assert.ok(norm.every((a) => /^[A-Z]+$/.test(a)))
})

test("C. words with no common letters cannot connect => failure, no fake grid", () => {
  const entries: CrosswordEntry[] = [
    { answer: "ABC", clue: "" },
    { answer: "DEF", clue: "" },
    { answer: "GHI", clue: "" },
    { answer: "JKL", clue: "" },
  ]
  const result = generateCrossword({ entries, seed: "x", minEntries: 4 })
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.reason, "NOT_ENOUGH_CONNECTED_ENTRIES")
    assert.ok(result.unusedEntries.length > 0)
  }
})

test("D. duplicate answers are de-duplicated", () => {
  const entries: CrosswordEntry[] = [
    { answer: "MONTAGNE", clue: "un" },
    { answer: "montagne", clue: "deux" },
    { answer: "Montagne", clue: "trois" },
  ]
  const normalized = normalizeEntries(entries)
  assert.equal(normalized.length, 1)
})

test("E. answers shorter than 3 letters are rejected", () => {
  const { eligible, rejected } = partitionEligible(
    normalizeEntries([
      { answer: "OK", clue: "" },
      { answer: "A", clue: "" },
      { answer: "SOMMET", clue: "" },
    ]),
  )
  assert.deepEqual(eligible.map((e) => e.answer), ["SOMMET"])
  assert.equal(rejected.length, 2)
})

test("F. answers longer than 12 letters are rejected", () => {
  const { eligible, rejected } = partitionEligible(
    normalizeEntries([
      { answer: "ANTICONSTITUTIONNEL", clue: "" }, // 19
      { answer: "GLACIER", clue: "" },
    ]),
  )
  assert.deepEqual(eligible.map((e) => e.answer), ["GLACIER"])
  assert.equal(rejected.length, 1)
})

test("G. same entries + same seed => identical grid", () => {
  const a = generateCrossword({ entries: MOUNTAIN, seed: "repro-42" })
  const b = generateCrossword({ entries: MOUNTAIN, seed: "repro-42" })
  assert.deepEqual(a, b)

  const c = generateCrossword({ entries: MOUNTAIN, seed: "different" })
  // Different seed should be allowed to differ (not a hard guarantee, but with
  // this list it does): at least the serialized cells are compared for change.
  assert.notEqual(JSON.stringify(a), JSON.stringify(c))
})

test("H. solution view has exactly the same geometry as the player view", () => {
  const result = expectSuccess(generateCrossword({ entries: MOUNTAIN, seed: "geo" }))
  const player = toPlayerCells(result.cells)
  const solution = toSolutionCells(result.cells)

  assert.equal(player.length, solution.length)
  for (let r = 0; r < player.length; r++) {
    assert.equal(player[r].length, solution[r].length)
    for (let c = 0; c < player[r].length; c++) {
      const p = player[r][c]
      const s = solution[r][c]
      assert.equal(p.block, s.block)
      assert.equal(p.number, s.number)
      assert.equal(p.row, s.row)
      assert.equal(p.column, s.column)
      assert.equal(p.solution, null) // player never reveals letters
      if (!s.block) assert.ok(s.solution) // solution keeps the letter
    }
  }
})

test("I. no collisions: every clue answer matches the letters in the grid", () => {
  const result = expectSuccess(generateCrossword({ entries: MOUNTAIN, seed: "collide" }))
  for (const clue of result.across) {
    assert.equal(readAnswer(result.cells, clue, "across"), clue.answer)
  }
  for (const clue of result.down) {
    assert.equal(readAnswer(result.cells, clue, "down"), clue.answer)
  }
})

test("J. complete connectivity: all letter cells form one component", () => {
  const result = expectSuccess(generateCrossword({ entries: MOUNTAIN, seed: "connect" }))

  const letters = new Set<string>()
  for (const row of result.cells) for (const cell of row) if (!cell.block) letters.add(`${cell.row},${cell.column}`)

  const start = letters.values().next().value as string
  const seen = new Set<string>([start])
  const queue = [start]
  while (queue.length) {
    const [r, c] = queue.shift()!.split(",").map(Number)
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ]) {
      const k = `${nr},${nc}`
      if (letters.has(k) && !seen.has(k)) {
        seen.add(k)
        queue.push(k)
      }
    }
  }
  assert.equal(seen.size, letters.size, "grid is not fully connected")
})

test("numbering: a shared start cell carries one number for across and down", () => {
  // Build a tiny + shape: HELLO across and HEART down sharing the H at (0,0).
  const grid = new Map<string, string>()
  "HELLO".split("").forEach((ch, i) => grid.set(`0,${i}`, ch))
  "HEART".split("").forEach((ch, i) => grid.set(`${i},0`, ch))
  const numbering = computeNumbering(grid, 5, 5)
  assert.equal(numbering.numberAt.get("0,0"), 1)
  assert.ok(numbering.across.some((s) => s.number === 1 && s.answer === "HELLO"))
  assert.ok(numbering.down.some((s) => s.number === 1 && s.answer === "HEART"))
})

test("failure below minEntries returns a structured, non-throwing result", () => {
  const result = generateCrossword({ entries: [{ answer: "OK", clue: "" }], seed: "s", minEntries: 8 })
  assert.equal(result.success, false)
  if (!result.success) assert.equal(result.reason, "NOT_ENOUGH_ELIGIBLE_ENTRIES")
})
