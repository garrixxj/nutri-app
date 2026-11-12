import { describe, expect, it } from 'vitest'
import type { Entry, Item, Meal } from '../db/types.ts'
import { frequentMeals, mealName, mealSignature, normalizeFoodName, scaleItems } from './favorites.ts'

const item = (name: string, grams = 100, kcal = 200): Item => ({ name, grams, kcal, protein: 10, carbs: 20, fat: 5 })

let t = 0
function entry(meal: Meal, names: string[], extra: Partial<Entry> = {}): Entry {
  t++
  return { id: `e${t}`, date: '2026-11-12', meal, items: names.map((n) => item(n)), source: 'text', createdAt: t, ...extra }
}

describe('meal identity', () => {
  it('ignores accents, case, spacing and order', () => {
    expect(normalizeFoodName('  Plátano   Frito ')).toBe('platano frito')
    expect(mealSignature([item('Café con leche'), item('Marraqueta')])).toBe(
      mealSignature([item('marraqueta'), item('cafe  con leche')]),
    )
  })

  it('names a meal by its foods', () => {
    expect(mealName([item('Marraqueta con palta'), item('Café')])).toBe('Marraqueta con palta, Café')
  })
})

describe('frequentMeals', () => {
  it('needs at least two logs and ranks by count', () => {
    const entries = [
      entry('almuerzo', ['Cazuela']),
      entry('almuerzo', ['Cazuela']),
      entry('almuerzo', ['Cazuela']),
      entry('almuerzo', ['Porotos']),
      entry('almuerzo', ['Porotos']),
      entry('almuerzo', ['Pastel de choclo']),
    ]
    const result = frequentMeals(entries, { meal: 'almuerzo' })
    expect(result.map((f) => [f.name, f.count])).toEqual([
      ['Cazuela', 3],
      ['Porotos', 2],
    ])
  })

  it('puts what is usually eaten at this slot first', () => {
    const entries = [
      entry('almuerzo', ['Cazuela']),
      entry('almuerzo', ['Cazuela']),
      entry('almuerzo', ['Cazuela']),
      entry('once', ['Pan con palta']),
      entry('once', ['Pan con palta']),
    ]
    expect(frequentMeals(entries, { meal: 'once' }).map((f) => f.name)).toEqual(['Pan con palta', 'Cazuela'])
  })

  it('uses the latest portion and photo as the template', () => {
    const old = entry('cena', ['Fideos'], { photoThumb: 'data:image/jpeg;base64,OLD' })
    const latest: Entry = { ...entry('cena', ['FIDEOS']), items: [item('FIDEOS', 300, 450)] }
    const [f] = frequentMeals([old, latest], { meal: 'cena' })
    expect(f?.items[0]?.grams).toBe(300)
    expect(f?.name).toBe('FIDEOS')
    expect(f?.photoThumb).toBe('data:image/jpeg;base64,OLD')
  })

  it('skips meals already saved as favorites and respects the limit', () => {
    const entries = ['A', 'A', 'B', 'B', 'C', 'C'].map((n) => entry('snack', [n]))
    const result = frequentMeals(entries, { meal: 'snack', excludeKeys: new Set([mealSignature([item('B')])]), limit: 1 })
    expect(result).toHaveLength(1)
    expect(result[0]?.name).not.toBe('B')
  })
})

describe('scaleItems', () => {
  it('scales grams and macros by the portion', () => {
    const [half] = scaleItems([{ name: 'Arroz', grams: 180, kcal: 234, protein: 4.3, carbs: 51, fat: 0.5 }], 0.5)
    expect(half).toEqual({ name: 'Arroz', grams: 90, kcal: 117, protein: 2.2, carbs: 25.5, fat: 0.3 })
  })

  it('returns copies at 1×', () => {
    const items = [item('Pan')]
    const copy = scaleItems(items, 1)
    expect(copy).toEqual(items)
    expect(copy[0]).not.toBe(items[0])
  })
})
