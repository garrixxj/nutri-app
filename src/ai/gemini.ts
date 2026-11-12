import type { Item } from '../db/types.ts'
import { itemWarning, normalizeItem } from '../domain/sanity.ts'
import { AiError, aiError, classifyHttpError, googleErrorMessage, type ModelAttempt } from './errors.ts'
import { DEFAULT_MODEL_CHAIN, MODEL_TIMEOUT_MS } from './models.ts'
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserText } from './prompt.ts'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface AnalyzeInput {
  apiKey: string
  /** Models to try in order (ai/models.ts); empty uses the default chain. */
  models: readonly string[]
  /** JPEG, base64 without prefix. */
  imageBase64?: string
  text?: string
  signal?: AbortSignal
  /** Called before each model is tried, so the screen can say which one is working. */
  onModel?: (model: string, index: number) => void
}

export interface AnalyzedItem {
  item: Item
  /** Reason to double-check, from the deterministic sanity checks. */
  warning: string | null
}

export interface AnalysisResult {
  items: AnalyzedItem[]
  assumptions: string[]
}

export interface ModelAnalysis extends AnalysisResult {
  /** The model that answered. */
  model: string
}

export function buildRequestBody(input: Pick<AnalyzeInput, 'imageBase64' | 'text'>): unknown {
  const parts: unknown[] = []
  if (input.imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: input.imageBase64 } })
  parts.push({ text: buildUserText(input.text, Boolean(input.imageBase64)) })
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  }
}

interface GenerateResponse {
  promptFeedback?: { blockReason?: string }
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]
}

/** Extracts and validates the JSON payload of a 200 response. */
export function parseGenerateResponse(body: unknown): AnalysisResult {
  const res = body as GenerateResponse
  if (res.promptFeedback?.blockReason) throw aiError('blocked')
  const candidate = res.candidates?.[0]
  if (!candidate) throw aiError('bad_response')
  if (candidate.finishReason && ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'IMAGE_SAFETY'].includes(candidate.finishReason)) {
    throw aiError('blocked')
  }
  const text = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw aiError('bad_response')
  }
  if (typeof data !== 'object' || data === null || !Array.isArray((data as { items?: unknown }).items)) {
    throw aiError('bad_response')
  }
  const raw = data as { items: unknown[]; assumptions?: unknown }
  const items = raw.items
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => {
      const item = normalizeItem(r)
      return { item, warning: itemWarning(item, r) }
    })
  if (items.length === 0) throw aiError('no_food')

  const assumptions = Array.isArray(raw.assumptions)
    ? raw.assumptions.filter((a): a is string => typeof a === 'string' && a.trim() !== '').map((a) => a.trim()).slice(0, 5)
    : []
  return { items, assumptions }
}

/** HTTP statuses that mean "this model can't now, try the next one". */
const FALLBACK_STATUSES = new Set([404, 429, 503])

/** Never let the key reach the screen, even if Google echoes it. */
function redact(text: string, apiKey: string): string {
  const clean = apiKey ? text.split(apiKey).join('•••') : text
  return clean.length > 300 ? `${clean.slice(0, 300)}…` : clean
}

type ModelOutcome =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: AiError; attempt: ModelAttempt; fallback: boolean }

/** One generateContent call with its own timeout. Throws only when the user cancels. */
async function callModel(input: AnalyzeInput, apiKey: string, model: string, onCounted?: () => void): Promise<ModelOutcome> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, MODEL_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  input.signal?.addEventListener('abort', onAbort)
  const timeout = (): ModelOutcome => ({
    ok: false,
    error: aiError('timeout'),
    attempt: { model, status: 'timeout', message: `Sin respuesta en ${MODEL_TIMEOUT_MS / 1000} s` },
    fallback: true,
  })

  try {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(buildRequestBody(input)),
        signal: controller.signal,
      })
    } catch (err) {
      if (input.signal?.aborted) throw aiError('cancelled')
      if (timedOut) return timeout()
      const message = err instanceof Error ? err.message : 'Sin conexión'
      return { ok: false, error: aiError('network'), attempt: { model, status: 'network', message: redact(message, apiKey) }, fallback: false }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (input.signal?.aborted) throw aiError('cancelled')
      const error = classifyHttpError(res.status, text, model)
      return {
        ok: false,
        error,
        attempt: { model, status: res.status, message: redact(googleErrorMessage(text), apiKey) },
        fallback: FALLBACK_STATUSES.has(res.status) || error.kind === 'model_not_found',
      }
    }
    onCounted?.()

    let body: unknown
    try {
      body = await res.json()
    } catch {
      if (input.signal?.aborted) throw aiError('cancelled')
      if (timedOut) return timeout()
      return { ok: false, error: aiError('bad_response'), attempt: { model, status: 200, message: 'Respuesta incompleta' }, fallback: false }
    }
    try {
      return { ok: true, result: parseGenerateResponse(body) }
    } catch (err) {
      const error = err instanceof AiError ? err : aiError('bad_response')
      return { ok: false, error, attempt: { model, status: 200, message: error.message }, fallback: false }
    }
  } finally {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Calls Gemini generateContent with structured JSON output, trying each model of the chain
 * in order: a 503, 429 or 404, or no answer within 25 s, moves on to the next one.
 * `onCounted` runs each time Google accepted a request (HTTP 200), for the usage counter.
 */
export async function analyzeMeal(input: AnalyzeInput, onCounted?: () => void): Promise<ModelAnalysis> {
  const apiKey = input.apiKey.trim()
  if (!apiKey) throw aiError('no_key')
  const models = input.models.map((m) => m.trim()).filter(Boolean)
  const chain = models.length > 0 ? models : [...DEFAULT_MODEL_CHAIN]

  const attempts: ModelAttempt[] = []
  let last: AiError | null = null
  for (const [index, model] of chain.entries()) {
    input.onModel?.(model, index)
    const outcome = await callModel(input, apiKey, model, onCounted)
    if (outcome.ok) return { ...outcome.result, model }
    attempts.push(outcome.attempt)
    last = outcome.error
    if (!outcome.fallback) {
      outcome.error.attempts = attempts
      throw outcome.error
    }
  }
  // Every model failed: out of quota everywhere keeps the quota message, anything else is "all failed".
  const allQuota = attempts.every((a) => a.status === 429)
  const error = allQuota && last ? last : aiError('all_models_failed')
  error.attempts = attempts
  throw error
}

export type KeyCheck = { result: 'valid' } | { result: 'invalid' | 'unverified'; detail: string }

/**
 * Checks a key with a real, free call (list models). The app never checks the key's format:
 * Google changes it (new keys start with "AQ.").
 */
export async function verifyApiKey(rawKey: string): Promise<KeyCheck> {
  const apiKey = rawKey.trim()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(`${API_BASE}?pageSize=1`, { headers: { 'x-goog-api-key': apiKey }, signal: controller.signal })
    if (res.ok) return { result: 'valid' }
    const message = redact(googleErrorMessage(await res.text().catch(() => '')), apiKey)
    const detail = `HTTP ${res.status}${message ? `: ${message}` : ''}`
    return [400, 401, 403].includes(res.status) ? { result: 'invalid', detail } : { result: 'unverified', detail }
  } catch {
    return { result: 'unverified', detail: controller.signal.aborted ? 'Google no respondió a tiempo' : 'Sin conexión' }
  } finally {
    clearTimeout(timer)
  }
}
