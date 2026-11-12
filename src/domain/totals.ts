import { MEALS, type Entry, type Macros, type Meal } from '../db/types.ts'

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export function sumMacros(list: readonly Macros[]): Macros {
  return list.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    ZERO_MACROS,
  )
}

export function entryTotals(entry: Entry): Macros {
  return sumMacros(entry.items)
}

export function dayTotals(entries: readonly Entry[]): Macros {
  return sumMacros(entries.flatMap((e) => e.items))
}

/** Entries grouped by meal, in the fixed meal order. */
export function groupByMeal(entries: readonly Entry[]): Record<Meal, Entry[]> {
  const groups = Object.fromEntries(MEALS.map((m) => [m, [] as Entry[]])) as Record<Meal, Entry[]>
  for (const e of entries) groups[e.meal].push(e)
  return groups
}

/** kcal derived from macros (Atwater: 4/4/9). */
export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9
}
