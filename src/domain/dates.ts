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

/** Whole calendar days from `fromIso` to `toIso` (local dates). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromISODate(toIso).getTime() - fromISODate(fromIso).getTime()) / 86_400_000)
}

/** "hoy", "ayer", "hace 3 días" */
export function relativeDay(iso: string, todayIso: string): string {
  const days = daysBetween(iso, todayIso)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

const dateTime = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

/** Epoch ms or ISO timestamp → "12 nov, 14:03" */
export function formatDateTime(value: number | string): string {
  return dateTime.format(new Date(value))
}
