/**
 * Strict semantic metadata from source text only.
 * Keywords must appear in the source — never invent tags.
 */

export type PersonalSemanticCategory =
  | "TRAVEL"
  | "RELATIONSHIP"
  | "WORK"
  | "FAMILY"
  | "FUNNY"
  | "HABIT"
  | "MILESTONE"
  | "OTHER"

export interface PersonalSemanticMeta {
  category: PersonalSemanticCategory
  semanticTags: string[]
  /** Locations explicitly mentioned (normalized display forms). */
  locations: string[]
  /** Trip / voyage label only if explicitly mentioned (e.g. "Australie"). */
  trips: string[]
  /** Explicit period fragments only if present in source (rare). */
  periodHint: string | null
}

const LOCATION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bwhitehaven\b/i, label: "Whitehaven Beach" },
  { re: /\bsydney\s+tower\b/i, label: "Sydney Tower" },
  { re: /\bsydney\b/i, label: "Sydney" },
  { re: /\btokyo\b|\btoky[oô]\b/i, label: "Tokyo" },
  { re: /\bjapon\b|\bjapan\b/i, label: "Japon" },
  { re: /\baustralie\b|\baustralia\b/i, label: "Australie" },
  { re: /\bportugal\b/i, label: "Portugal" },
  { re: /\bonsen\b/i, label: "Onsen" },
  { re: /\bplage\b/i, label: "Plage" },
]

const TRIP_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bvoyage\s+en\s+australie\b|\ben\s+australie\b/i, label: "Australie" },
  { re: /\bvoyage\s+au\s+japon\b|\bau\s+japon\b/i, label: "Japon" },
  { re: /\bvoyage\s+au\s+portugal\b|\bau\s+portugal\b|\ben\s+portugal\b/i, label: "Portugal" },
  { re: /\bescale\b/i, label: "Escale" },
]

const CATEGORY_RULES: Array<{
  category: PersonalSemanticCategory
  patterns: RegExp[]
}> = [
  {
    category: "TRAVEL",
    patterns: [
      /\bvoyage\b/i,
      /\bplage\b/i,
      /\bescale\b/i,
      /\bonsen\b/i,
      /\btour\b/i,
      /\baustralie\b/i,
      /\bjapon\b/i,
      /\bportugal\b/i,
      /\bsydney\b/i,
      /\btokyo\b/i,
      /\bwhitehaven\b/i,
    ],
  },
  {
    category: "RELATIONSHIP",
    patterns: [
      /\bbisou\b/i,
      /\bbaiser\b/i,
      /\bamour\b/i,
      /\brencontre\b/i,
      /\bensemble\b/i,
      /\bcouple\b/i,
      /\brendez[- ]?vous\b/i,
    ],
  },
  {
    category: "WORK",
    patterns: [
      /\bentreprise\b/i,
      /\bd[eé]marchage\b/i,
      /\btravail\b/i,
      /\bprofessionnel\b/i,
      /\bbureau\b/i,
      /\bcoll[eè]gue\b/i,
    ],
  },
  {
    category: "FAMILY",
    patterns: [/\bfamille\b/i, /\bmaman\b/i, /\bpapa\b/i, /\bfr[eè]re\b/i, /\bsœur\b/i, /\bsoeur\b/i],
  },
  {
    category: "FUNNY",
    patterns: [/\brire\b/i, /\bmarrant\b/i, /\bdr[ôo]le\b/i, /\banecdote\b/i],
  },
  {
    category: "HABIT",
    patterns: [/\bhabitude\b/i, /\btoujours\b/i, /\bchaque\s+matin\b/i],
  },
  {
    category: "MILESTONE",
    patterns: [
      /\bpremier\b/i,
      /\bpremi[eè]re\b/i,
      /\bd[eé]but\b/i,
      /\banniversaire\b/i,
      /\bmariage\b/i,
    ],
  },
]

const TAG_PATTERNS: Array<{ re: RegExp; tag: string }> = [
  { re: /\bdernier\s+jour\b/i, tag: "dernier-jour" },
  { re: /\bmoment\s+pr[eé]f[eé]r[eé]\b/i, tag: "moment-prefere" },
  { re: /\bpremier\s+bisou\b/i, tag: "premier-bisou" },
  { re: /\bescale\b/i, tag: "escale" },
  { re: /\bvoyage\b/i, tag: "voyage" },
  { re: /\bplage\b/i, tag: "plage" },
  { re: /\bonsen\b/i, tag: "onsen" },
  { re: /\bentreprise\b/i, tag: "entreprise" },
  { re: /\bprofessionnel\b/i, tag: "professionnel" },
]

function uniq(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of items) {
    const k = x.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

/**
 * Extract semantic metadata strictly from source text (+ optional place field).
 */
export function classifyPersonalSemantics(input: {
  text: string
  place?: string | null
  title?: string | null
}): PersonalSemanticMeta {
  const blob = [input.title, input.place, input.text].filter(Boolean).join("\n")
  const locations = uniq(
    LOCATION_PATTERNS.filter((p) => p.re.test(blob)).map((p) => p.label),
  )
  const trips = uniq(TRIP_PATTERNS.filter((p) => p.re.test(blob)).map((p) => p.label))
  const semanticTags = uniq(TAG_PATTERNS.filter((p) => p.re.test(blob)).map((p) => p.tag))

  let category: PersonalSemanticCategory = "OTHER"
  let bestHits = 0
  for (const rule of CATEGORY_RULES) {
    const hits = rule.patterns.filter((re) => re.test(blob)).length
    if (hits > bestHits) {
      bestHits = hits
      category = rule.category
    }
  }

  // Pro / démarchage wins over "rendez-vous" RELATIONSHIP false positive
  if (
    /\b(entreprise|d[eé]marchage|professionnel|bureau|coll[eè]gue)\b/i.test(blob)
  ) {
    category = "WORK"
  }

  // Explicit place field is a location if not already captured
  if (input.place?.trim()) {
    const p = input.place.trim()
    if (!locations.some((l) => l.toLowerCase() === p.toLowerCase())) {
      locations.push(p)
    }
  }

  let periodHint: string | null = null
  const lastDay = blob.match(/\b(dernier\s+jour[^.!?]*)/i)
  if (lastDay) periodHint = lastDay[1]!.trim().slice(0, 60)

  return {
    category,
    semanticTags,
    locations,
    trips,
    periodHint,
  }
}

/** Categories that should not share a thematic (non-neutral) page. */
export function categoriesClash(
  a: PersonalSemanticCategory,
  b: PersonalSemanticCategory,
): boolean {
  if (a === "OTHER" || b === "OTHER") return false
  if (a === b) return false
  const pair = new Set([a, b])
  // Travel + relationship milestone can be ok; travel + work is a clash for themed pages
  if (pair.has("TRAVEL") && pair.has("WORK")) return true
  if (pair.has("TRAVEL") && pair.has("FAMILY") && !pair.has("RELATIONSHIP")) return true
  if (pair.has("WORK") && pair.has("RELATIONSHIP")) return true
  if (pair.has("WORK") && pair.has("MILESTONE")) return false // "débuts pro" ok
  if (pair.has("RELATIONSHIP") && pair.has("MILESTONE")) return false
  return false
}
