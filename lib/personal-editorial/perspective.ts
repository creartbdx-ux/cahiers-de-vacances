import type { PersonalEditorialAudienceContext } from "./audience-context"

/**
 * Who the statement is about / whose opinion it is.
 * Traceable attribution — never flip creator feelings onto recipient.
 */
export type PersonalFactPerspective =
  | "CREATOR_PERSPECTIVE_FACT"
  | "RECIPIENT_FACT"
  | "SHARED_FACT"

export interface PerspectiveRewriteResult {
  displayText: string
  shortTitle: string | null
  kicker: string | null
  perspective: PersonalFactPerspective
  /** True when we could only present as attributed quote. */
  attributedQuote: boolean
  usedDeterministicRewrite: boolean
}

const CREATOR_OPINION_RE =
  /\b(j['']ai\s+ador[ée]|j['']ai\s+aim[ée]|c['']est\s+mon\s+moment\s+pr[eé]f[eé]r[eé]|mon\s+moment\s+pr[eé]f[eé]r[eé]|j['']adore|j['']aimais)\b/i

const SHARED_RE =
  /\b(notre\s+voyage|nous\s+(sommes|avons|étions)|notre\s+dernier|ensemble|avec\s+)/i

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function detectPerspective(
  text: string,
  ctx: PersonalEditorialAudienceContext,
): PersonalFactPerspective {
  if (CREATOR_OPINION_RE.test(text)) return "CREATOR_PERSPECTIVE_FACT"
  // "{Recipient} et moi" is creator speaking about shared moment — SHARED with creator voice
  for (const name of ctx.recipientNames) {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\s+et\\s+moi\\b`, "i")
    if (re.test(text)) return "SHARED_FACT"
  }
  if (/\bet\s+moi\b/i.test(text) || /\bmoi\s+et\b/i.test(text)) return "SHARED_FACT"
  if (SHARED_RE.test(text)) return "SHARED_FACT"
  if (/\bvous\b/i.test(text) && ctx.audience === "OTHER_PERSON") return "RECIPIENT_FACT"
  return "SHARED_FACT"
}

/**
 * Extract a likely place lead for shortTitle when present in text.
 */
function extractLeadPlace(text: string): string | null {
  const known = [
    /Whitehaven\s+Beach/i,
    /Sydney\s+Tower(?:\s+Eye)?/i,
    /Sydney/i,
    /Tokyo/i,
    /Japon/i,
    /Australie/i,
    /Portugal/i,
    /onsen/i,
  ]
  for (const re of known) {
    const m = text.match(re)
    if (m) return m[0]!
  }
  return null
}

/**
 * OTHER_PERSON: rewrite creator questionnaire voice → book voice for the reader.
 * Safe deterministic transforms only. Otherwise attributed quote.
 */
export function rewritePerspectiveDeterministic(input: {
  sourceText: string
  ctx: PersonalEditorialAudienceContext
  place?: string | null
}): PerspectiveRewriteResult {
  const raw = input.sourceText.trim()
  const perspective = detectPerspective(raw, input.ctx)
  const place = input.place?.trim() || extractLeadPlace(raw)

  // ME: soft polish only — keep first person when present
  if (input.ctx.audience === "ME") {
    return {
      displayText: raw,
      shortTitle: place,
      kicker: null,
      perspective,
      attributedQuote: false,
      usedDeterministicRewrite: false,
    }
  }

  // OTHER_PERSON is the critical case
  if (input.ctx.audience === "OTHER_PERSON") {
    const creator = input.ctx.creatorName
    let text = raw
    let rewritten = false

    for (const name of input.ctx.recipientNames) {
      const re = new RegExp(`\\b${escapeRegExp(name)}\\s+et\\s+moi\\b`, "gi")
      if (re.test(text)) {
        text = text.replace(
          re,
          creator ? `Avec ${creator}` : "Ensemble",
        )
        rewritten = true
      }
      const re2 = new RegExp(`\\bmoi\\s+et\\s+${escapeRegExp(name)}\\b`, "gi")
      if (re2.test(text)) {
        text = text.replace(re2, creator ? `Avec ${creator}` : "Ensemble")
        rewritten = true
      }
    }

    // Generic "X et moi" without matching name list
    if (/\bet\s+moi\b/i.test(text)) {
      text = text.replace(/\b[\p{L}'-]+\s+et\s+moi\b/giu, creator ? `Avec ${creator}` : "Ensemble")
      rewritten = true
    }

    if (/\bnotre\s+voyage\b/gi.test(text)) {
      text = text.replace(/\bnotre\s+voyage\b/gi, "votre voyage")
      rewritten = true
    }
    if (/\bnotre\s+dernier\s+jour\b/gi.test(text)) {
      text = text.replace(/\bnotre\s+dernier\s+jour\b/gi, "votre dernier jour")
      rewritten = true
    }
    if (/\bnotre\b/gi.test(text)) {
      text = text.replace(/\bnotre\b/gi, "votre")
      rewritten = true
    }
    if (/\bnos\b/gi.test(text)) {
      text = text.replace(/\bnos\b/gi, "vos")
      rewritten = true
    }

    // Creator opinions — keep attribution to creator, never flip to recipient
    if (perspective === "CREATOR_PERSPECTIVE_FACT") {
      if (/\bj['']ai\s+ador[ée]\b/i.test(text) && creator) {
        text = text.replace(/\bj['']ai\s+ador[ée]\b/gi, `${creator} a adoré`)
        rewritten = true
      }
      if (/\bc['']est\s+mon\s+moment\s+pr[eé]f[eé]r[eé]\b/i.test(text) && creator) {
        text = text.replace(
          /\bc['']est\s+mon\s+moment\s+pr[eé]f[eé]r[eé](?:\s+de\s+[^.!?]+)?/gi,
          `c'est le moment préféré de ${creator}`,
        )
        rewritten = true
      } else if (/\bmon\s+moment\s+pr[eé]f[eé]r[eé]\b/i.test(text) && creator) {
        text = text.replace(
          /\bmon\s+moment\s+pr[eé]f[eé]r[eé]\b/gi,
          `le moment préféré de ${creator}`,
        )
        rewritten = true
      }

      // Still first-person residue → attributed quote (truth-preserving)
      if (/\b(j['']|je\s+|mon\s+|ma\s+|mes\s+)/i.test(text)) {
        const who = creator ?? "Créateur"
        return {
          displayText: raw,
          shortTitle: place,
          kicker: who,
          perspective,
          attributedQuote: true,
          usedDeterministicRewrite: true,
        }
      }
    }

    // Forbidden leftover: still starts with "Sami et moi"
    for (const name of input.ctx.recipientNames) {
      const bad = new RegExp(`^\\s*${escapeRegExp(name)}\\s+et\\s+moi\\b`, "i")
      if (bad.test(text)) {
        const who = creator ?? "Créateur"
        return {
          displayText: raw,
          shortTitle: place,
          kicker: who,
          perspective,
          attributedQuote: true,
          usedDeterministicRewrite: true,
        }
      }
    }

    // Build a tighter display for preference + place when safe
    if (
      place &&
      /moment\s+pr[eé]f[eé]r[eé]/i.test(raw) &&
      creator &&
      /voyage/i.test(raw)
    ) {
      const trip = /australie/i.test(raw)
        ? "pendant votre voyage en Australie"
        : /portugal/i.test(raw)
          ? "pendant votre voyage au Portugal"
          : "pendant votre voyage"
      return {
        displayText: `${place}, le moment préféré de ${creator} ${trip}.`,
        shortTitle: place,
        kicker: null,
        perspective: "CREATOR_PERSPECTIVE_FACT",
        attributedQuote: false,
        usedDeterministicRewrite: true,
      }
    }

    if (rewritten) {
      // Clean leftover "toujours lors" awkwardness lightly
      text = text
        .replace(/\btoujours\s+lors\b/gi, "lors")
        .replace(/\s{2,}/g, " ")
        .trim()
      return {
        displayText: text,
        shortTitle: place,
        kicker: null,
        perspective,
        attributedQuote: false,
        usedDeterministicRewrite: true,
      }
    }

    // If still first-person creator voice without safe rewrite → quote
    if (/\b(j['']|je\s+|moi\b)/i.test(raw)) {
      const who = creator ?? "Créateur"
      return {
        displayText: raw,
        shortTitle: place,
        kicker: who,
        perspective,
        attributedQuote: true,
        usedDeterministicRewrite: true,
      }
    }
  }

  // DUO / GROUP: light notre→votre when creator participates
  if (
    (input.ctx.audience === "DUO" || input.ctx.audience === "GROUP") &&
    input.ctx.creatorIsParticipant
  ) {
    let text = raw
    let rewritten = false
    if (/\bnotre\s+voyage\b/gi.test(text)) {
      text = text.replace(/\bnotre\s+voyage\b/gi, "votre voyage")
      rewritten = true
    }
    return {
      displayText: rewritten ? text : raw,
      shortTitle: place,
      kicker: null,
      perspective,
      attributedQuote: false,
      usedDeterministicRewrite: rewritten,
    }
  }

  return {
    displayText: raw,
    shortTitle: place,
    kicker: null,
    perspective,
    attributedQuote: false,
    usedDeterministicRewrite: false,
  }
}

/** Reject display text that still sounds like questionnaire creator→self for OTHER. */
export function hasForbiddenCreatorVoice(
  displayText: string,
  ctx: PersonalEditorialAudienceContext,
): boolean {
  if (ctx.audience !== "OTHER_PERSON") return false
  for (const name of ctx.recipientNames) {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\s+et\\s+moi\\b`, "i")
    if (re.test(displayText)) return true
  }
  return false
}
