const intFormat = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })
const oneDecimalFormat = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })

/** 2933 → "2.933" */
export function formatInt(n: number): string {
  return intFormat.format(Math.round(n))
}

/** 12.35 → "12,4" */
export function formatDecimal(n: number): string {
  return oneDecimalFormat.format(n)
}

/** Parses user input that may use a comma as decimal separator. Returns null when empty or invalid. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (s === '') return null
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Number to an editable string ("12.5" → "12,5"). */
export function toInputString(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(Math.round(n * 10) / 10).replace('.', ',')
}
