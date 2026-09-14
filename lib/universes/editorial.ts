/**
 * Editorial frame for content generation (QUIZ_THEME, later other theme games).
 * Source of truth: universes table columns (+ optional code defaults until DB seeded).
 */

export type UniverseEditorialFields = {
  id: string
  name: string
  editorial_description?: string | null
  allowed_topics?: string[] | null
  excluded_topics?: string[] | null
  quiz_guidance?: string | null
}

export type ResolvedUniverseEditorial = {
  universeId: string
  universeName: string
  editorialDescription: string
  allowedTopics: string[]
  excludedTopics: string[]
  quizGuidance: string | null
  /** True when allowed/excluded come from a concrete config (DB or code default). */
  hasTopicFrame: boolean
}

function cleanList(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const v = String(raw ?? "").trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

/** Code-side defaults — used when DB columns are empty (pre-migration / tests). */
export const UNIVERSE_EDITORIAL_DEFAULTS: Record<
  string,
  {
    editorialDescription: string
    allowedTopics: string[]
    excludedTopics: string[]
    quizGuidance: string
  }
> = {
  BEAUTY: {
    editorialDescription:
      "Univers autour de la beauté, des cosmétiques et des soins personnels.",
    allowedTopics: [
      "maquillage",
      "skincare",
      "soins du visage",
      "soins du corps",
      "cheveux",
      "coiffure",
      "ongles",
      "parfums",
      "ingrédients cosmétiques",
      "routines beauté",
      "gestes beauté",
      "histoire des cosmétiques",
      "culture beauté",
      "produits iconiques",
      "vocabulaire beauté",
      "cosmétique",
    ],
    excludedTopics: [
      "histoire de l'art",
      "peinture",
      "sculpture",
      "architecture",
      "musées",
      "philosophie esthétique",
      "esthétique philosophique",
      "mouvements artistiques",
      "beauté abstraite",
      "esthétique japonaise",
      "histoire du design",
      "renaissance artistique",
      "art nouveau",
      "mode vestimentaire",
      "fashion",
    ],
    quizGuidance:
      "Interpréter « Beauté » comme cosmétiques / maquillage / skincare / cheveux / parfums / soins — jamais comme art, architecture ou philosophie. MODE/FASHION est un univers séparé : ne pas transformer ce quiz en quiz mode. Faits stables uniquement. Pas de conseil médical, pas de diagnostic, pas de claims santé douteux.",
  },
}

export function normalizeTopicKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function significantTokens(value: string): string[] {
  return normalizeTopicKey(value)
    .split(" ")
    .filter((t) => t.length >= 4)
}

/**
 * Resolve editorial frame from a universe row (or id/name only).
 * Prefers DB fields; fills gaps from UNIVERSE_EDITORIAL_DEFAULTS; else minimal fallback.
 */
export function resolveUniverseEditorial(
  universe: UniverseEditorialFields | null | undefined,
  fallback?: { universeId?: string; universeName?: string | null },
): ResolvedUniverseEditorial {
  const id = (universe?.id || fallback?.universeId || "").trim()
  const name =
    universe?.name?.trim() ||
    fallback?.universeName?.trim() ||
    id ||
    "Thème général"
  const defaults = id ? UNIVERSE_EDITORIAL_DEFAULTS[id] : undefined

  const editorialDescription =
    universe?.editorial_description?.trim() ||
    defaults?.editorialDescription ||
    `Univers « ${name} ».`

  const allowedFromDb = cleanList(universe?.allowed_topics)
  const excludedFromDb = cleanList(universe?.excluded_topics)
  const allowedTopics =
    allowedFromDb.length > 0 ? allowedFromDb : (defaults?.allowedTopics ?? [])
  const excludedTopics =
    excludedFromDb.length > 0 ? excludedFromDb : (defaults?.excludedTopics ?? [])

  const quizGuidance =
    universe?.quiz_guidance?.trim() ||
    defaults?.quizGuidance ||
    null

  return {
    universeId: id,
    universeName: name,
    editorialDescription,
    allowedTopics,
    excludedTopics,
    quizGuidance,
    hasTopicFrame: allowedTopics.length > 0 || excludedTopics.length > 0,
  }
}

/** True when topic/question clearly hits an excluded subject. */
export function topicHitsExcluded(
  topic: string,
  question: string,
  excludedTopics: string[],
): string | null {
  if (!excludedTopics.length) return null
  const topicKey = normalizeTopicKey(topic)
  const blob = normalizeTopicKey(`${topic} ${question}`)
  for (const ex of excludedTopics) {
    const exKey = normalizeTopicKey(ex)
    if (!exKey) continue
    if (topicKey === exKey || topicKey.includes(exKey) || exKey.includes(topicKey)) {
      return ex
    }
    if (blob.includes(exKey)) return ex
    const tokens = significantTokens(ex)
    if (tokens.length >= 2 && tokens.every((t) => blob.includes(t))) return ex
  }
  return null
}

/**
 * When allowedTopics is non-empty, topic should overlap at least one allowed entry.
 * Lenient: shared significant token or substring either way.
 */
export function topicMatchesAllowed(topic: string, allowedTopics: string[]): boolean {
  if (!allowedTopics.length) return true
  const topicKey = normalizeTopicKey(topic)
  if (!topicKey) return false
  const topicTokens = new Set(significantTokens(topic))

  for (const allowed of allowedTopics) {
    const aKey = normalizeTopicKey(allowed)
    if (!aKey) continue
    if (topicKey === aKey || topicKey.includes(aKey) || aKey.includes(topicKey)) {
      return true
    }
    const aTokens = significantTokens(allowed)
    if (aTokens.some((t) => topicTokens.has(t) || topicKey.includes(t))) {
      return true
    }
  }
  return false
}

export function formatTopicsForPrompt(topics: string[]): string {
  if (!topics.length) return "(non spécifié — rester fidèle à la description éditoriale)"
  return topics.map((t) => `- ${t}`).join("\n")
}
