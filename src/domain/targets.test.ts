import { describe, expect, it } from 'vitest'
import { bmr, calculateTargets, macrosForKcal, type BodyData } from './targets.ts'

const male: BodyData = { sex: 'male', age: 30, heightCm: 175, weightKg: 75, activityLevel: 'moderate', goal: 'maintain' }

describe('bmr (Mifflin-St Jeor)', () => {
  it('uses +5 for men', () => {
    expect(bmr(male)).toBeCloseTo(1698.75)
  })

  it('uses -161 for women', () => {
    expect(bmr({ sex: 'female', age: 28, heightCm: 160, weightKg: 60 })).toBeCloseTo(1299)
  })
})

describe('calculateTargets', () => {
  it('maintain: TDEE with protein 2 g/kg, fat 25%, carbs the rest', () => {
    // 1698.75 × 1.55 = 2633.06
    expect(calculateTargets(male)).toEqual({ kcal: 2633, protein: 150, fat: 73, carbs: 344 })
  })

  it('gain_muscle adds 300 kcal', () => {
    expect(calculateTargets({ ...male, goal: 'gain_muscle' }).kcal).toBe(2933)
  })

  it('cut removes 20%', () => {
    expect(calculateTargets({ ...male, goal: 'cut' }).kcal).toBe(2106)
  })

  it('applies the activity factor', () => {
    // 1299 × 1.375 = 1786.1
    const female: BodyData = { sex: 'female', age: 28, heightCm: 160, weightKg: 60, activityLevel: 'light', goal: 'maintain' }
    expect(calculateTargets(female).kcal).toBe(1786)
  })

  it('macro kcal add up to the target within rounding', () => {
    const t = calculateTargets({ ...male, goal: 'cut' })
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThanOrEqual(4)
  })
})

describe('macrosForKcal', () => {
  it('never returns negative carbs when protein and fat exceed the target', () => {
    expect(macrosForKcal(800, 120).carbs).toBe(0)
  })
})
