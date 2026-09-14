import type {
  ContentGenerationProvider,
  JsonSchemaObject,
  StructuredGenerationRequest,
  StructuredGenerationResult,
} from "./types"

const DEFAULT_BASE_URL = "https://api.openai.com/v1"
const DEFAULT_MODEL = "gpt-4o-mini"

export function isContentGenerationConfigured(): boolean {
  return Boolean(process.env.CONTENT_GENERATION_API_KEY?.trim())
}

/**
 * OpenAI-compatible chat completions provider (server-only).
 * Uses CONTENT_GENERATION_API_KEY — never exposed to the client.
 */
export class OpenAICompatibleProvider implements ContentGenerationProvider {
  readonly name = "openai-compatible"

  constructor(
    private readonly options: {
      apiKey: string
      baseUrl?: string
      model?: string
      fetchImpl?: typeof fetch
    },
  ) {}

  get configured(): boolean {
    return Boolean(this.options.apiKey.trim())
  }

  async generateStructured<T>(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult<T>> {
    if (!this.configured) {
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message:
          "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY côté serveur.",
      }
    }

    const baseUrl = (this.options.baseUrl ?? process.env.CONTENT_GENERATION_BASE_URL ?? DEFAULT_BASE_URL)
      .replace(/\/$/, "")
    const model =
      this.options.model ?? process.env.CONTENT_GENERATION_MODEL?.trim() ?? DEFAULT_MODEL
    const fetchImpl = this.options.fetchImpl ?? fetch

    const body = {
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: request.system },
        {
          role: "user",
          content: JSON.stringify({
            seed: request.seed ?? null,
            payload: request.input,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: request.schema,
        },
      },
    }

    try {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        return {
          ok: false,
          code: "PROVIDER_ERROR",
          message: `Le fournisseur IA a renvoyé une erreur (${res.status}).`,
          details: text ? [text.slice(0, 200)] : undefined,
        }
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>
      }
      const content = json.choices?.[0]?.message?.content
      if (!content || typeof content !== "string") {
        return {
          ok: false,
          code: "INVALID_JSON",
          message: "Réponse IA vide ou illisible.",
        }
      }

      try {
        const data = JSON.parse(content) as T
        return { ok: true, data }
      } catch {
        return {
          ok: false,
          code: "INVALID_JSON",
          message: "La réponse IA n'est pas un JSON valide.",
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur réseau IA"
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        message: "Impossible de joindre le fournisseur IA.",
        details: [message.slice(0, 120)],
      }
    }
  }
}

/** Provider used when no API key is set — fails clearly without throwing. */
export class UnconfiguredProvider implements ContentGenerationProvider {
  readonly name = "unconfigured"
  readonly configured = false

  async generateStructured<T>(
    _request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult<T>> {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message:
        "Génération IA non configurée. Ajoutez CONTENT_GENERATION_API_KEY dans les variables d'environnement serveur (ex. Vercel).",
    }
  }
}

/** Deterministic fake for unit tests — no network. */
export class FakeContentGenerationProvider implements ContentGenerationProvider {
  readonly name = "fake"
  readonly configured = true

  constructor(
    private readonly handler: (
      request: StructuredGenerationRequest,
    ) => Promise<StructuredGenerationResult<unknown>> | StructuredGenerationResult<unknown>,
  ) {}

  async generateStructured<T>(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult<T>> {
    const result = await this.handler(request)
    return result as StructuredGenerationResult<T>
  }
}

export function createDefaultContentGenerationProvider(): ContentGenerationProvider {
  const apiKey = process.env.CONTENT_GENERATION_API_KEY?.trim()
  if (!apiKey) return new UnconfiguredProvider()
  return new OpenAICompatibleProvider({ apiKey })
}

/** Exported for tests that assert schema shape without calling a network. */
export function assertJsonSchemaObject(schema: JsonSchemaObject): boolean {
  return schema.type === "object" || schema.type === "array"
}
