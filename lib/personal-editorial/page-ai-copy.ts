import type { ContentGenerationProvider, JsonSchemaObject } from "@/lib/content-generation/types"
import { createDefaultContentGenerationProvider } from "@/lib/content-generation/provider"
import type { PersonalEditorialAudienceContext } from "./audience-context"
import type { PersonalBlockV1, PersonalEditorialPageV1 } from "./types"
import { validateEditorialCopy, validatePageTitle } from "./validate-editorial"
import { buildEditorialCopyFromFacts } from "./editorial-copy"
import { assertPagePhotoProvenance } from "./provenance"

export type PersonalEditorialMode = "AI" | "FALLBACK"

export interface PersonalEditorialPageCopyV1 {
  pageTitle: string
  pageKicker: string | null
  pageIntro: string | null
  blocks: Array<{
    sourceId: string
    kicker: string | null
    title: string | null
    text: string
  }>
}

export interface PageEditorialResult {
  page: PersonalEditorialPageV1
  mode: PersonalEditorialMode
  validationOk: boolean
  validationReasons: string[]
  usedRepair: boolean
}

const PAGE_COPY_SCHEMA: JsonSchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["pageTitle", "pageKicker", "pageIntro", "blocks"],
  properties: {
    pageTitle: { type: "string", minLength: 1 },
    pageKicker: { type: ["string", "null"] },
    pageIntro: { type: ["string", "null"] },
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "kicker", "title", "text"],
        properties: {
          sourceId: { type: "string", minLength: 1 },
          kicker: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          text: { type: "string", minLength: 1 },
        },
      },
    },
  },
}

function blockSourceId(b: PersonalBlockV1): string {
  return b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId
}

function buildPageAiPayload(
  page: PersonalEditorialPageV1,
  ctx: PersonalEditorialAudienceContext,
) {
  return {
    audience: ctx.audience,
    creator: { name: ctx.creatorName },
    recipient: { names: ctx.recipientNames },
    addressMode: ctx.addressMode,
    pageContext: {
      layout: page.layoutId,
      semanticTheme: page.theme.title,
      groupingReason: page.theme.groupingReason,
      sources: page.blocks.map((b) => ({
        sourceId: blockSourceId(b),
        sourceType: b.type,
        originalText: b.originalText,
        facts: {
          sharedFacts: b.facts.sharedFacts,
          creatorOpinions: b.facts.creatorOpinions,
          recipientFacts: b.facts.recipientFacts,
          locations: b.facts.locations,
          tripContext: b.facts.tripContext,
          events: b.facts.events,
          category: b.facts.category,
        },
      })),
    },
  }
}

function systemPrompt(): string {
  return [
    "Vous êtes le rédacteur d'un cahier personnalisé destiné à être offert.",
    "Les textes fournis proviennent d'un questionnaire rempli par le créateur.",
    "Ils ne doivent PAS être recopiés tels quels.",
    "",
    "Mission : transformer ces informations en une page éditoriale naturelle,",
    "concise, élégante et agréable à lire pour le destinataire.",
    "",
    "Vous devez conserver strictement les faits.",
    "Vous pouvez : condenser, reformuler, changer la structure, choisir un angle,",
    "créer un titre / mini-titre, supprimer des répétitions,",
    "transformer un récit brut en légende ou fragment,",
    "attribuer explicitement une opinion à son auteur.",
    "",
    "Vous ne pouvez pas : inventer un événement, une émotion, une date, un lieu,",
    "une personne ; attribuer à un destinataire une opinion du créateur ;",
    "créer un lien entre deux événements non supporté par les sources.",
    "",
    "OTHER_PERSON : écrivez POUR le destinataire. Évitez « X et moi », « J'ai adoré »",
    "non attribué, et le ton documentaire « Vous êtes allé… » répété.",
    "Une source peut devenir titre + une ligne (pas obligatoirement un paragraphe).",
    "",
    "Si les sources n'ont pas de lien narratif certain,",
    "utilisez un titre de page neutre plutôt qu'inventer une histoire commune.",
    "Interdit : concaténer des tags avec « & », titres génériques répétés",
    "(« Un moment à garder », « Souvenir partagé »).",
    "",
    "Retournez EXACTEMENT un block par sourceId fourni — ni plus, ni moins.",
    "sourceId de chaque block DOIT matcher exactement un sourceId d'entrée.",
  ].join("\n")
}

function applyDeterministicFallback(page: PersonalEditorialPageV1): PersonalEditorialPageV1 {
  // Keep existing fact-based displayText already on blocks (from collect).
  return {
    ...page,
    editorialMode: "FALLBACK",
    pageKicker: page.pageKicker ?? null,
    pageIntro: page.pageIntro ?? null,
  }
}

