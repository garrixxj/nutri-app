import { describe, expect, it } from 'vitest'
import type { Meal } from '../db/types.ts'
import { coachMessage, dayMood, loggingStreak, streakLabel, type DayStatus } from './mascot.ts'

const targets = { kcal: 2000, protein: 150, carbs: 220, fat: 60 }
const status = (kcal: number, protein: number, meals: Meal[], hour = 13): DayStatus => ({
  totals: { kcal, protein, carbs: 0, fat: 0 },
  targets,
  meals,
  hour,
})

describe('dayMood', () => {
  it('sleeps with nothing logged', () => {
    expect(dayMood(status(0, 0, [])).mood).toBe('sleep')
  })

  it('is idle while under the goals', () => {
    expect(dayMood(status(900, 60, ['desayuno', 'almuerzo'])).mood).toBe('idle')
  })

  it('celebrates the kcal goal or the protein goal', () => {
    expect(dayMood(status(2000, 90, ['almuerzo'])).met).toEqual({ kcal: true, protein: false })
    expect(dayMood(status(2000, 90, ['almuerzo'])).mood).toBe('celebrate')
    expect(dayMood(status(1500, 150, ['almuerzo'])).mood).toBe('celebrate')
  })

  it('only worries above 115 % and from 18:00 or with dinner logged', () => {
    expect(dayMood(status(2300, 100, ['almuerzo'], 20)).mood).not.toBe('worried') // exactly 115 %
    expect(dayMood(status(2400, 100, ['almuerzo'], 13)).mood).toBe('idle')
    expect(dayMood(status(2400, 100, ['almuerzo'], 13)).wayOver).toBe(true)
    expect(dayMood(status(2400, 100, ['almuerzo'], 18)).mood).toBe('worried')
    expect(dayMood(status(2400, 100, ['almuerzo', 'cena'], 15)).mood).toBe('worried')
  })

  it('does not count kcal as met once way over, but protein still celebrates mid-day', () => {
    const r = dayMood(status(2400, 160, ['almuerzo'], 13))
    expect(r.met).toEqual({ kcal: false, protein: true })
    expect(r.mood).toBe('celebrate')
  })
})

describe('loggingStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(loggingStreak(['2026-11-10', '2026-11-11', '2026-11-12'], '2026-11-12')).toBe(3)
  })

  it('keeps yesterday’s streak while today is still empty', () => {
    expect(loggingStreak(['2026-11-10', '2026-11-11'], '2026-11-12')).toBe(2)
  })

  it('breaks after a whole empty day and works across months', () => {
    expect(loggingStreak(['2026-11-09', '2026-11-11', '2026-11-12'], '2026-11-12')).toBe(2)
    expect(loggingStreak(['2026-10-31', '2026-11-01'], '2026-11-01')).toBe(2)
    expect(loggingStreak([], '2026-11-12')).toBe(0)
  })

  it('labels singular and plural', () => {
    expect(streakLabel(1)).toBe('Racha de 1 día')
    expect(streakLabel(5)).toBe('Racha de 5 días')
  })
})

describe('coachMessage', () => {
  const ctx = (s: DayStatus) => ({ ...s, today: '2026-11-12', streak: 4 })

  it('is stable for the same day', () => {
    const s = status(900, 60, ['almuerzo'])
    expect(coachMessage(dayMood(s), ctx(s))).toBe(coachMessage(dayMood(s), ctx(s)))
  })

  it('names the protein still missing', () => {
    const s = status(900, 60, ['almuerzo'])
    expect(coachMessage(dayMood(s), ctx(s))).toContain('90 g de proteína')
  })

  it('protects the streak at night with nothing logged', () => {
    const s = status(0, 0, [], 21)
    expect(coachMessage(dayMood(s), ctx(s))).toBe('Anota lo de hoy y no se corta tu racha de 4 días.')
  })

  it('celebrates both goals together', () => {
    const s = status(2050, 155, ['almuerzo', 'cena'], 21)
    expect(coachMessage(dayMood(s), ctx(s))).toBe('¡Kcal y proteína al día! Día redondo.')
  })

  it('never scolds when worried', () => {
    const s = status(2600, 100, ['cena'], 21)
    expect(coachMessage(dayMood(s), ctx(s))).toMatch(/no pasa nada|no define nada|Tranqui/)
  })
})
