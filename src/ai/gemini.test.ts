import { afterEach, describe, expect, it, vi } from 'vitest'
import { quotaDay, usageToday } from '../db/ai-usage.ts'
import { scaleToGrams } from '../domain/scale.ts'
import { itemWarning, normalizeItem } from '../domain/sanity.ts'
import { AiError, classifyHttpError } from './errors.ts'
import { analyzeMeal, buildRequestBody, parseGenerateResponse } from './gemini.ts'

const okBody = (payload: unknown) => ({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(payload) }] } }],
})

const marraqueta = { name: 'Marraqueta con palta', grams: 150, kcal: 380, protein: 9, carbs: 50, fat: 16, confidence: 0.8 }

const kindOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof AiError ? e.kind : 'other'
  }
  return 'none'
}

describe('classifyHttpError', () => {
  it('daily quota 429 gets the Spanish quota message', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
          },
        ],
      },
    })
    const err = classifyHttpError(429, body, 'gemini-flash-latest')
    expect(err.kind).toBe('quota_daily')
    expect(err.message).toMatch(/cuota gratis/)
  })

  it('per-minute 429 asks to wait', () => {
    const body = JSON.stringify({
      error: { details: [{ violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }] },
    })
    expect(classifyHttpError(429, body, 'm').kind).toBe('rate_limit')
  })

  it('a 429 without details is treated as the daily quota', () => {
    expect(classifyHttpError(429, '', 'm').kind).toBe('quota_daily')
  })

  it('unknown model says to change it in Ajustes', () => {
    const err = classifyHttpError(404, '{"error":{"message":"models/gemini-9 is not found"}}', 'gemini-9')
    expect(err.kind).toBe('model_not_found')
    expect(err.message).toContain('"gemini-9"')
    expect(err.message).toContain('Ajustes')
    expect(err.action).toBe('settings')
  })

  it('invalid key', () => {
    const body = JSON.stringify({ error: { message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } })
    expect(classifyHttpError(400, body, 'm').kind).toBe('invalid_key')
  })

  it('server errors are retryable', () => {
    expect(classifyHttpError(503, '', 'm').action).toBe('retry')
  })
})

describe('parseGenerateResponse', () => {
  it('returns normalized items and assumptions', () => {
    const r = parseGenerateResponse(okBody({ items: [marraqueta], assumptions: ['Asumí media palta'] }))
    expect(r.items[0]?.item).toEqual(marraqueta)
    expect(r.items[0]?.warning).toBeNull()
    expect(r.assumptions).toEqual(['Asumí media palta'])
  })

  it('ignores thought parts', () => {
    const body = {
      candidates: [{ content: { parts: [{ text: 'pensando…', thought: true }, { text: JSON.stringify({ items: [marraqueta], assumptions: [] }) }] } }],
    }
    expect(parseGenerateResponse(body).items).toHaveLength(1)
  })

  it('maps empty items to no_food, broken JSON to bad_response, safety to blocked', () => {
    expect(kindOf(() => parseGenerateResponse(okBody({ items: [], assumptions: ['No es comida'] })))).toBe('no_food')
    expect(kindOf(() => parseGenerateResponse({ candidates: [{ content: { parts: [{ text: '{oops' }] } }] }))).toBe('bad_response')
    expect(kindOf(() => parseGenerateResponse({ promptFeedback: { blockReason: 'SAFETY' } }))).toBe('blocked')
  })

  it('clamps absurd values and flags them', () => {
    const r = parseGenerateResponse(okBody({ items: [{ ...marraqueta, grams: 90000, kcal: 27_000_000 }], assumptions: [] }))
    expect(r.items[0]?.item.grams).toBe(3000)
    expect(r.items[0]?.item.kcal).toBe(3000)
    expect(r.items[0]?.warning).toBe('La porción parece exagerada')
  })
})

describe('buildRequestBody', () => {
  it('sends the photo first and gives the description priority', () => {
    const body = buildRequestBody({ imageBase64: 'AAAA', text: 'media marraqueta' }) as {
      contents: { parts: { inlineData?: unknown; text?: string }[] }[]
      generationConfig: { responseMimeType: string }
    }
    const parts = body.contents[0]!.parts
    expect(parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } })
    expect(parts[1]?.text).toContain('tiene prioridad')
    expect(body.generationConfig.responseMimeType).toBe('application/json')
  })
})

describe('analyzeMeal', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('fails fast without an API key', async () => {
    await expect(analyzeMeal({ apiKey: ' ', model: 'm', text: 'pan' })).rejects.toMatchObject({ kind: 'no_key' })
  })

  it('calls the configured model with the key in a header and counts the request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okBody({ items: [marraqueta], assumptions: [] }))))
    vi.stubGlobal('fetch', fetchMock)
    const counted = vi.fn()
    await analyzeMeal({ apiKey: 'k', model: 'gemini-flash-latest', text: 'pan' }, counted)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k')
    expect(url).not.toContain('key=')
    expect(counted).toHaveBeenCalledOnce()
  })

  it('does not count rejected requests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })))
    const counted = vi.fn()
    await expect(analyzeMeal({ apiKey: 'k', model: 'm', text: 'pan' }, counted)).rejects.toMatchObject({ kind: 'quota_daily' })
    expect(counted).not.toHaveBeenCalled()
  })

  it('maps fetch failures to network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Load failed'))))
    await expect(analyzeMeal({ apiKey: 'k', model: 'm', text: 'pan' })).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('scaleToGrams', () => {
  it('recalculates proportionally from the base item', () => {
    expect(scaleToGrams(marraqueta, 75)).toMatchObject({ grams: 75, kcal: 190, protein: 4.5, carbs: 25, fat: 8 })
  })

  it('keeps values when the base has no weight', () => {
    expect(scaleToGrams({ ...marraqueta, grams: 0 }, 100).kcal).toBe(380)
  })
})

describe('sanity', () => {
  it('flags kcal that do not match the macros', () => {
    expect(itemWarning(normalizeItem({ ...marraqueta, kcal: 900 }))).toBe('Las calorías no cuadran con los macros')
  })

  it('accepts coherent items', () => {
    expect(itemWarning(normalizeItem(marraqueta))).toBeNull()
  })
})

describe('AI usage counter', () => {
  it('uses the Pacific-time quota day', () => {
    // 02:00 in Chile (UTC-3) on Nov 13 is still Nov 12 in California.
    expect(quotaDay(new Date('2026-11-13T05:00:00Z'))).toBe('2026-11-12')
  })

  it('resets when the quota day changes', () => {
    const now = new Date('2026-11-13T20:00:00Z')
    expect(usageToday({ aiUsageDay: '2026-11-12', aiUsageCount: 7 }, now)).toBe(0)
    expect(usageToday({ aiUsageDay: '2026-11-13', aiUsageCount: 7 }, now)).toBe(7)
  })
})
