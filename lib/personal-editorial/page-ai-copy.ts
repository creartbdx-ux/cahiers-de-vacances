import type { ContentGenerationProvider, JsonSchemaObject } from "@/lib/content-generation/types"
import { createDefaultContentGenerationProvider } from "@/lib/content-generation/provider"
import type { PersonalEditorialAudienceContext } from "./audience-context"
import type { PersonalBlockV1, PersonalEditorialPageV1 } from "./types"
import { validatePageLevelCopy } from "./validate-editorial"
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
  unsupportedClaims: string[]
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

function systemPrompt(ctx: PersonalEditorialAudienceContext): string {
  const creator = ctx.creatorName?.trim() || null
  const recipients = ctx.recipientNames.filter(Boolean).join(", ") || null
  return [
    "Vous êtes le rédacteur d'un cahier personnalisé destiné à être offert.",
    "Les textes fournis proviennent d'un questionnaire rempli par le créateur.",
    "Ils ne doivent PAS être recopiés tels quels.",
    "",
    "=== MONDE FERMÉ (CLOSED WORLD) — RÈGLE ABSOLUE ===",
    "Vous travaillez en monde fermé.",
    "Vous ne devez utiliser aucune connaissance extérieure aux informations",
    "fournies dans les sources.",
    "Même si vous connaissez un lieu, une pratique, un pays ou un événement,",
    "vous ne devez ajouter aucune précision qui n'est pas présente dans les faits fournis.",
    "Votre rôle est d'éditer, condenser et reformuler. Pas d'enrichir.",
    "Interdit : culture générale, tourisme, histoire, caractéristiques connues",
    "d'un lieu / pratique / produit / pays (ex. onsen = spa, nudité, eau chaude).",
    "Interdit : adjectifs évaluatifs non supportés (réputé, savoureux, typique,",
    "authentique, incontournable) s'ils ne figurent pas dans la source.",
    "",
    "Mission : page éditoriale NATURELLE, COURTE, PRÉCISE pour le destinataire.",
    "Si une formulation simple fonctionne, préférez-la à une formulation",
    "métaphorique, sentimentale ou littéraire.",
    "Cahier ludique et élégant — pas un album lyrique.",
    "",
    "Évitez (sauf si littéralement dans les sources) :",
    "« votre histoire a connu… », « un instant suspendu », « gravé dans la mémoire »,",
    "« un moment précieux », « ces instants qui racontent… »,",
    "« une place particulière dans la mémoire », « souvenirs en suspens ».",
    "",
    creator
      ? `Créateur connu : ${creator}. Attribuez ses opinions avec ce prénom.`
      : "Créateur : prénom inconnu — restez neutre sans périphrase.",
    "N'écrivez JAMAIS « la personne qui a créé ce souvenir »,",
    "« la personne qui a rempli le questionnaire », « la personne qui a choisi cette photo ».",
    recipients ? `Destinataire(s) : ${recipients}.` : "",
    "",
    "Opinions / goûts / émotions / préférences :",
    "restent attribués à leur auteur (Fact Model). Jamais « votre moment préféré »",
    "si la préférence est celle du créateur.",
    "",
    "Longueur : beaucoup de blocs = titre + une ligne (≈ 15–35 mots).",
    "Ne conservez pas toute la longueur du questionnaire.",
    "N'embellissez pas pour remplir l'espace (pas d'adjectifs décoratifs,",
    "pas d'interprétation émotionnelle, pas de savoir général).",
    "",
    "Titres de page : naturels, concrets, liés à la matière",
    "(ex. « En Australie », phrase tirée du souvenir). Pas de titre abstrait",
    "inventé pour « faire joli ». Sans thème fort → titre sobre.",
    "Titres de blocs : concrets (lieu, événement) plutôt que formules éditoriales.",
    "",
    "pageIntro : OPTIONNEL. Si aucune information utile, pageIntro = null.",
    "Ne produisez pas d'intro poétique automatique.",
    "",
    "OTHER_PERSON : écrivez POUR le destinataire. Évitez « X et moi », « J'ai adoré »",
    "non attribué. Une source peut devenir titre + une ligne.",
    "",
    "Si les sources n'ont pas de lien narratif certain,",
    "titre de page neutre — pas d'histoire commune inventée.",
    "Interdit : concaténer des tags avec « & », titres génériques",
    "(« Un moment à garder », « Souvenir partagé »).",
    "",
    "Retournez EXACTEMENT un block par sourceId fourni — ni plus, ni moins.",
    "sourceId de chaque block DOIT matcher exactement un sourceId d'entrée.",
  ]
    .filter(Boolean)
    .join("\n")
}

