import type { Profile, WaterLog } from '../db/types.ts'

/** Common rule of thumb for adults; only a starting point the user can edit in Ajustes. */
export const WATER_ML_PER_KG = 35
export const WATER_QUICK_ADD_ML = [250, 500] as const

/** Default daily goal for a body weight, rounded to 50 ml. */
export function defaultWaterGoalMl(weightKg: number): number {
  return Math.round((weightKg * WATER_ML_PER_KG) / 50) * 50
}

export function waterGoalMl(profile: Pick<Profile, 'weightKg' | 'waterGoalMl'>): number {
  return profile.waterGoalMl ?? defaultWaterGoalMl(profile.weightKg)
}

export function totalWaterMl(logs: readonly WaterLog[]): number {
  return logs.reduce((sum, l) => sum + l.ml, 0)
}
