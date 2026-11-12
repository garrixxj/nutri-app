import { describe, expect, it } from 'vitest'
import type { Entry, Meal, WeightLog } from '../db/types.ts'
import { addDays } from './dates.ts'
import { gainPace, weekStart, weeklySummary } from './progress.ts'

const TODAY = '2026-11-12' // Thursday

function entry(date: string, kcal: number, meal: Meal = 'almuerzo'): Entry {
  return {
    id: `${date}-${meal}-${kcal}`,
    date,
    meal,
    source: 'text',
    createdAt: 0,
    items: [{ name: 'x', grams: 100, kcal, protein: kcal / 20, carbs: kcal / 8, fat: kcal / 40 }],
  }
}

/** Daily weigh-ins over the last `days` days following a straight line of `kgPerWeek`. */
function line(kgPerWeek: number, days = 28, startKg = 80): WeightLog[] {
  return Array.from({ length: days }, (_, i) => ({
    date: addDays(TODAY, -(days - 1) + i),
    kg: startKg + (kgPerWeek / 7) * i,
    createdAt: i,
  }))
}

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart(TODAY)).toBe('2026-11-09')
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
    expect(weekStart('2026-11-15')).toBe('2026-11-09') // Sunday
  })
})

describe('weeklySummary', () => {
  const start = weekStart(TODAY)

  it('averages kcal and macros over logged days only', () => {
    const entries = [entry('2026-11-09', 2000), entry('2026-11-09', 1000, 'cena'), entry('2026-11-11', 2400), entry('2026-11-02', 9999)]
    const s = weeklySummary(entries, [], start, TODAY)
    expect(s.loggedDays).toBe(2)
    expect(s.average?.kcal).toBe(2700)
    expect(s.average?.protein).toBe(135)
    expect(s.days.map((d) => d.kcal)).toEqual([3000, 0, 2400, 0, 0, 0, 0])
    expect(s.days.filter((d) => d.future).map((d) => d.date)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15'])
    expect(s.isCurrentWeek).toBe(true)
  })

  it('has no average for an empty week', () => {
    expect(weeklySummary([], [], start, TODAY).average).toBeNull()
  })

  it('compares the mean weigh-in with the previous week', () => {
    const weights: WeightLog[] = [
      { date: '2026-11-03', kg: 80, createdAt: 0 },
      { date: '2026-11-05', kg: 80.4, createdAt: 0 },
      { date: '2026-11-10', kg: 80.6, createdAt: 0 },
      { date: '2026-11-12', kg: 80.8, createdAt: 0 },
    ]
    expect(weeklySummary([], weights, start, TODAY).weightChangeKg).toBe(0.5)
    expect(weeklySummary([], weights.slice(2), start, TODAY).weightChangeKg).toBeNull()
  })
})

describe('gainPace', () => {
  it('asks for more weigh-ins before judging', () => {
    expect(gainPace(line(0.3, 5), TODAY)).toEqual({ status: 'insufficient', readings: 5, spanDays: 4 })
    const sparse = line(0.3).filter((_, i) => i % 6 === 0) // 5 readings over 24 days
    expect(gainPace(sparse, TODAY).status).toBe('insufficient')
  })

  it('is on pace between +0.25% and +0.5% per week', () => {
    const pace = gainPace(line(0.3), TODAY)
    expect(pace.status).toBe('ok')
    if (pace.status !== 'insufficient') {
      expect(pace.weeklyKg).toBeCloseTo(0.3, 2)
      expect(pace.suggestKcal).toBe(0)
    }
  })

  it('suggests eating more when the weight is flat, capped at +250 kcal', () => {
    const pace = gainPace(line(0), TODAY)
    expect(pace).toMatchObject({ status: 'slow', suggestKcal: 250 })
  })

  it('suggests a small bump when slightly slow, rounded to 50', () => {
    expect(gainPace(line(0.15), TODAY)).toMatchObject({ status: 'slow', suggestKcal: 150 })
  })

  it('suggests eating less when gaining too fast', () => {
    expect(gainPace(line(1), TODAY)).toMatchObject({ status: 'fast', suggestKcal: -250 })
  })

  it('ignores weigh-ins outside the 28-day window', () => {
    const old: WeightLog[] = [{ date: addDays(TODAY, -60), kg: 60, createdAt: 0 }]
    expect(gainPace([...old, ...line(0.3)], TODAY).status).toBe('ok')
  })
})
