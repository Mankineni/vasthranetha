// "Fill for me": turns a pasted dealer message into suggested product fields
// with the Claude API. Server-only. Off unless ANTHROPIC_API_KEY is set.
import Anthropic from '@anthropic-ai/sdk'
import { betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { parseSuggestion, type Suggestion } from './suggestion'

export const MAX_INPUT_CHARS = 2000
export const DEFAULT_TIMEOUT_MS = 10_000
/** Override with AUTOFILL_MODEL (for example claude-haiku-5-5 to lower the cost per product). */
export const DEFAULT_MODEL = 'claude-opus-5-5'

/** Returns the model's structured output for one message. Injected so tests never call the API. */
export type AutofillClient = (text: string, fabricNames: string[]) => Promise<unknown>

export function isAutofillEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) || process.env.AUTOFILL_FAKE === '1'
}

const SYSTEM = [
  'You read a message that a saree and dress wholesaler (the dealer) sent to a reseller on WhatsApp,',
  "and fill in the product details for the reseller's online shop listing.",
  'Use only what the message says. Leave a field empty when the message does not say it.',
  "Any price in the message is the dealer's price to the reseller, never the shop price.",
  'name: a short shop title such as "Maroon Soft Silk Saree" (colour, fabric, type).',
  'description: one or two plain sentences for customers, with no prices, phone numbers or dealer names.',
  'fabric: choose from the allowed list only; leave it empty if none fits.',
].join('\n')

/** The Messages API request for one dealer message. */
export function autofillRequest(text: string, fabricNames: string[], model: string) {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short shop title; empty if the message gives too little to name it.' },
      fabric: { type: 'string', enum: [...fabricNames, ''] },
      length: { type: 'string', description: 'For example "6.3 m"; empty if not stated.' },
      blousePiece: { type: 'string', enum: ['included', 'not included', 'unknown'] },
      description: { type: 'string' },
      dealerPrice: { type: 'string', description: "The dealer's price in rupees, digits only; empty if not stated." },
    },
    required: ['name', 'fabric', 'length', 'blousePiece', 'description', 'dealerPrice'],
    additionalProperties: false,
  } as const
  return {
    model,
    max_tokens: 4096,
    // If the model declines for policy reasons, the API retries on its default fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    system: SYSTEM,
    messages: [{ role: 'user' as const, content: `Dealer's message:\n"""\n${text}\n"""` }],
    // A small extraction: low effort keeps it quick and cheap without hurting quality.
    output_config: { effort: 'low' as const, format: betaJSONSchemaOutputFormat(schema) },
  }
}

function claudeClient(apiKey: string, model: string): AutofillClient {
  const client = new Anthropic({ apiKey })
  return async (text, fabricNames) => {
    const message = await client.beta.messages.parse(autofillRequest(text, fabricNames, model), {
      timeout: DEFAULT_TIMEOUT_MS,
      maxRetries: 0,
    })
    if (message.stop_reason === 'refusal') throw new Error(`declined (${message.stop_details?.category ?? 'no category'})`)
    if (message.parsed_output == null) throw new Error(`no structured output (stop_reason ${message.stop_reason})`)
    return message.parsed_output
  }
}

/** Stand-in used by the browser tests (AUTOFILL_FAKE=1); never calls the API. */
const fakeClient: AutofillClient = async (_text, fabricNames) => ({
  name: 'Peacock Blue Soft Silk Saree',
  fabric: fabricNames[0] ?? '',
  length: '6.3 m',
  blousePiece: 'included',
  description: 'Soft silk saree with a contrast zari border.',
  dealerPrice: '1850',
})

let cached: { key: string; client: AutofillClient } | null = null

export function getAutofillClient(): AutofillClient | null {
  if (process.env.AUTOFILL_FAKE === '1') return fakeClient
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const model = process.env.AUTOFILL_MODEL || DEFAULT_MODEL
  const key = `${apiKey}:${model}`
  if (cached?.key !== key) cached = { key, client: claudeClient(apiKey, model) }
  return cached.client
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function suggestFields(
  text: string,
  fabricNames: string[],
  client: AutofillClient,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ ok: true; suggestion: Suggestion } | { ok: false }> {
  const input = text.trim().slice(0, MAX_INPUT_CHARS)
  if (!input) return { ok: false }
  try {
    const raw = await withTimeout(client(input, fabricNames), timeoutMs)
    return { ok: true, suggestion: parseSuggestion(raw, fabricNames) }
  } catch (err) {
    console.error('autofill failed:', err instanceof Error ? err.message : err)
    return { ok: false }
  }
}
