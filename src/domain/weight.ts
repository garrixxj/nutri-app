/**
 * Weight trend math. Pure, so it unit-tests without a database.
 *
 * `weightTrend` is adapted from macrotracker's `calculateWeightTrend`
 * (MIT, https://github.com/jacobstephens2/macrotracker, see THIRD_PARTY_NOTICES.md):
 * same-day readings collapse to one, each point is the mean of the logged days in the
 * trailing 7-day window, and a weekly change needs data in both weeks. Missing days
 * are skipped, never filled.
 */
import type { WeightLog } from '../db/types.ts'
import { addDays, daysBetween } from './dates.ts'

export const TREND_WINDOW_DAYS = 7

export interface TrendPoint {
  date: string
  /** Raw weigh-in of that day. */
  kg: number
  /** Mean of the logged days in the trailing window ending on `date`. */
  avgKg: number
  /** Logged days that went into `avgKg` (1 = no smoothing yet). */
  samples: number
}

export interface WeightTrend {
  points: TrendPoint[]
  /** Mean of the last 7 days ending on the latest weigh-in. */
  currentKg: number | null
  /** Mean of the 7 days before that. */
  previousKg: number | null
  /** currentKg − previousKg, only when both weeks hold enough readings. */
  weeklyChangeKg: number | null
}

/** Readings sorted by date, one per day (the table already keys by date; this guards imports). */
function dailyReadings(logs: readonly WeightLog[]): { date: string; kg: number }[] {
  const byDate = new Map<string, { total: number; count: number }>()
  for (const log of logs) {
    const d = byDate.get(log.date) ?? { total: 0, count: 0 }
    d.total += log.kg
    d.count++
    byDate.set(log.date, d)
  }
  return [...byDate]
    .map(([date, d]) => ({ date, kg: d.total / d.count }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function windowEnding<T extends { date: string }>(days: readonly T[], end: string, size = TREND_WINDOW_DAYS): T[] {
  return days.filter((d) => {
    const ago = daysBetween(d.date, end)
    return ago >= 0 && ago < size
  })
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

export function weightTrend(logs: readonly WeightLog[]): WeightTrend {
  const days = dailyReadings(logs)
  const points = days.map((day) => {
    const win = windowEnding(days, day.date)
    return { date: day.date, kg: day.kg, avgKg: mean(win.map((d) => d.kg)) ?? day.kg, samples: win.length }
  })
  const latest = days[days.length - 1]
  if (!latest) return { points, currentKg: null, previousKg: null, weeklyChangeKg: null }

  const current = windowEnding(days, latest.date)
  const previous = windowEnding(days, addDays(latest.date, -TREND_WINDOW_DAYS))
  const currentKg = mean(current.map((d) => d.kg))
  const previousKg = mean(previous.map((d) => d.kg))
  const enough = current.length > 0 && previous.length > 0 && current.length + previous.length >= TREND_WINDOW_DAYS
  return {
    points,
    currentKg,
    previousKg,
    weeklyChangeKg: enough && currentKg !== null && previousKg !== null ? round2(currentKg - previousKg) : null,
  }
}

/** Points from the last `days` days (inclusive of `today`). */
export function pointsInRange(points: readonly TrendPoint[], today: string, days: number): TrendPoint[] {
  const from = addDays(today, -(days - 1))
  return points.filter((p) => p.date >= from && p.date <= today)
}

/** Mean weigh-in between two dates (inclusive), or null without readings. */
export function meanWeightBetween(logs: readonly WeightLog[], from: string, to: string): number | null {
  return mean(dailyReadings(logs).filter((d) => d.date >= from && d.date <= to).map((d) => d.kg))
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