function validatePageCopy(
  copy: PersonalEditorialPageCopyV1,
  page: PersonalEditorialPageV1,
  ctx: PersonalEditorialAudienceContext,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const expectedIds = page.blocks.map(blockSourceId).sort()
  const gotIds = copy.blocks.map((b) => b.sourceId).sort()
  if (expectedIds.length !== gotIds.length || expectedIds.some((id, i) => id !== gotIds[i])) {
    reasons.push("sourceIds-mismatch")
  }

  const titleCheck = validatePageTitle(copy.pageTitle)
  if (!titleCheck.ok) reasons.push(...titleCheck.reasons)

  if (/un moment à garder|souvenir partagé|un souvenir à garder/i.test(copy.pageTitle)) {
    reasons.push("titre-generique")
  }

  for (const blockCopy of copy.blocks) {
    const block = page.blocks.find((b) => blockSourceId(b) === blockCopy.sourceId)
    if (!block) {
      reasons.push(`unknown-source:${blockCopy.sourceId}`)
      continue
    }
    const v = validateEditorialCopy({
      copy: {
        kicker: blockCopy.kicker,
        shortTitle: blockCopy.title,
        displayText: blockCopy.text,
        perspective: "NEUTRAL_EDITORIAL",
        attributedQuote: false,
        claimsUsed: [],
      },
      facts: block.facts,
      recipientNames: ctx.recipientNames,
    })
    if (!v.ok) reasons.push(...v.reasons.map((r) => `${blockCopy.sourceId}:${r}`))
  }

  return { ok: reasons.length === 0, reasons }
}

function mergeAiCopyOntoPage(
  page: PersonalEditorialPageV1,
  copy: PersonalEditorialPageCopyV1,
): PersonalEditorialPageV1 {
  const byId = new Map(copy.blocks.map((b) => [b.sourceId, b]))
  const blocks = page.blocks.map((b) => {
    const c = byId.get(blockSourceId(b))
    if (!c) return b
    return {
      ...b,
      title: c.title?.trim() || b.shortTitle || b.title,
      shortTitle: c.title?.trim() || b.shortTitle,
      kicker: c.kicker,
      eyebrow: c.kicker || b.eyebrow,
      body: c.text,
      displayText: c.text,
      usedAi: true,
      attributedQuote: false,
      claimsUsed: [...b.claimsUsed, "ai-page-copy"],
    }
  })

  assertPagePhotoProvenance(blocks)

  return {
    ...page,
    blocks,
    theme: {
      ...page.theme,
      title: copy.pageTitle.trim() || page.theme.title,
    },
    pageKicker: copy.pageKicker,
    pageIntro: copy.pageIntro,
    editorialMode: "AI",
  }
}

function secureAttributedFallback(
  page: PersonalEditorialPageV1,
  ctx: PersonalEditorialAudienceContext,
): PersonalEditorialPageV1 {
  const who = ctx.creatorName || "Créateur"
  const blocks = page.blocks.map((b) => {
    const copy = buildEditorialCopyFromFacts({ facts: b.facts, ctx })
    // Force attributed if still risky
    const text = copy.attributedQuote
      ? copy.displayText
      : copy.displayText
    return {
      ...b,
      title: copy.shortTitle || b.title,
      shortTitle: copy.shortTitle,
      kicker: copy.attributedQuote ? who : copy.kicker,
      body: text,
      displayText: text,
      attributedQuote: copy.attributedQuote,
      perspective: copy.perspective,
      claimsUsed: copy.claimsUsed,
      usedAi: false,
    }
  })
  return {
    ...page,
    blocks,
    editorialMode: "FALLBACK",
    pageKicker: null,
    pageIntro: null,
  }
}

/**
 * One structured AI call to editorialize an entire composed page.
 * Falls back to deterministic / attributed copy on failure.
 */
