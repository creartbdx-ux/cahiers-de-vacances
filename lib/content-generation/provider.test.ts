import assert from "node:assert/strict"
import { test } from "node:test"
import { OpenAICompatibleProvider } from "./provider"

test("gpt-5.6-luna payload omits temperature by default (no 0.7)", async () => {
  let capturedBody: Record<string, unknown> | null = null

  const fetchImpl: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }

  const provider = new OpenAICompatibleProvider({
    apiKey: "test-key",
    model: "gpt-5.6-luna",
    fetchImpl,
  })

  const result = await provider.generateStructured<{ ok: boolean }>({
    system: "sys",
    input: { hello: "world" },
    schemaName: "probe",
    schema: { type: "object", properties: {}, additionalProperties: false },
  })

  assert.equal(result.ok, true)
  assert.ok(capturedBody !== null)
  const body = capturedBody as Record<string, unknown>
  assert.equal(body.model, "gpt-5.6-luna")
  assert.equal("temperature" in body, false)
  assert.notEqual(body.temperature, 0.7)
})

test("temperature is included only when explicitly provided", async () => {
  let capturedBody: Record<string, unknown> | null = null

  const fetchImpl: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }

  const provider = new OpenAICompatibleProvider({
    apiKey: "test-key",
    model: "gpt-4o-mini",
    temperature: 0.4,
    fetchImpl,
  })

  await provider.generateStructured({
    system: "sys",
    input: {},
    schemaName: "probe",
    schema: { type: "object", properties: {}, additionalProperties: false },
  })

  assert.ok(capturedBody !== null)
  const body = capturedBody as Record<string, unknown>
  assert.equal(body.temperature, 0.4)
})
