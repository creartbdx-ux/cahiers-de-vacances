/**
 * Short album captions — photo stays primary.
 * Closed-world: only caption / anecdote / place / takenAt / names provided.
 */

export function buildPhotoCaption(input: {
  caption?: string | null
  anecdote?: string | null
  place?: string | null
  takenAt?: string | null
  creatorName?: string | null
  recipientName?: string | null
}): {
  kicker: string | null
  /** Single short phrase under the photo (5–18 words target). */
  caption: string | null
} {
  const rawCaption = input.caption?.trim() || ""
  const rawAnecdote = input.anecdote?.trim() || ""
  const place = input.place?.trim() || extractPlace(rawCaption)
  const creator = input.creatorName?.trim() || null

  let kicker = place ? normalizeKicker(place) : null
  if (!kicker) {
    const fromCaption = firstPlaceLikeToken(rawCaption)
    if (fromCaption) kicker = normalizeKicker(fromCaption)
  }

  // Prefer anecdote as the human line when present; else shorten caption
  let line =
    pickBestLine(rawAnecdote, creator) ||
    pickBestLine(rawCaption, creator) ||
    null

  line = line ? clipWords(line, 18) : null

  // Avoid "PORTO" + "Lui et moi à Porto"
  if (kicker && line && isRedundantWithKicker(kicker, line)) {
    const alt = pickBestLine(rawAnecdote && line === pickBestLine(rawAnecdote, creator) ? rawCaption : rawAnecdote, creator)
    if (alt && !isRedundantWithKicker(kicker, alt)) {
      line = clipWords(alt, 18)
    } else if (rawAnecdote && !isRedundantWithKicker(kicker, rawAnecdote)) {
      line = clipWords(stripLeadingSubjects(rawAnecdote), 18)
    } else {
      // Keep kicker, drop redundant line if nothing better
      const stripped = stripPlaceEcho(line, kicker)
      line = stripped && !isRedundantWithKicker(kicker, stripped) ? clipWords(stripped, 18) : null
    }
  }

  // Attribute lightly when anecdote is first-person and creator known
  if (line && creator && /\b(j['']|je\s+|mon\s+|ma\s+)/i.test(rawAnecdote || rawCaption)) {
    if (!new RegExp(escapeRegExp(creator), "i").test(line)) {
      // Only if line is clearly an opinion fragment
      if (/coup de c[oe]ur|pr[ée]f[ée]r|ador|meilleur souvenir|insist/i.test(rawAnecdote || rawCaption)) {
        line = softenAttribution(line, creator)
      }
    }
  }

  if (line && wordCount(line) < 3 && !kicker) {
    // Too short alone — keep if we have place as kicker elsewhere
  }

  return {
    kicker,
    caption: line,
  }
}

/**
 * Deterministic editorialization used by photo page items.
 * Never returns a second anecdote line (avoids caption clutter).
 */
export function editorializePhotoCopy(input: {
  caption: string | null
  anecdote: string | null
  place: string | null
  takenAt?: string | null
  creatorName?: string | null
  recipientName?: string | null
}): {
  kicker: string | null
  caption: string | null
  anecdote: string | null
} {
  const built = buildPhotoCaption({
    caption: input.caption,
    anecdote: input.anecdote,
    place: input.place,
    takenAt: input.takenAt,
    creatorName: input.creatorName,
    recipientName: input.recipientName,
  })
  return {
    kicker: built.kicker,
    caption: built.caption,
    anecdote: null,
  }
}

/**
 * Optional light AI reformulation hook — closed-world.
 * Without a reformulator, returns the deterministic caption.
 * Callers may pass an async reformulator that only condenses provided fields.
 */
export async function maybeReformulatePhotoCaption(input: {
  caption?: string | null
  anecdote?: string | null
  place?: string | null
  takenAt?: string | null
  creatorName?: string | null
  recipientName?: string | null
  reformulate?: (prompt: {
    fields: Record<string, string>
    deterministic: { kicker: string | null; caption: string | null }
  }) => Promise<{ kicker: string | null; caption: string | null } | null>
}): Promise<{ kicker: string | null; caption: string | null }> {
  const deterministic = buildPhotoCaption(input)
  if (!input.reformulate) return deterministic

  const fields: Record<string, string> = {}
  if (input.caption?.trim()) fields.caption = input.caption.trim()
  if (input.anecdote?.trim()) fields.anecdote = input.anecdote.trim()
  if (input.place?.trim()) fields.place = input.place.trim()
  if (input.takenAt?.trim()) fields.takenAt = input.takenAt.trim()
  if (input.creatorName?.trim()) fields.creatorName = input.creatorName.trim()
  if (input.recipientName?.trim()) fields.recipientName = input.recipientName.trim()

  try {
    const ai = await input.reformulate({ fields, deterministic })
    if (!ai) return deterministic
    // Closed-world: refuse if AI invents tokens not in sources + deterministic
    const blob = Object.values(fields).join(" ").toLowerCase()
    const check = `${ai.kicker ?? ""} ${ai.caption ?? ""}`.toLowerCase()
    const invented = check
      .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
      .filter((w) => w.length > 3)
      .filter((w) => !blob.includes(w) && !`${deterministic.kicker} ${deterministic.caption}`.toLowerCase().includes(w))
    if (invented.length > 2) return deterministic
    return {
      kicker: ai.kicker ?? deterministic.kicker,
      caption: ai.caption ? clipWords(ai.caption, 18) : deterministic.caption,
    }
  } catch {
    return deterministic
  }
}

