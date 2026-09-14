/**
 * Content generation layer — shared types.
 * Independent from Editorial Engine planning and from game engines.
 */

import type { AudienceType, ForbiddenTopicsAnswer } from "@/lib/questionnaire/types"

export type SourceRefType = "FACT" | "MEMORY" | "PARTICIPANT" | "JOKE"

export interface SourceRef {
  type: SourceRefType
  id: string
}

export interface SourceContextFact {
  id: string
  text: string
  subjectParticipantIds: string[]
}

export interface SourceContextMemory {
  id: string
  text: string
  title?: string
  place?: string
  participantIds: string[]
}

export interface SourceContextJoke {
  id: string
  text: string
  participantIds: string[]
}

export interface SourceContextParticipant {
  id: string
  firstName: string
}

export interface SourceContextInterest {
  id: string
}

/** Minimal editorial context sent to the model — never a full BookProfile. */
export interface QuizPersonalSourceContext {
  audience: AudienceType
  participantNames: string[]
  participants: SourceContextParticipant[]
  facts: SourceContextFact[]
  memories: SourceContextMemory[]
  jokes: SourceContextJoke[]
  interests: SourceContextInterest[]
  forbiddenTopics: {
    hasRestrictions: boolean
    text?: string
    peopleToAvoid?: string
  }
}

export interface AllowedSourceIds {
  factIds: ReadonlySet<string>
  memoryIds: ReadonlySet<string>
  jokeIds: ReadonlySet<string>
  participantIds: ReadonlySet<string>
  interestIds: ReadonlySet<string>
}

export type ContentGenerationErrorCode =
  | "NOT_CONFIGURED"
  | "PROVIDER_ERROR"
  | "INVALID_JSON"
  | "VALIDATION_FAILED"
  | "ENGINE_REJECTED"
  | "NO_SOURCES"
  | "FORBIDDEN"

export interface ContentGenerationError {
  ok: false
  code: ContentGenerationErrorCode
  message: string
  details?: string[]
}

export interface JsonSchemaObject {
  /** Single type, or OpenAI Structured Outputs nullable union e.g. ["string","null"]. */
  type:
    | "object"
    | "array"
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "null"
    | Array<"object" | "array" | "string" | "number" | "integer" | "boolean" | "null">
  properties?: Record<string, unknown>
  items?: unknown
  required?: string[]
  additionalProperties?: boolean
  enum?: unknown[]
  minItems?: number
  maxItems?: number
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  description?: string
}

export interface StructuredGenerationRequest {
  system: string
  input: unknown
  schemaName: string
  schema: JsonSchemaObject
  seed?: string
}

export interface StructuredGenerationSuccess<T> {
  ok: true
  data: T
}

export type StructuredGenerationResult<T> =
  | StructuredGenerationSuccess<T>
  | ContentGenerationError

export interface ContentGenerationProvider {
  readonly name: string
  readonly configured: boolean
  generateStructured<T>(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult<T>>
}

export function forbiddenTopicsForPrompt(
  forbidden: ForbiddenTopicsAnswer,
): QuizPersonalSourceContext["forbiddenTopics"] {
  return {
    hasRestrictions: Boolean(forbidden.hasRestrictions),
    ...(forbidden.hasRestrictions && forbidden.text?.trim()
      ? { text: forbidden.text.trim() }
      : {}),
    ...(forbidden.hasRestrictions && forbidden.peopleToAvoid?.trim()
      ? { peopleToAvoid: forbidden.peopleToAvoid.trim() }
      : {}),
  }
}
