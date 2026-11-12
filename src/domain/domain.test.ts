import { describe, expect, it } from 'vitest'
import type { Entry } from '../db/types.ts'
import { addDays, formatLongDate, relativeDay, toISODate } from './dates.ts'
import { isMeal, mealForHour } from './meals.ts'
import { dayTotals, groupByMeal, kcalFromMacros } from './totals.ts'

const entry = (meal: Entry['meal'], kcal: number): Entry => ({
  id: `${meal}-${kcal}`,
  date: '2026-11-12',
  meal,
  source: 'manual',
  createdAt: 0,
  items: [{ name: 'x', grams: 100, kcal, protein: 10, carbs: 20, fat: 5 }],
})

describe('totals', () => {
  it('sums every item of the day', () => {
    expect(dayTotals([entry('once', 300), entry('cena', 500)])).toEqual({ kcal: 800, protein: 20, carbs: 40, fat: 10 })
  })

  it('groups entries by meal including empty meals', () => {
    const g = groupByMeal([entry('once', 300)])
    expect(Object.keys(g)).toEqual(['desayuno', 'almuerzo', 'once', 'cena', 'snack'])
    expect(g.once).toHaveLength(1)
    expect(g.desayuno).toHaveLength(0)
  })

  it('derives kcal from macros', () => {
    expect(kcalFromMacros(10, 20, 5)).toBe(165)
  })
})

describe('meals', () => {
  it('follows Chilean meal times', () => {
    expect(mealForHour(8)).toBe('desayuno')
    expect(mealForHour(13)).toBe('almuerzo')
    expect(mealForHour(18)).toBe('once')
    expect(mealForHour(21)).toBe('cena')
    expect(mealForHour(2)).toBe('snack')
  })

  it('validates meal names', () => {
    expect(isMeal('once')).toBe(true)
    expect(isMeal('merienda')).toBe(false)
    expect(isMeal(null)).toBe(false)
  })
})

describe('dates', () => {
  it('uses the local calendar date', () => {
    expect(toISODate(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('formats a long Spanish date', () => {
    expect(formatLongDate('2026-11-12')).toBe('jueves 12 de noviembre')
  })
})

describe('relative days', () => {
  it('counts calendar days, including across DST changes', () => {
    expect(relativeDay('2026-11-12', '2026-11-12')).toBe('hoy')
    expect(relativeDay('2026-11-11', '2026-11-12')).toBe('ayer')
    expect(relativeDay('2026-08-30', '2026-09-10')).toBe('hace 11 días')
  })
})