function repairInstruction(unsupportedClaims: string[]): string {
  return [
    "REPAIR : la copie précédente a été rejetée (monde fermé).",
    "Simplifiez. Supprimez tout élément non supporté par les facts.",
    "Utilisez les prénoms pour l'attribution. Préférez phrases courtes et concrètes.",
    "pageIntro = null si inutile. Titres concrets, pas de poésie.",
    unsupportedClaims.length
      ? `Claims non supportés à éliminer : ${unsupportedClaims.join(" | ")}`
      : "",
    "Retournez exactement un block par requiredSourceIds.",
  ]
    .filter(Boolean)
    .join("\n")
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
): { ok: boolean; reasons: string[]; unsupportedClaims: string[] } {
  const reasons: string[] = []
  const unsupportedClaims: string[] = []
  const expectedIds = page.blocks.map(blockSourceId).sort()
  const gotIds = copy.blocks.map((b) => b.sourceId).sort()
  if (expectedIds.length !== gotIds.length || expectedIds.some((id, i) => id !== gotIds[i])) {
    reasons.push("sourceIds-mismatch")
    unsupportedClaims.push("sourceIds mismatch (ajout ou suppression)")
  }

  const factsBySourceId = new Map(
    page.blocks.map((b) => [blockSourceId(b), b.facts] as const),
  )
  const level = validatePageLevelCopy({
    pageTitle: copy.pageTitle,
    pageIntro: copy.pageIntro,
    blocks: copy.blocks,
    factsBySourceId,
    ctx,
  })
  reasons.push(...level.reasons)
  unsupportedClaims.push(...(level.unsupportedClaims ?? []))

  return {
    ok: reasons.length === 0,
    reasons: [...new Set(reasons)],
    unsupportedClaims: [...new Set(unsupportedClaims)],
  }
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
      unsupportedClaims: [],
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
      unsupportedClaims: [],
      usedRepair: false,
    }
  }

  const payload = buildPageAiPayload(base, input.ctx)
  const expectedIds = base.blocks.map(blockSourceId)
  const system = systemPrompt(input.ctx)

  async function callOnce(
    seed: string,
    extraInstruction?: string,
  ): Promise<PersonalEditorialPageCopyV1 | null> {
    const raw = await provider.generateStructured<PersonalEditorialPageCopyV1>({
      system,
      input: {
        ...payload,
        requiredSourceIds: expectedIds,
        instruction: [
          "Retournez exactement un block pour chaque requiredSourceIds, dans n'importe quel ordre.",
          "pageIntro = null si aucune info utile.",
          "Textes courts (souvent 15–35 mots). Titres concrets.",
          extraInstruction ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
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
  let lastUnsupported: string[] = []

  if (copy) {
    let validation = validatePageCopy(copy, base, input.ctx)
    lastUnsupported = validation.unsupportedClaims
    if (!validation.ok) {
      usedRepair = true
      copy = await callOnce(
        `${input.seed}:repair`,
        repairInstruction(validation.unsupportedClaims),
      )
      if (copy) {
        validation = validatePageCopy(copy, base, input.ctx)
        lastUnsupported = validation.unsupportedClaims
        if (validation.ok) {
          return {
            page: mergeAiCopyOntoPage(base, copy),
            mode: "AI",
            validationOk: true,
            validationReasons: [],
            unsupportedClaims: [],
            usedRepair: true,
          }
        }
      }
      return {
        page: secureAttributedFallback(base, input.ctx),
        mode: "FALLBACK",
        validationOk: false,
        validationReasons: validation.reasons,
        unsupportedClaims: lastUnsupported,
        usedRepair: true,
      }
    }
    return {
      page: mergeAiCopyOntoPage(base, copy),
      mode: "AI",
      validationOk: true,
      validationReasons: [],
      unsupportedClaims: [],
      usedRepair: false,
    }
  }

  return {
    page: secureAttributedFallback(base, input.ctx),
    mode: "FALLBACK",
    validationOk: false,
    validationReasons: ["provider-error"],
    unsupportedClaims: [],
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
