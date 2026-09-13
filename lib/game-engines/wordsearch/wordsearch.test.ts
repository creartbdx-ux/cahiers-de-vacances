import assert from "node:assert/strict"
import { test } from "node:test"
import { generateWordSearch } from "./index"
import { ALL_DIRECTIONS } from "./geometry"
import { normalizeEntries, normalizeWord, partitionEligible } from "./normalize"
import { isHighlightedCell, wordCellKeySet } from "./solution"
import { readPlacement } from "./validator"
import type { WordSearchEntry, WordSearchSuccess } from "./types"

const MOUNTAIN: WordSearchEntry[] = [
  { word: "MONTAGNE" },
  { word: "CHALET" },
  { word: "SOMMET" },
  { word: "SENTIER" },
  { word: "GLACIER" },
  { word: "NEIGE" },
  { word: "AIGLE" },
  { word: "VALLEE" },
  { word: "REFUGE" },
  { word: "TORRENT" },
  { word: "MARMOTTE" },
  { word: "RANDONNEE" },
]

function expectSuccess(result: ReturnType<typeof generateWordSearch>): WordSearchSuccess {
  assert.equal(result.success, true, `expected success, got: ${JSON.stringify(result)}`)
  return result as WordSearchSuccess
}

test("A. génération normale d'une grille valide", () => {
  const result = expectSuccess(generateWordSearch({ entries: MOUNTAIN, seed: "alpha", minWords: 8 }))
  assert.ok(result.stats.placed >= 8, `placed ${result.stats.placed}, expected >= 8`)
  assert.equal(result.width, 12)
  assert.equal(result.height, 12)
  assert.equal(result.grid.length, 12)
  assert.equal(result.grid[0].length, 12)
  assert.equal(result.validation.ok, true)
})

test("B. accents / espaces / tirets sont normalisés pour la grille", () => {
  assert.equal(normalizeWord("Vélo"), "VELO")
  assert.equal(normalizeWord("Saint-Émilion"), "SAINTEMILION")
  assert.equal(normalizeWord("l'aigle"), "LAIGLE")

  const entries: WordSearchEntry[] = [
    { word: "Montagne" },
    { word: "Château-fort" },
    { word: "Forêt" },
    { word: "Névé" },
    { word: "Col" },
    { word: "Cîme" },
    { word: "Aigle" },
    { word: "Vallée" },
  ]
  const result = expectSuccess(
    generateWordSearch({ entries, seed: "accents", minWords: 6, width: 12, height: 12 }),
  )
  const placed = result.placements.map((p) => p.normalizedWord)
  assert.ok(placed.includes("CHATEAUFORT") || result.unusedEntries.some((e) => e.word === "CHATEAUFORT"))
  assert.ok(result.placements.every((p) => /^[A-Z]+$/.test(p.normalizedWord)))
  assert.ok(result.placements.some((p) => p.originalWord.includes("é") || p.originalWord.includes("-") || p.originalWord !== p.normalizedWord))
})

test("C. doublons après normalisation (premier gagne)", () => {
  const normalized = normalizeEntries([
    { word: "MONTAGNE" },
    { word: "montagne" },
    { word: "Montagne" },
  ])
  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].word, "MONTAGNE")
  assert.equal(normalized[0].original, "MONTAGNE")
})

test("D. mot trop grand pour la grille est rejeté", () => {
  const { eligible, rejected } = partitionEligible(
    normalizeEntries([
      { word: "ANTICONSTITUTIONNEL" },
      { word: "GLACIER" },
    ]),
    ALL_DIRECTIONS,
    8,
    8,
  )
  assert.deepEqual(eligible.map((e) => e.word), ["GLACIER"])
  assert.equal(rejected.length, 1)
  assert.equal(rejected[0].word, "ANTICONSTITUTIONNEL")
})

test("E. même seed = même grille complète", () => {
  const a = generateWordSearch({ entries: MOUNTAIN, seed: "repro-42" })
  const b = generateWordSearch({ entries: MOUNTAIN, seed: "repro-42" })
  assert.deepEqual(a, b)
})

test("F. seeds différents peuvent varier", () => {
  const a = generateWordSearch({ entries: MOUNTAIN, seed: "repro-42" })
  const c = generateWordSearch({ entries: MOUNTAIN, seed: "different" })
  assert.notEqual(JSON.stringify(a), JSON.stringify(c))
})

test("G. aucune collision incompatible", () => {
  const result = expectSuccess(generateWordSearch({ entries: MOUNTAIN, seed: "collide" }))
  const occupancy = new Map<string, string>()
  for (const p of result.placements) {
    for (let i = 0; i < p.cells.length; i++) {
      const { row, column } = p.cells[i]
      const key = `${row},${column}`
      const letter = p.normalizedWord[i]
      const prev = occupancy.get(key)
      if (prev !== undefined) assert.equal(prev, letter, `collision en ${key}`)
      occupancy.set(key, letter)
      assert.equal(result.grid[row][column], letter)
    }
  }
})

test("H. tous les mots placés sont réellement présents", () => {
  const result = expectSuccess(generateWordSearch({ entries: MOUNTAIN, seed: "present" }))
  for (const p of result.placements) {
    assert.equal(readPlacement(result.grid, p), p.normalizedWord)
  }
})

