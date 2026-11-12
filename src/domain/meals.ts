import { MEALS, type Meal } from '../db/types.ts'

/** Suggested meal for a time of day, following Chilean meal times. */
export function mealForHour(hour: number): Meal {
  if (hour >= 5 && hour < 11) return 'desayuno'
  if (hour >= 11 && hour < 16) return 'almuerzo'
  if (hour >= 16 && hour < 20) return 'once'
  if (hour >= 20 && hour < 24) return 'cena'
  return 'snack'
}

export function isMeal(v: string | null): v is Meal {
  return v !== null && (MEALS as readonly string[]).includes(v)
}
