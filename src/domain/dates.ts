const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (never UTC, so late dinners stay on the right day). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISODate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

const longDate = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
const time = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })

/** "2026-11-12" → "jueves 12 de noviembre" */
export function formatLongDate(iso: string): string {
  return longDate.format(fromISODate(iso)).replace(',', '')
}

/** Epoch ms → "13:42" */
export function formatTime(ms: number): string {
  return time.format(new Date(ms))
}