test("I. correction = même géométrie que le jeu", () => {
  const result = expectSuccess(generateWordSearch({ entries: MOUNTAIN, seed: "geo" }))
  const wordCells = wordCellKeySet(result.placements)
  assert.equal(result.grid.length, result.height)
  for (let r = 0; r < result.height; r++) {
    assert.equal(result.grid[r].length, result.width)
    for (let c = 0; c < result.width; c++) {
      const letter = result.grid[r][c]
      assert.match(letter, /^[A-Z]$/)
      const gameHighlight = isHighlightedCell(wordCells, r, c, "game")
      const solutionHighlight = isHighlightedCell(wordCells, r, c, "solution")
      assert.equal(gameHighlight, false)
      if (wordCells.has(`${r},${c}`)) assert.equal(solutionHighlight, true)
    }
  }
})

test("J. grille entièrement remplie A-Z", () => {
  const result = expectSuccess(generateWordSearch({ entries: MOUNTAIN, seed: "fill" }))
  for (const row of result.grid) {
    for (const cell of row) {
      assert.match(cell, /^[A-Z]$/)
    }
  }
})

test("K. orientations autorisées uniquement (V1, pas d'envers)", () => {
  const result = expectSuccess(generateWordSearch({ entries: MOUNTAIN, seed: "dirs" }))
  for (const p of result.placements) {
    assert.ok((ALL_DIRECTIONS as string[]).includes(p.direction), p.direction)
  }
  const onlyE = expectSuccess(
    generateWordSearch({
      entries: MOUNTAIN,
      seed: "east-only",
      directions: ["E"],
      minWords: 8,
    }),
  )
  assert.ok(onlyE.placements.every((p) => p.direction === "E"))
})

test("L. échec structuré si contraintes impossibles", () => {
  const tooFew = generateWordSearch({
    entries: [{ word: "OK" }, { word: "HI" }],
    seed: "fail",
    minWords: 8,
  })
  assert.equal(tooFew.success, false)
  if (!tooFew.success) assert.equal(tooFew.reason, "NOT_ENOUGH_ELIGIBLE_ENTRIES")

  const tooBig = generateWordSearch({
    entries: [
      { word: "ABCDEFGHIJKL" },
      { word: "MNOPQRSTUVWX" },
      { word: "ZYXWVUTSRQPO" },
    ],
    seed: "tiny",
    width: 4,
    height: 4,
    minWords: 3,
  })
  assert.equal(tooBig.success, false)
  if (!tooBig.success) {
    assert.ok(tooBig.reason === "NOT_ENOUGH_ELIGIBLE_ENTRIES" || tooBig.reason === "PLACEMENT_FAILED")
  }
})

test("mots trop courts (< 3) sont rejetés", () => {
  const { eligible, rejected } = partitionEligible(
    normalizeEntries([{ word: "OK" }, { word: "A" }, { word: "SOMMET" }]),
    ALL_DIRECTIONS,
    12,
    12,
  )
  assert.deepEqual(eligible.map((e) => e.word), ["SOMMET"])
  assert.equal(rejected.length, 2)
})

test("targetWords influence effectivement le candidat retenu", () => {
  const aimLow = expectSuccess(
    generateWordSearch({
      entries: MOUNTAIN,
      seed: "aim-target",
      minWords: 6,
      targetWords: 8,
      maxWords: 15,
    }),
  )
  const aimHigh = expectSuccess(
    generateWordSearch({
      entries: MOUNTAIN,
      seed: "aim-target",
      minWords: 6,
      targetWords: 12,
      maxWords: 15,
    }),
  )
  assert.ok(aimLow.stats.placed < aimHigh.stats.placed, `low=${aimLow.stats.placed} high=${aimHigh.stats.placed}`)
  assert.ok(aimLow.stats.placed <= 9, `expected near 8, got ${aimLow.stats.placed}`)
  assert.ok(aimHigh.stats.placed >= 11, `expected near 12, got ${aimHigh.stats.placed}`)
})

test("maxWords n'est jamais dépassé", () => {
  const result = expectSuccess(
    generateWordSearch({
      entries: MOUNTAIN,
      seed: "cap-max",
      minWords: 5,
      targetWords: 10,
      maxWords: 10,
    }),
  )
  assert.ok(result.stats.placed <= 10)
  assert.ok(result.placements.length <= 10)
})

test("success possible entre minWords et targetWords", () => {
  const entries = MOUNTAIN.slice(0, 10)
  const result = expectSuccess(
    generateWordSearch({
      entries,
      seed: "between-min-target",
      minWords: 8,
      targetWords: 12,
      maxWords: 15,
    }),
  )
  assert.ok(result.stats.placed >= 8)
  assert.ok(result.stats.placed <= 10)
  assert.ok(result.stats.placed < 12)
})

test("échec sous minWords", () => {
  const result = generateWordSearch({
    entries: [{ word: "CHAT" }, { word: "CHIEN" }, { word: "OISEAU" }],
    seed: "under-min",
    minWords: 8,
    targetWords: 12,
    maxWords: 15,
  })
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.reason, "NOT_ENOUGH_ELIGIBLE_ENTRIES")
  }
})
