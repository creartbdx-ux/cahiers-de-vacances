import type { PersonalFactCategory } from "@/lib/questionnaire/types"
import type {
  QuizPersonalSourceContext,
  SourceContextFact,
  SourceContextJoke,
  SourceContextMemory,
} from "../types"

export type QuizSourceValue = "HIGH" | "MEDIUM" | "LOW"

const LOW_FACT_CATEGORIES = new Set<PersonalFactCategory>([
  "FOOD",
  "DRINK",
  "MUSIC",
  "MOVIE_SERIES",
  "BOOK",
  "OBJECT",
])

const MEDIUM_FACT_CATEGORIES = new Set<PersonalFactCategory>([
  "ACTIVITY",
  "PLACE",
  "HABIT",
  "OTHER",
])

const HIGH_FACT_CATEGORIES = new Set<PersonalFactCategory>([
  "FUNNY_FLAW",
  "EXPRESSION",
])

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

/** Heuristic quiz value for a personal fact (never invents content). */
export function scoreFactQuizValue(input: {
  text: string
  category?: string
}): QuizSourceValue {
  const text = input.text.trim()
  const cat = input.category as PersonalFactCategory | undefined
  const norm = normalize(text)

  if (
    /\b(couleur|color)\b/.test(norm) ||
    /\bpr[eé]f[eé]r[eé]e?\b/.test(norm) && text.length < 48
  ) {
    return "LOW"
  }

  if (cat && HIGH_FACT_CATEGORIES.has(cat)) return "HIGH"
  if (cat && LOW_FACT_CATEGORIES.has(cat) && text.length < 60) return "LOW"
  if (cat && MEDIUM_FACT_CATEGORIES.has(cat) && text.length >= 50) return "HIGH"
  if (cat && MEDIUM_FACT_CATEGORIES.has(cat)) return "MEDIUM"
  if (text.length >= 90) return "HIGH"
  if (text.length >= 40) return "MEDIUM"
  if (cat && LOW_FACT_CATEGORIES.has(cat)) return "LOW"
  return "MEDIUM"
}

export function scoreMemoryQuizValue(memory: {
  text: string
  title?: string
  place?: string
}): QuizSourceValue {
  const len = memory.text.trim().length
  const extras = (memory.title?.trim() ? 1 : 0) + (memory.place?.trim() ? 1 : 0)
  if (len >= 100 || (len >= 60 && extras >= 1) || extras >= 2) return "HIGH"
  if (len >= 35) return "MEDIUM"
  return "MEDIUM"
}

export function scoreJokeQuizValue(text: string): QuizSourceValue {
  return text.trim().length >= 12 ? "HIGH" : "MEDIUM"
}

export function annotateFactValue(
  fact: Omit<SourceContextFact, "quizValue"> & { category?: string },
): SourceContextFact {
  return {
    id: fact.id,
    text: fact.text,
    subjectParticipantIds: fact.subjectParticipantIds,
    ...(fact.category ? { category: fact.category } : {}),
    quizValue: scoreFactQuizValue({ text: fact.text, category: fact.category }),
  }
}

export function annotateMemoryValue(
  memory: Omit<SourceContextMemory, "quizValue">,
): SourceContextMemory {
  return {
    ...memory,
    quizValue: scoreMemoryQuizValue(memory),
  }
}

export function annotateJokeValue(
  joke: Omit<SourceContextJoke, "quizValue">,
): SourceContextJoke {
  return {
    ...joke,
    quizValue: scoreJokeQuizValue(joke.text),
  }
}

export function lookupSourceQuizValue(
  ctx: QuizPersonalSourceContext,
  type: "FACT" | "MEMORY" | "JOKE",
  id: string,
): QuizSourceValue {
  if (type === "FACT") return ctx.facts.find((f) => f.id === id)?.quizValue ?? "MEDIUM"
  if (type === "MEMORY") return ctx.memories.find((m) => m.id === id)?.quizValue ?? "MEDIUM"
  return ctx.jokes.find((j) => j.id === id)?.quizValue ?? "HIGH"
}

/** Max times a content source may be used as primary across the quiz. */
export function maxPrimaryUsesForValue(value: QuizSourceValue): number {
  if (value === "HIGH") return 2
  return 1
}

export function formatTargetReaderDebugLabel(ctx: QuizPersonalSourceContext): string {
  const names = ctx.targetParticipantNames.join(", ") || "—"
  return `Audience / lecteur : ${ctx.audience} → ${names}`
}