export async function editorializePersonalEditorialPage(input: {
  page: PersonalEditorialPageV1
  ctx: PersonalEditorialAudienceContext
  seed: string
  provider?: ContentGenerationProvider
  forceFallback?: boolean
}): Promise<PageEditorialResult> {
  const base = {
    ...input.page,
    editorialMode: input.page.editorialMode ?? "FALLBACK",
  }

  if (input.forceFallback) {
    return {
      page: applyDeterministicFallback(base),
      mode: "FALLBACK",
      validationOk: true,
      validationReasons: ["force-fallback"],
      usedRepair: false,
    }
  }

  const provider = input.provider ?? createDefaultContentGenerationProvider()
  if (!provider.configured) {
    return {
      page: applyDeterministicFallback(base),
      mode: "FALLBACK",
      validationOk: true,
      validationReasons: ["provider-not-configured"],
      usedRepair: false,
    }
  }

  const payload = buildPageAiPayload(base, input.ctx)
  const expectedIds = base.blocks.map(blockSourceId)

  async function callOnce(seed: string): Promise<PersonalEditorialPageCopyV1 | null> {
    const raw = await provider.generateStructured<PersonalEditorialPageCopyV1>({
      system: systemPrompt(),
      input: {
        ...payload,
        requiredSourceIds: expectedIds,
        instruction:
          "Retournez exactement un block pour chaque requiredSourceIds, dans n'importe quel ordre.",
      },
      schemaName: "personal_editorial_page_copy_v1",
      schema: PAGE_COPY_SCHEMA,
      seed,
    })
    if (!raw.ok) return null
    return {
      pageTitle: String(raw.data.pageTitle ?? "").trim(),
      pageKicker:
        raw.data.pageKicker === null || raw.data.pageKicker === undefined
          ? null
          : String(raw.data.pageKicker).trim() || null,
      pageIntro:
        raw.data.pageIntro === null || raw.data.pageIntro === undefined
          ? null
          : String(raw.data.pageIntro).trim() || null,
      blocks: (raw.data.blocks ?? []).map((b) => ({
        sourceId: String(b.sourceId ?? "").trim(),
        kicker:
          b.kicker === null || b.kicker === undefined
            ? null
            : String(b.kicker).trim() || null,
        title:
          b.title === null || b.title === undefined
            ? null
            : String(b.title).trim() || null,
        text: String(b.text ?? "").trim(),
      })),
    }
  }

  let copy = await callOnce(input.seed)
  let usedRepair = false

  if (copy) {
    let validation = validatePageCopy(copy, base, input.ctx)
    if (!validation.ok) {
      usedRepair = true
      copy = await callOnce(`${input.seed}:repair`)
      if (copy) {
        validation = validatePageCopy(copy, base, input.ctx)
        if (validation.ok) {
          return {
            page: mergeAiCopyOntoPage(base, copy),
            mode: "AI",
            validationOk: true,
            validationReasons: [],
            usedRepair: true,
          }
        }
      }
      return {
        page: secureAttributedFallback(base, input.ctx),
        mode: "FALLBACK",
        validationOk: false,
        validationReasons: validation.reasons,
        usedRepair: true,
      }
    }
    return {
      page: mergeAiCopyOntoPage(base, copy),
      mode: "AI",
      validationOk: true,
      validationReasons: [],
      usedRepair: false,
    }
  }

  return {
    page: secureAttributedFallback(base, input.ctx),
    mode: "FALLBACK",
    validationOk: false,
    validationReasons: ["provider-error"],
    usedRepair: false,
  }
}

/**
 * After packing: one AI call per page (primary path when provider configured).
 */
export async function editorializeComposedPersonalPages(input: {
  pages: PersonalEditorialPageV1[]
  ctx: PersonalEditorialAudienceContext
  seed: string
  provider?: ContentGenerationProvider
  forceFallback?: boolean
}): Promise<{
  pages: PersonalEditorialPageV1[]
  results: PageEditorialResult[]
  aiCallCount: number
  overallMode: PersonalEditorialMode | "MIXED"
}> {
  const results: PageEditorialResult[] = []
  let aiCallCount = 0

  for (let i = 0; i < input.pages.length; i++) {
    const result = await editorializePersonalEditorialPage({
      page: input.pages[i]!,
      ctx: input.ctx,
      seed: `${input.seed}:page:${i}`,
      provider: input.provider,
      forceFallback: input.forceFallback,
    })
    if (result.mode === "AI") {
      aiCallCount += result.usedRepair ? 2 : 1
    } else if (result.usedRepair) {
      // attempted AI then fell back
      aiCallCount += 2
    } else if (
      !input.forceFallback &&
      (input.provider ?? createDefaultContentGenerationProvider()).configured
    ) {
      // provider error without successful AI — counted as 1 attempt
      if (result.validationReasons.includes("provider-error")) aiCallCount += 1
    }
    results.push(result)
  }

  const modes = new Set(results.map((r) => r.mode))
  const overallMode =
    modes.size === 1 ? ([...modes][0] as PersonalEditorialMode) : "MIXED"

  return {
    pages: results.map((r) => r.page),
    results,
    aiCallCount,
    overallMode,
  }
}
