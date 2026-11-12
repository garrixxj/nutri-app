/**
 * Weekly summary and weight-gain pace. Pure, so it unit-tests without a database.
 * The pace regression runs over calendar days, not over the list position, so
 * gaps between weigh-ins don't bend the slope.
 */
import type { Entry, Macros, WeightLog } from '../db/types.ts'
import { addDays, daysBetween, fromISODate } from './dates.ts'
import { entryTotals, sumMacros } from './totals.ts'
import { meanWeightBetween, round2 } from './weight.ts'

/** Monday of the week that contains `iso`. */
export function weekStart(iso: string): string {
  return addDays(iso, -((fromISODate(iso).getDay() + 6) % 7))
}

export interface SummaryDay {
  date: string
  kcal: number
  logged: boolean
  future: boolean
}

export interface WeeklySummary {
  start: string
  end: string
  days: SummaryDay[]
  loggedDays: number
  /** Daily average over logged days only; null when nothing was logged. */
  average: Macros | null
  /** Mean weigh-in of this week minus the previous week's, when both have readings. */
  weightChangeKg: number | null
  isCurrentWeek: boolean
}

/** `entries` may include other weeks; only this week's count. */
export function weeklySummary(entries: readonly Entry[], weights: readonly WeightLog[], start: string, today: string): WeeklySummary {
  const end = addDays(start, 6)
  const days: SummaryDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const dayEntries = entries.filter((e) => e.date === date)
    return {
      date,
      kcal: sumMacros(dayEntries.map(entryTotals)).kcal,
      logged: dayEntries.length > 0,
      future: date > today,
    }
  })
  const loggedDates = new Set(days.filter((d) => d.logged).map((d) => d.date))
  const loggedTotals = sumMacros(entries.filter((e) => loggedDates.has(e.date)).map(entryTotals))
  const n = loggedDates.size
  const average = n
    ? {
        kcal: Math.round(loggedTotals.kcal / n),
        protein: Math.round(loggedTotals.protein / n),
        carbs: Math.round(loggedTotals.carbs / n),
        fat: Math.round(loggedTotals.fat / n),
      }
    : null

  const thisWeek = meanWeightBetween(weights, start, end)
  const lastWeek = meanWeightBetween(weights, addDays(start, -7), addDays(start, -1))

  return {
    start,
    end,
    days,
    loggedDays: n,
    average,
    weightChangeKg: thisWeek !== null && lastWeek !== null ? round2(thisWeek - lastWeek) : null,
    isCurrentWeek: today >= start && today <= end,
  }
}

/* ─────────────── Pace for gaining muscle ─────────────── */

/** Reasonable lean-gain pace, as % of body weight per week. */
export const GAIN_PACE_PCT = { min: 0.25, max: 0.5 } as const
/** Rough energy content of a kg of body-weight change. A guide for small nudges, not physiology. */
export const KCAL_PER_KG = 7700
export const PACE_WINDOW_DAYS = 28
export const PACE_MIN_READINGS = 6
export const PACE_MIN_SPAN_DAYS = 14

export type GainPace =
  | { status: 'insufficient'; readings: number; spanDays: number }
  | {
      status: 'slow' | 'ok' | 'fast'
      /** kg per week from the regression. */
      weeklyKg: number
      /** % of body weight per week. */
      weeklyPct: number
      /** Signed daily kcal change that would bring the pace to the middle of the range; 0 when on pace. */
      suggestKcal: number
    }

export function gainPace(logs: readonly WeightLog[], today: string): GainPace {
  const from = addDays(today, -(PACE_WINDOW_DAYS - 1))
  const byDate = new Map<string, number[]>()
  for (const l of logs) {
    if (l.date < from || l.date > today) continue
    byDate.set(l.date, [...(byDate.get(l.date) ?? []), l.kg])
  }
  const readings = [...byDate]
    .map(([date, kgs]) => ({ date, kg: kgs.reduce((s, k) => s + k, 0) / kgs.length }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const first = readings[0]
  const last = readings[readings.length - 1]
  const spanDays = first && last ? daysBetween(first.date, last.date) : 0
  if (!first || readings.length < PACE_MIN_READINGS || spanDays < PACE_MIN_SPAN_DAYS) {
    return { status: 'insufficient', readings: readings.length, spanDays }
  }

  // Least squares over elapsed calendar days.
  const pts = readings.map((r) => ({ x: daysBetween(first.date, r.date), y: r.kg }))
  const n = pts.length
  const sx = pts.reduce((s, p) => s + p.x, 0)
  const sy = pts.reduce((s, p) => s + p.y, 0)
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0)
  const sx2 = pts.reduce((s, p) => s + p.x * p.x, 0)
  const slopePerDay = (n * sxy - sx * sy) / (n * sx2 - sx * sx)
  const refKg = sy / n

  const weeklyKg = slopePerDay * 7
  const weeklyPct = (weeklyKg / refKg) * 100
  const status = weeklyPct < GAIN_PACE_PCT.min ? 'slow' : weeklyPct > GAIN_PACE_PCT.max ? 'fast' : 'ok'

  let suggestKcal = 0
  if (status !== 'ok') {
    const midPct = (GAIN_PACE_PCT.min + GAIN_PACE_PCT.max) / 2
    const deltaKgPerWeek = ((midPct - weeklyPct) / 100) * refKg
    const raw = (deltaKgPerWeek * KCAL_PER_KG) / 7
    const magnitude = Math.min(Math.max(Math.round(Math.abs(raw) / 50) * 50, 100), 250)
    suggestKcal = Math.sign(raw) * magnitude
  }

  return { status, weeklyKg: round2(weeklyKg), weeklyPct: round2(weeklyPct), suggestKcal }
}
