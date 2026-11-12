import { describe, expect, it } from 'vitest'
import type { WeightLog } from '../db/types.ts'
import { addDays } from './dates.ts'
import { meanWeightBetween, pointsInRange, weightTrend } from './weight.ts'

const START = '2026-11-01'
const log = (day: number, kg: number): WeightLog => ({ date: addDays(START, day), kg, createdAt: day })

describe('weightTrend', () => {
  it('returns nothing for an empty log', () => {
    expect(weightTrend([])).toEqual({ points: [], currentKg: null, previousKg: null, weeklyChangeKg: null })
  })

  it('smooths each point over the logged days of the trailing week', () => {
    const { points } = weightTrend([log(0, 80), log(2, 81), log(6, 82), log(7, 83)])
    expect(points.map((p) => [p.avgKg, p.samples])).toEqual([
      [80, 1],
      [80.5, 2],
      [81, 3],
      // Day 0 has left the window on day 7.
      [82, 3],
    ])
    expect(points[3]?.kg).toBe(83)
  })

  it('collapses same-day readings into one', () => {
    const { points } = weightTrend([log(0, 80), { ...log(0, 81), createdAt: 99 }])
    expect(points).toHaveLength(1)
    expect(points[0]?.kg).toBe(80.5)
  })

  it('reports the weekly change only with enough readings in both weeks', () => {
    const twoWeeks = Array.from({ length: 14 }, (_, d) => log(d, d < 7 ? 80 : 80.4))
    expect(weightTrend(twoWeeks).weeklyChangeKg).toBe(0.4)

    const sparse = [log(0, 80), log(7, 81), log(13, 81)]
    const trend = weightTrend(sparse)
    expect(trend.currentKg).toBe(81)
    expect(trend.weeklyChangeKg).toBeNull()
  })

  it('sorts unsorted input by date', () => {
    expect(weightTrend([log(3, 82), log(1, 80)]).points.map((p) => p.kg)).toEqual([80, 82])
  })
})

describe('ranges', () => {
  it('keeps the points of the last N days', () => {
    const { points } = weightTrend([log(0, 80), log(20, 81), log(29, 82)])
    expect(pointsInRange(points, addDays(START, 29), 10).map((p) => p.kg)).toEqual([81, 82])
    expect(pointsInRange(points, addDays(START, 29), 9).map((p) => p.kg)).toEqual([82])
    expect(pointsInRange(points, addDays(START, 29), 30)).toHaveLength(3)
  })

  it('averages the weigh-ins between two dates', () => {
    const logs = [log(0, 80), log(1, 81), log(9, 90)]
    expect(meanWeightBetween(logs, START, addDays(START, 6))).toBe(80.5)
    expect(meanWeightBetween(logs, addDays(START, 2), addDays(START, 5))).toBeNull()
  })
})
