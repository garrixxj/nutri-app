/**
 * Deterministic checks on AI output (idea from nut-ai's sanity clamp; own code).
 * Never deletes an item: it bounds the numbers and flags the ones to double-check.
 */
import type { Item } from '../db/types.ts'
import { kcalFromMacros } from './totals.ts'

export const LIMITS = {
  itemGrams: 3000,
  itemKcal: 3000,
  mealKcal: 5000,
  /** Relative gap allowed between kcal and 4P+4C+9G. */
  kcalMismatch: 0.25,
  /** Absolute gap (kcal) under which a mismatch is ignored. */
  kcalMismatchFloor: 40,
} as const

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
export const round1 = (n: number) => Math.round(n * 10) / 10

/** Coerces raw numbers into sane ranges and rounds them for display. */
export function normalizeItem(raw: Partial<Record<keyof Item, unknown>>): Item {
  const item: Item = {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Alimento',
    grams: Math.round(clamp(num(raw.grams), 0, LIMITS.itemGrams)),
    kcal: Math.round(clamp(num(raw.kcal), 0, LIMITS.itemKcal)),
    protein: round1(clamp(num(raw.protein), 0, 500)),
    carbs: round1(clamp(num(raw.carbs), 0, 1000)),
    fat: round1(clamp(num(raw.fat), 0, 500)),
  }
  if (typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)) {
    item.confidence = Math.round(clamp(raw.confidence, 0, 1) * 100) / 100
  }
  return item
}

/** Reason to double-check an item, or null when it looks plausible. */
export function itemWarning(item: Item, raw?: Partial<Record<keyof Item, unknown>>): string | null {
  if (raw && (num(raw.grams) > LIMITS.itemGrams || num(raw.kcal) > LIMITS.itemKcal)) {
    return 'La porción parece exagerada'
  }
  const fromMacros = kcalFromMacros(item.protein, item.carbs, item.fat)
  const gap = Math.abs(fromMacros - item.kcal)
  if (gap > LIMITS.kcalMismatchFloor && gap / Math.max(item.kcal, fromMacros, 1) > LIMITS.kcalMismatch) {
    return 'Las calorías no cuadran con los macros'
  }
  if (item.grams > 0 && item.kcal / item.grams > 9.2) return 'Demasiadas calorías para ese peso'
  return null
}
