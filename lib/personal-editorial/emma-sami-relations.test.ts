import assert from "node:assert/strict"
import { test } from "node:test"
import type { BookProfileV1 } from "@/lib/questionnaire/types"
import { collectPersonalBlocks } from "./editorialize-block"
import { composePersonalEditorialPages } from "./compose"
import { localBlockKicker, pairEditorialCompatibility } from "./relations"
import { buildPersonalEditorialAudienceContext } from "./audience-context"
import { extractPersonalSourceFacts } from "./facts"
import { groupRelationMeta } from "./compatibility"

/**
 * Fixture fidèle au questionnaire réel Emma → Sami.
 */
function emmaSamiProfile(): BookProfileV1 {
  return {
    schemaVersion: 1,
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    creator: {
      firstName: "Emma",
      isParticipant: false,
      participantId: null,
    },
    participants: [{ id: "sami", firstName: "Sami" }],
    sharedProfile: { interestUniverseIds: ["TRAVEL"] },
    individualProfiles: [],
    personalFacts: [
      { id: "f1", category: "FOOD", value: "A" },
      { id: "f2", category: "MUSIC", value: "B" },
      { id: "f3", category: "PLACE", value: "C" },
    ],
    memories: [
      {
        id: "work",
        text: "Aux débuts de la première entreprise, un rendez-vous de démarchage : on s'est cogné la tête en même temps, fou rire.",
      },
      {
        id: "kiss",
        text: "Premier baiser à Eysines, le 30 mars 2019.",
      },
      {
        id: "whitehaven",
        text: "Sami et moi lors de notre voyage en Australie, sur la plage de Whitehaven Beach. J'avais insisté pour l'excursion. J'ai adoré cette plage, c'est mon souvenir préféré de notre voyage.",
      },
      {
        id: "tokyo",
        text: "Escale au Japon pendant notre voyage en Australie : on a testé un onsen à Tokyo, chacun de son côté, nus au milieu d'une foule asiatique.",
      },
      {
        id: "sydney",
        text: "Tout en haut de la Sydney Tower Eye. C'était notre dernier jour en Australie. Anecdote : le Coca de Sami sans bulles.",
      },
      {
        id: "roadtrip",
        text: "Road trip sur la côte est australienne avec un couple d'amis, pendant notre voyage en Australie.",
      },
    ],
    insideJokes: [],
    gamePreferences: { likedTypes: ["QUIZ"], difficulty: 3 },
    visualPreferences: { paletteId: "PINK", styleId: "RETRO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [
      {
        id: "porto",
        useAuthorized: true,
        storagePath: "porto.jpg",
        caption: "Porto.",
        anecdote:
          "Photo prise après une dispute. Elle a marqué le début d'une forme de réconciliation. Emma adore cette photo ; Sami n'aime pas particulièrement sa tête dessus.",
      },
    ],
  }
}

function factsFor(id: string, text: string, place?: string) {
  const ctx = buildPersonalEditorialAudienceContext(emmaSamiProfile())
  return extractPersonalSourceFacts({
    sourceId: id,
    sourceType: "MEMORY",
    rawText: text,
    place,
    ctx,
  })
}

test("PART_OF_TRIP détecté uniquement si explicitement présent", () => {
  const tokyo = factsFor(
    "tokyo",
    "Escale au Japon pendant notre voyage en Australie : onsen à Tokyo.",
  )
  const wh = factsFor(
    "wh",
    "Whitehaven Beach pendant notre voyage en Australie. Mon moment préféré.",
  )
  const r = pairEditorialCompatibility(tokyo, wh)
  assert.equal(r.level, "STRONG")
  assert.equal(r.relation.type, "PART_OF_TRIP")

  const tokyoNoLink = factsFor("tokyo2", "Onsen à Tokyo au Japon.")
  const r2 = pairEditorialCompatibility(tokyoNoLink, wh)
  assert.notEqual(r2.relation.type, "PART_OF_TRIP")
})

test("same participants != STRONG (Eysines + Porto = NEUTRAL)", () => {
  const kiss = factsFor("kiss", "Premier baiser à Eysines, le 30 mars 2019.", "Eysines")
  const porto = factsFor(
    "porto",
    "Photo à Porto après une dispute, début de réconciliation. Emma adore cette photo.",
    "Porto",
  )
  const r = pairEditorialCompatibility(kiss, porto)
  assert.equal(r.level, "NEUTRAL")
  assert.ok(
    r.reason.includes("same participants") || r.relation.type === "RELATED_TO" || r.relation.type === "NONE",
    r.reason,
  )
})

