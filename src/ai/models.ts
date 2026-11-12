/**
 * Gemini models tried in order. If one is saturated (503), out of quota (429), missing (404)
 * or takes longer than MODEL_TIMEOUT_MS, the next one is used.
 * gemini-flash-latest is not in the chain: it points to whichever flash is newest, and the
 * newest ones are often saturated.
 */
export const DEFAULT_MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const

export const MODEL_TIMEOUT_MS = 25_000

/** Values that meant "the default" before the chain existed. */
const LEGACY_DEFAULTS = new Set(['', 'gemini-flash-latest'])

function dedupe(list: readonly string[]): string[] {
  return [...new Set(list.map((m) => m.trim()).filter(Boolean))]
}

/**
 * The model chain from stored settings. Old settings only have `geminiModel`: the old
 * default (gemini-flash-latest) becomes the new chain, and a custom model goes first.
 */
export function resolveModelChain(s: { geminiModel?: string; geminiModels?: readonly string[] }): string[] {
  const chain = dedupe(s.geminiModels ?? [])
  if (chain.length > 0) return chain
  const legacy = s.geminiModel?.trim() ?? ''
  if (LEGACY_DEFAULTS.has(legacy)) return [...DEFAULT_MODEL_CHAIN]
  return dedupe([legacy, ...DEFAULT_MODEL_CHAIN])
}

/** One model per line (commas also work), as typed in Ajustes. */
export function parseModelList(text: string): string[] {
  return dedupe(text.split(/[\n,]/))
}

export function isDefaultChain(chain: readonly string[]): boolean {
  return chain.length === DEFAULT_MODEL_CHAIN.length && chain.every((m, i) => m === DEFAULT_MODEL_CHAIN[i])
}