function normalizeKicker(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 28)
}

function extractPlace(caption: string): string | null {
  const m = caption.match(
    /\b(?:à|au|en|sur)\s+([A-ZÀ-Ü][\wÀ-ÿ' -]{1,40}?)(?:\s+pendant|\s+lors|\.|,|$)/,
  )
  return m?.[1]?.trim() || null
}

function firstPlaceLikeToken(caption: string): string | null {
  const m = caption.match(
    /\b(Whitehaven(?:\s+Beach)?|Sydney(?:\s+Tower)?|Porto|Tokyo|Japon|Australie|Eysines|Lisbonne|Portugal)\b/i,
  )
  return m?.[1] ?? null
}

function pickBestLine(raw: string, _creator: string | null): string | null {
  if (!raw.trim()) return null
  let t = stripLeadingSubjects(raw)
  t = t.replace(/\s+pendant (notre|votre|le) voyage[^.!?]*/gi, "")
  t = t.replace(/\s+/g, " ").trim()
  // Take first sentence
  const sentence = t.split(/(?<=[.!?])\s+/)[0]?.trim() || t
  let out = sentence.replace(/[.!?]+$/, "").trim()
  if (!out) return null
  // Soften first-person opinion into short fragment
  out = out
    .replace(/^j['']avais beaucoup insisté pour y aller et c['']est /i, "")
    .replace(/^c['']est /i, "")
  return out
}

function stripLeadingSubjects(s: string): string {
  return s
    .replace(/^(Sami et moi|Emma et moi|Lui et moi|Elle et moi|Nous|On)\s+/i, "")
    .replace(/^(Sami et moi|Emma et moi)\s+(à|au|en|sur)\s+/i, "")
    .trim()
}

function stripPlaceEcho(line: string, kicker: string): string {
  const k = kicker.toLowerCase()
  let t = line
  t = t.replace(new RegExp(`\\b(à|au|en|sur)\\s+${escapeRegExp(kicker)}\\b`, "ig"), "")
  t = t.replace(new RegExp(`\\b${escapeRegExp(kicker)}\\b`, "ig"), "")
  // Also strip common place forms from kicker words
  for (const part of k.split(/\s+/)) {
    if (part.length > 3) t = t.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, "ig"), "")
  }
  return t.replace(/\s+/g, " ").replace(/^[,:;.\s]+|[,\s]+$/g, "").trim()
}

function isRedundantWithKicker(kicker: string, line: string): boolean {
  const k = kicker.toLowerCase().replace(/\s+/g, " ")
  const l = line.toLowerCase().replace(/\s+/g, " ")
  if (l === k) return true
  if (l.includes(k) && wordCount(line) <= wordCount(kicker) + 4) return true
  // "lui et moi à porto" vs PORTO
  if (new RegExp(`\\b(à|au|en|sur)\\s+${escapeRegExp(k)}\\b`, "i").test(l) && wordCount(line) <= 8) {
    return true
  }
  return false
}

function softenAttribution(line: string, creator: string): string {
  const base = line.replace(/^(mon|ma|mes)\s+/i, "")
  if (/coup de c[oe]ur|meilleur souvenir|moment pr[ée]f[ée]r/i.test(line)) {
    return `Le coup de cœur ${de(creator)}`
  }
  if (/insist/i.test(line)) {
    return `${creator} avait insisté`
  }
  return base
}

function de(name: string): string {
  return /^[AEIOUYÉÈÊÀÂÎÔÙÛaeiouyéèê]/u.test(name) || name === "Emma"
    ? `d’${name}`
    : `de ${name}`
}

function clipWords(s: string, maxWords: number): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  if (words.length <= maxWords) return words.join(" ")
  return `${words.slice(0, maxWords).join(" ")}…`
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
