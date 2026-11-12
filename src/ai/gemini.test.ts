import { afterEach, describe, expect, it, vi } from 'vitest'
import { quotaDay, usageToday } from '../db/ai-usage.ts'
import { scaleToGrams } from '../domain/scale.ts'
import { itemWarning, normalizeItem } from '../domain/sanity.ts'
import { AiError, classifyHttpError } from './errors.ts'
import { analyzeMeal, buildRequestBody, parseGenerateResponse, verifyApiKey } from './gemini.ts'
import { DEFAULT_MODEL_CHAIN, MODEL_TIMEOUT_MS, parseModelList, resolveModelChain } from './models.ts'

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
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
  const ok = () => new Response(JSON.stringify(okBody({ items: [marraqueta], assumptions: [] })))
  const fail = (status: number, message = 'boom') => new Response(JSON.stringify({ error: { message } }), { status })
  const urlModel = (call: unknown[]) => String(call[0]).split('/models/')[1]?.split(':')[0]

  it('fails fast without an API key', async () => {
    await expect(analyzeMeal({ apiKey: ' ', models: ['m'], text: 'pan' })).rejects.toMatchObject({ kind: 'no_key' })
  })

  it('calls the first model with the key in a header, counts it and says which model answered', async () => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    const counted = vi.fn()
    const res = await analyzeMeal({ apiKey: 'k', models: ['gemini-3.6-flash', 'gemini-3.5-flash'], text: 'pan' }, counted)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k')
    expect(url).not.toContain('key=')
    expect(counted).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.model).toBe('gemini-3.6-flash')
  })

  it('uses the default chain when the list is empty', async () => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    await analyzeMeal({ apiKey: 'k', models: [], text: 'pan' })
    expect(urlModel(fetchMock.mock.calls[0] as unknown[])).toBe(DEFAULT_MODEL_CHAIN[0])
  })

  it('moves to the next model on 503, 429 and 404', async () => {
    const responses = [fail(503), fail(429), fail(404), ok()]
    const fetchMock = vi.fn(async () => responses.shift() as Response)
    vi.stubGlobal('fetch', fetchMock)
    const onModel = vi.fn()
    const res = await analyzeMeal({ apiKey: 'k', models: ['a', 'b', 'c', 'd'], text: 'pan', onModel })
    expect(fetchMock.mock.calls.map((c) => urlModel(c as unknown[]))).toEqual(['a', 'b', 'c', 'd'])
    expect(onModel.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c', 'd'])
    expect(res.model).toBe('d')
  })

  it('stops at an invalid key: another model would not help', async () => {
    const fetchMock = vi.fn(async () => fail(400, 'API key not valid. Please pass a valid API key.'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(analyzeMeal({ apiKey: 'k', models: ['a', 'b'], text: 'pan' })).rejects.toMatchObject({ kind: 'invalid_key' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('moves on when a model takes longer than 25 s', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      fetchMock.mock.calls.length === 1
        ? new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
        : Promise.resolve(ok()),
    )
    vi.stubGlobal('fetch', fetchMock)
    const pending = analyzeMeal({ apiKey: 'k', models: ['slow', 'fast'], text: 'pan' })
    await vi.advanceTimersByTimeAsync(MODEL_TIMEOUT_MS)
    await expect(pending).resolves.toMatchObject({ model: 'fast' })
  })

  it('lists every attempt when all fail, without the key', async () => {
    const responses = [fail(503, 'The model is overloaded.'), fail(503, 'bad key SECRETKEY123 here')]
    vi.stubGlobal('fetch', vi.fn(async () => responses.shift() as Response))
    const err = (await analyzeMeal({ apiKey: 'SECRETKEY123', models: ['a', 'b'], text: 'pan' }).catch((e: unknown) => e)) as AiError
    expect(err.kind).toBe('all_models_failed')
    expect(err.attempts).toEqual([
      { model: 'a', status: 503, message: 'The model is overloaded.' },
      { model: 'b', status: 503, message: 'bad key ••• here' },
    ])
    expect(JSON.stringify(err.attempts)).not.toContain('SECRETKEY123')
  })

  it('keeps the quota message when every model is out of quota', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })))
    const counted = vi.fn()
    const err = (await analyzeMeal({ apiKey: 'k', models: ['a', 'b'], text: 'pan' }, counted).catch((e: unknown) => e)) as AiError
    expect(err.kind).toBe('quota_daily')
    expect(err.attempts).toHaveLength(2)
    expect(counted).not.toHaveBeenCalled()
  })

  it('maps fetch failures to network errors without trying more models', async () => {
    const fetchMock = vi.fn(async () => Promise.reject(new TypeError('Load failed')))
    vi.stubGlobal('fetch', fetchMock)
    await expect(analyzeMeal({ apiKey: 'k', models: ['a', 'b'], text: 'pan' })).rejects.toMatchObject({ kind: 'network' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('verifyApiKey', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is valid when listing models works, and never checks the format', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(verifyApiKey(' AQ.nueva-key ')).resolves.toEqual({ result: 'valid' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).not.toContain('AQ.')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AQ.nueva-key')
  })

  it('is invalid on 400/401/403 and unverified offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'API key not valid.' } }), { status: 400 })))
    await expect(verifyApiKey('x')).resolves.toEqual({ result: 'invalid', detail: 'HTTP 400: API key not valid.' })
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Load failed'))))
    await expect(verifyApiKey('x')).resolves.toMatchObject({ result: 'unverified' })
  })
})

describe('model chain', () => {
  it('migrates the old default and keeps a custom model first', () => {
    expect(resolveModelChain({ geminiModel: 'gemini-flash-latest' })).toEqual([...DEFAULT_MODEL_CHAIN])
    expect(resolveModelChain({})).toEqual([...DEFAULT_MODEL_CHAIN])
    expect(resolveModelChain({ geminiModel: 'gemini-3.5-flash' })).toEqual(['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'])
    expect(resolveModelChain({ geminiModel: 'gemini-flash-latest', geminiModels: ['x', 'y'] })).toEqual(['x', 'y'])
  })

  it('parses one model per line or comma, without blanks or repeats', () => {
    expect(parseModelList(' a \n\nb, a\n c ')).toEqual(['a', 'b', 'c'])
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