test("Whitehaven + Tokyo = STRONG ; Sydney + road trip = STRONG", () => {
  const wh = factsFor(
    "wh",
    "Whitehaven Beach, voyage en Australie. Souvenir préféré.",
  )
  const tokyo = factsFor(
    "tokyo",
    "Escale au Japon pendant notre voyage en Australie, onsen à Tokyo.",
  )
  const sydney = factsFor(
    "sydney",
    "Sydney Tower Eye, dernier jour en Australie. Coca sans bulles.",
  )
  const road = factsFor(
    "road",
    "Road trip côte est australienne pendant notre voyage en Australie.",
  )
  assert.equal(pairEditorialCompatibility(wh, tokyo).level, "STRONG")
  assert.equal(pairEditorialCompatibility(sydney, road).level, "STRONG")
})

test("kicker Tokyo/Japon local — jamais Australie par héritage", () => {
  const tokyo = factsFor(
    "tokyo",
    "Escale au Japon pendant notre voyage en Australie : onsen à Tokyo, nus au milieu d'une foule asiatique.",
  )
  const k = localBlockKicker(tokyo)
  assert.ok(k)
  assert.match(k!, /JAPON|TOKYO|ESCALE/i)
  assert.ok(!/^australie$/i.test(k!))
})

test("fixture Emma→Sami : grouping cohérent, pas Eysines et Porto", () => {
  const profile = emmaSamiProfile()
  const blocks = collectPersonalBlocks({ profile, creatorName: "Emma" })
  assert.ok(blocks.length >= 6)

  const pages = composePersonalEditorialPages(blocks, "emma-sami-real")
  const pages2 = composePersonalEditorialPages(blocks, "emma-sami-real")
  assert.equal(pages.length, pages2.length)
  assert.deepEqual(
    pages.map((p) => p.layoutId),
    pages2.map((p) => p.layoutId),
  )

  // No CONFLICT pages
  for (const p of pages) {
    const meta = groupRelationMeta(p.blocks)
    assert.notEqual(meta.level, "CONFLICT")
    assert.ok(p.pageRelationType === "STRONG" || p.pageRelationType === "NEUTRAL")
    assert.ok(p.pageRelationReason)
  }

  // No fake "Eysines et Porto" / concat titles
  for (const p of pages) {
    assert.ok(!/eysines\s+et\s+porto|porto\s+et\s+eysines|eysines\s*·\s*porto/i.test(p.theme.title))
  }

  // Find Whitehaven + Tokyo if co-packed → STRONG
  const ausJapanPage = pages.find(
    (p) =>
      p.blocks.some((b) => /whitehaven/i.test(b.originalText)) &&
      p.blocks.some((b) => /tokyo|onsen|escale/i.test(b.originalText)),
  )
  if (ausJapanPage) {
    assert.equal(ausJapanPage.pageRelationType, "STRONG")
    assert.match(ausJapanPage.pageRelationReason ?? "", /PART_OF_TRIP|Australie/i)
  }

  // Tokyo kicker never AUSTRALIE alone
  for (const p of pages) {
    for (const b of p.blocks) {
      if (!/tokyo|onsen/i.test(b.originalText)) continue
      const k = (b.kicker || localBlockKicker(b.facts) || "").toUpperCase()
      assert.ok(!/^AUSTRALIE$/.test(k), `kicker=${k}`)
      assert.ok(/JAPON|TOKYO|ESCALE/.test(k), `kicker=${k}`)
    }
  }

  // Prefer coherent pages over ultra-compression: typically 4–7 for this fixture
  assert.ok(pages.length >= 3 && pages.length <= 8, `pages=${pages.length}`)
})

test("CONFLICT work×travel never packed together without STRONG link", () => {
  const profile = emmaSamiProfile()
  const blocks = collectPersonalBlocks({ profile, creatorName: "Emma" })
  const work = blocks.find((b) => /d[eé]marchage|entreprise/i.test(b.originalText))
  const travel = blocks.find((b) => /whitehaven/i.test(b.originalText))
  assert.ok(work && travel)
  const r = pairEditorialCompatibility(work!.facts, travel!.facts)
  assert.equal(r.level, "CONFLICT")

  const pages = composePersonalEditorialPages(blocks, "no-conflict-pack")
  for (const p of pages) {
    const hasWork = p.blocks.some((b) => b === work || (b.type === "MEMORY" && b.sourceMemoryId === (work!.type === "MEMORY" ? work!.sourceMemoryId : "")))
    const hasTravel = p.blocks.some(
      (b) => /whitehaven|australie|tokyo|sydney|road/i.test(b.originalText),
    )
    if (hasWork && hasTravel && p.blocks.includes(work!)) {
      // Should not share page with whitehaven specifically
      assert.ok(
        !p.blocks.some((b) => /whitehaven/i.test(b.originalText)),
        "work+whitehaven packed",
      )
    }
  }
})
