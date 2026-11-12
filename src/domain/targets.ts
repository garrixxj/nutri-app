import type { ActivityLevel, Goal, Sex, Targets } from '../db/types.ts'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const PROTEIN_G_PER_KG = 2
const FAT_SHARE = 0.25
const GAIN_SURPLUS_KCAL = 300
const CUT_FACTOR = 0.8

export interface BodyData {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
}

/** Basal metabolic rate, Mifflin-St Jeor. */
export function bmr({ sex, age, heightCm, weightKg }: Pick<BodyData, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

/** Daily calorie target: BMR × activity factor, adjusted by goal. */
export function goalKcal(data: BodyData): number {
  const tdee = bmr(data) * ACTIVITY_FACTORS[data.activityLevel]
  switch (data.goal) {
    case 'gain_muscle':
      return tdee + GAIN_SURPLUS_KCAL
    case 'maintain':
      return tdee
    case 'cut':
      return tdee * CUT_FACTOR
  }
}

/** Splits a calorie target: protein 2 g/kg, fat 25% of kcal, carbs the rest. */
export function macrosForKcal(kcal: number, weightKg: number): Targets {
  const roundedKcal = Math.round(kcal)
  const protein = Math.round(PROTEIN_G_PER_KG * weightKg)
  const fat = Math.round((roundedKcal * FAT_SHARE) / 9)
  const carbs = Math.max(0, Math.round((roundedKcal - protein * 4 - fat * 9) / 4))
  return { kcal: roundedKcal, protein, carbs, fat }
}

export function calculateTargets(data: BodyData): Targets {
  return macrosForKcal(goalKcal(data), data.weightKg)
}

/**
 * Shifts the daily kcal by `deltaKcal`, keeping protein as it is (it depends on body
 * weight, not on energy) and re-splitting the rest: fat at its usual share, carbs fill in.
 */
export function adjustKcal(targets: Targets, deltaKcal: number): Targets {
  const kcal = Math.max(800, Math.round(targets.kcal + deltaKcal))
  const protein = targets.protein
  const fat = Math.round((kcal * FAT_SHARE) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat }
}
