import type { Entry, Favorite, Item, Meal } from '../db/types.ts'
import { round1 } from './sanity.ts'

/** "Pollo  Asado " and "pollo asado" are the same food. Accents don't matter either. */
export function normalizeFoodName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Identity of a meal by what's in it, ignoring order and portion sizes. */
export function mealSignature(items: readonly Item[]): string {
  return items
    .map((i) => normalizeFoodName(i.name))
    .sort()
    .join(' | ')
}

/** Default display name for a saved meal: its foods, in the order they were logged. */
export function mealName(items: readonly Item[]): string {
  const name = items.map((i) => i.name.trim()).filter(Boolean).join(', ')
  return name.length > 80 ? `${name.slice(0, 79).trimEnd()}…` : name
}

/** Scales every item of a meal by a portion factor (½, 1½…). Items without grams scale their macros. */
export function scaleItems(items: readonly Item[], factor: number): Item[] {
  if (factor === 1) return items.map((i) => ({ ...i }))
  return items.map((i) => ({
    ...i,
    grams: round1(i.grams * factor),
    kcal: Math.round(i.kcal * factor),
    protein: round1(i.protein * factor),
    carbs: round1(i.carbs * factor),
    fat: round1(i.fat * factor),
  }))
}

export interface FrequentMeal {
  /** mealSignature of its items. */
  key: string
  name: string
  /** Items of the most recent time it was logged (latest portion). */
  items: Item[]
  photoThumb?: string
  /** Times logged in the window. */
  count: number
  /** Times logged as `meal` (the slot the user is logging into now). */
  countInMeal: number
  /** Meal it was logged as most recently. */
  meal: Meal
  lastAt: number
}

export interface FrequentOptions {
  /** Slot being logged now; meals usually eaten then rank first. */
  meal: Meal
  /** Signatures already saved as favorites, so they don't show twice. */
  excludeKeys?: ReadonlySet<string>
  minCount?: number
  limit?: number
}

/**
 * Meals logged repeatedly, built from the entries alone (no extra table).
 * Ranking: usually eaten at this slot first, then most logged, then most recent.
 * Pass only the entries of the window you care about (e.g. the last 60 days).
 */
export function frequentMeals(entries: readonly Entry[], opts: FrequentOptions): FrequentMeal[] {
  const { meal, excludeKeys, minCount = 2, limit = 8 } = opts
  const groups = new Map<string, FrequentMeal>()

  for (const entry of entries) {
    if (entry.items.length === 0) continue
    const key = mealSignature(entry.items)
    if (!key || excludeKeys?.has(key)) continue
    const g = groups.get(key)
    const inMeal = entry.meal === meal ? 1 : 0
    if (!g) {
      groups.set(key, {
        key,
        name: mealName(entry.items),
        items: entry.items,
        ...(entry.photoThumb ? { photoThumb: entry.photoThumb } : {}),
        count: 1,
        countInMeal: inMeal,
        meal: entry.meal,
        lastAt: entry.createdAt,
      })
      continue
    }
    g.count++
    g.countInMeal += inMeal
    if (entry.createdAt > g.lastAt) {
      g.lastAt = entry.createdAt
      g.items = entry.items
      g.name = mealName(entry.items)
      g.meal = entry.meal
      if (entry.photoThumb) g.photoThumb = entry.photoThumb
    }
  }

  return [...groups.values()]
    .filter((g) => g.count >= minCount)
    .sort(
      (a, b) =>
        Number(b.countInMeal > 0) - Number(a.countInMeal > 0) || b.count - a.count || b.lastAt - a.lastAt,
    )
    .slice(0, limit)
}

/** Favorites ordered for the picker: most recently used first. */
export function sortFavorites(favorites: readonly Favorite[]): Favorite[] {
  return [...favorites].sort((a, b) => b.lastUsedAt - a.lastUsedAt || b.createdAt - a.createdAt)
}
