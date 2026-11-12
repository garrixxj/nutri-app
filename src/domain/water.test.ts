import { describe, expect, it } from 'vitest'
import { defaultWaterGoalMl, totalWaterMl, waterGoalMl } from './water.ts'

describe('water', () => {
  it('defaults to 35 ml per kg, rounded to 50 ml', () => {
    expect(defaultWaterGoalMl(80)).toBe(2800)
    expect(defaultWaterGoalMl(63.4)).toBe(2200)
  })

  it('prefers the goal set by hand', () => {
    expect(waterGoalMl({ weightKg: 80, waterGoalMl: 2000 })).toBe(2000)
    expect(waterGoalMl({ weightKg: 80 })).toBe(2800)
  })

  it('adds up the intakes', () => {
    expect(totalWaterMl([])).toBe(0)
    expect(
      totalWaterMl([
        { id: 'a', date: '2026-11-12', ml: 250, createdAt: 1 },
        { id: 'b', date: '2026-11-12', ml: 500, createdAt: 2 },
      ]),
    ).toBe(750)
  })
})
