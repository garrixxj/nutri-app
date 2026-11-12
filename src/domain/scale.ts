import type { Item } from '../db/types.ts'
import { round1 } from './sanity.ts'

/**
 * Recalculates an item for a new weight, proportionally to its original values.
 * Always scales from the untouched `base`, so repeated edits never drift.
 */
export function scaleToGrams(base: Item, grams: number): Item {
  if (base.grams <= 0) return { ...base, grams }
  const f = grams / base.grams
  return {
    ...base,
    grams,
    kcal: Math.round(base.kcal * f),
    protein: round1(base.protein * f),
    carbs: round1(base.carbs * f),
    fat: round1(base.fat * f),
  }
}
