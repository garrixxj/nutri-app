import { useState } from 'react'
import { goBack } from '../app/router.ts'
import { db } from '../db/db.ts'
import { MEALS, type Item, type Meal } from '../db/types.ts'
import { ChipGroup, MacroLabel, NumberRow, RowGroup, TextRow } from '../components/fields.tsx'
import { IconTrash } from '../components/icons.tsx'
import { BottomBar, Button, SectionTitle } from '../components/ui.tsx'
import { toISODate } from '../domain/dates.ts'
import { formatInt, parseDecimal } from '../domain/format.ts'
import { MEAL_LABELS } from '../domain/labels.ts'
import { isMeal, mealForHour } from '../domain/meals.ts'
import { kcalFromMacros } from '../domain/totals.ts'
import { newId } from '../lib/id.ts'

interface Draft {
  key: string
  name: string
  grams: string
  kcal: string
  protein: string
  carbs: string
  fat: string
}

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m, label: MEAL_LABELS[m] }))

const emptyDraft = (name = ''): Draft => ({ key: newId(), name, grams: '', kcal: '', protein: '', carbs: '', fat: '' })

/** kcal typed by the user, or derived from the macros when left empty. */
function draftKcal(d: Draft): number | null {
  const typed = parseDecimal(d.kcal)
  if (typed !== null) return typed
  const p = parseDecimal(d.protein)
  const c = parseDecimal(d.carbs)
  const f = parseDecimal(d.fat)
  if (p === null && c === null && f === null) return null
  return kcalFromMacros(p ?? 0, c ?? 0, f ?? 0)
}

function toItem(d: Draft): Item | string {
  const name = d.name.trim()
  if (!name) return 'Ponle nombre a cada alimento.'
  const fields = [d.grams, d.kcal, d.protein, d.carbs, d.fat]
  if (fields.some((f) => f.trim() !== '' && parseDecimal(f) === null)) {
    return `Revisa los números de "${name}": usa solo dígitos y coma.`
  }
  const kcal = draftKcal(d)
  if (kcal === null) return `Indica las calorías o los macros de "${name}".`
  return {
    name,
    grams: parseDecimal(d.grams) ?? 0,
    kcal: Math.round(kcal),
    protein: parseDecimal(d.protein) ?? 0,
    carbs: parseDecimal(d.carbs) ?? 0,
    fat: parseDecimal(d.fat) ?? 0,
  }
}

export function ManualEntry({ params }: { params: URLSearchParams }) {
  const mealParam = params.get('meal')
  const dateParam = params.get('date')
  const [date] = useState(() =>
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toISODate(new Date()),
  )

  const [meal, setMeal] = useState<Meal>(() =>
    isMeal(mealParam) ? mealParam : mealForHour(new Date().getHours()),
  )
  const [drafts, setDrafts] = useState<Draft[]>(() => [emptyDraft(params.get('name')?.slice(0, 120) ?? '')])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))

  const totalKcal = drafts.reduce((sum, d) => sum + (draftKcal(d) ?? 0), 0)

  async function save() {
    const items: Item[] = []
    for (const d of drafts) {
      const result = toItem(d)
      if (typeof result === 'string') {
        setError(result)
        return
      }
      items.push(result)
    }
    setSaving(true)
    await db.entries.add({ id: newId(), date, meal, items, source: 'manual', createdAt: Date.now() })
    goBack('/')
  }

  return (
    <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+104px)]">
      <header className="safe-top px-4">
        <div className="flex min-h-11 items-center pt-2">
          <Button variant="plain" className="-ml-2 px-2" onClick={() => goBack('/')}>
            Cancelar
          </Button>
        </div>
        <h1 className="pt-2 pb-1 text-title font-bold tracking-tight">Registro manual</h1>
      </header>

      <SectionTitle>Comida</SectionTitle>
      <ChipGroup label="Comida" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />

      {drafts.map((d, i) => {
        const derived = parseDecimal(d.kcal) === null ? draftKcal(d) : null
        return (
          <div key={d.key}>
            <div className="flex items-end justify-between pr-2">
              <SectionTitle>{drafts.length > 1 ? `Alimento ${i + 1}` : 'Alimento'}</SectionTitle>
              {drafts.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar alimento ${i + 1}`}
                  onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
                  className="flex size-11 items-center justify-center text-danger"
                >
                  <IconTrash size={20} />
                </button>
              )}
            </div>
            <RowGroup>
              <TextRow label="Nombre" placeholder="Ej: Marraqueta con palta" value={d.name} onChange={(v) => update(d.key, { name: v })} />
              <NumberRow label="Cantidad" value={d.grams} onChange={(v) => update(d.key, { grams: v })} suffix="g" placeholder="Opcional" />
              <NumberRow
                label="Calorías"
                value={d.kcal}
                onChange={(v) => update(d.key, { kcal: v })}
                suffix="kcal"
                placeholder={derived !== null ? formatInt(derived) : '0'}
              />
              <NumberRow label={<MacroLabel color="bg-protein" text="Proteína" />} value={d.protein} onChange={(v) => update(d.key, { protein: v })} suffix="g" placeholder="0" />
              <NumberRow label={<MacroLabel color="bg-carbs" text="Carbohidratos" />} value={d.carbs} onChange={(v) => update(d.key, { carbs: v })} suffix="g" placeholder="0" />
              <NumberRow label={<MacroLabel color="bg-fat" text="Grasa" />} value={d.fat} onChange={(v) => update(d.key, { fat: v })} suffix="g" placeholder="0" />
            </RowGroup>
          </div>
        )
      })}
      <p className="px-4 pt-2 text-label text-text-2">Si dejas las calorías vacías, las calculo con los macros.</p>

      <div className="px-4 pt-3">
        <Button variant="secondary" className="w-full" onClick={() => setDrafts((ds) => [...ds, emptyDraft()])}>
          Agregar otro alimento
        </Button>
      </div>

      {error && (
        <p className="px-4 pt-3 text-secondary text-danger" role="alert">
          {error}
        </p>
      )}

      <BottomBar>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-label text-text-2">Total</p>
            <p className="text-body font-semibold tabular">{formatInt(totalKcal)} kcal</p>
          </div>
          <Button className="flex-[2]" onClick={save} disabled={saving}>
            Guardar
          </Button>
        </div>
      </BottomBar>
    </main>
  )
}

