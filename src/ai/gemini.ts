import type { Item } from '../db/types.ts'
import { itemWarning, normalizeItem } from '../domain/sanity.ts'
import { AiError, aiError, classifyHttpError } from './errors.ts'
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserText } from './prompt.ts'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 60_000

export interface AnalyzeInput {
  apiKey: string
  model: string
  /** JPEG, base64 without prefix. */
  imageBase64?: string
  text?: string
  signal?: AbortSignal
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

/**
 * Calls Gemini generateContent with structured JSON output.
 * `onCounted` runs once Google accepted the request (HTTP 200), for the usage counter.
 */
export async function analyzeMeal(input: AnalyzeInput, onCounted?: () => void): Promise<AnalysisResult> {
  if (!input.apiKey.trim()) throw aiError('no_key')
  const model = input.model.trim()

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)
  const onAbort = () => controller.abort()
  input.signal?.addEventListener('abort', onAbort)

  try {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': input.apiKey.trim() },
        body: JSON.stringify(buildRequestBody(input)),
        signal: controller.signal,
      })
    } catch (err) {
      if (timedOut) throw aiError('timeout')
      if (input.signal?.aborted) throw aiError('cancelled')
      throw err instanceof AiError ? err : aiError('network')
    }

    if (!res.ok) throw classifyHttpError(res.status, await res.text().catch(() => ''), model)
    onCounted?.()

    let body: unknown
    try {
      body = await res.json()
    } catch {
      if (timedOut) throw aiError('timeout')
      if (input.signal?.aborted) throw aiError('cancelled')
      throw aiError('bad_response')
    }
    return parseGenerateResponse(body)
  } finally {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', onAbort)
  }
}
