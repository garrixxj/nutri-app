import { useId, useState } from 'react'
import { MEALS, type Item, type Meal } from '../db/types.ts'
import { ChipGroup } from '../components/fields.tsx'
import { IconTrash } from '../components/icons.tsx'
import { BottomBar, Button, SectionTitle } from '../components/ui.tsx'
import { formatInt, parseDecimal, toInputString } from '../domain/format.ts'
import { MEAL_LABELS } from '../domain/labels.ts'
import { scaleToGrams } from '../domain/scale.ts'
import { sumMacros } from '../domain/totals.ts'
import { newId } from '../lib/id.ts'

export interface ReviewInput {
  item: Item
  warning: string | null
}

interface Row {
  key: string
  /** Original values; every grams edit rescales from here. */
  base: Item
  name: string
  grams: string
  warning: string | null
}

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m, label: MEAL_LABELS[m] }))

function currentItem(row: Row): Item | null {
  const grams = row.grams.trim() === '' && row.base.grams === 0 ? 0 : parseDecimal(row.grams)
  if (grams === null || (row.base.grams > 0 && grams <= 0)) return null
  return { ...scaleToGrams(row.base, grams), name: row.name.trim() || row.base.name }
}

/**
 * Editable list of items before saving. Changing grams rescales kcal and
 * macros proportionally; totals update on every keystroke.
 */
export function Review({
  title,
  initialItems,
  initialMeal,
  assumptions = [],
  thumb,
  saveLabel = 'Guardar',
  onCancel,
  onSave,
}: {
  title: string
  initialItems: ReviewInput[]
  initialMeal: Meal
  assumptions?: string[]
  thumb?: string
  saveLabel?: string
  onCancel: () => void
  onSave: (meal: Meal, items: Item[]) => Promise<void>
}) {
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [rows, setRows] = useState<Row[]>(() =>
    initialItems.map(({ item, warning }) => ({
      key: newId(),
      base: item,
      name: item.name,
      grams: item.grams > 0 ? toInputString(item.grams) : '',
      warning,
    })),
  )
  const [saving, setSaving] = useState(false)

  const items = rows.map(currentItem)
  const valid = items.every((i): i is Item => i !== null) && items.length > 0
  const totals = sumMacros(items.filter((i): i is Item => i !== null))

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function save() {
    if (!valid) return
    setSaving(true)
    try {
      await onSave(meal, items as Item[])
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+104px)]">
      <header className="safe-top px-4">
        <div className="flex min-h-11 items-center pt-2">
          <Button variant="plain" className="-ml-2 px-2" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        <h1 className="pt-2 pb-1 text-title font-bold tracking-tight">{title}</h1>
      </header>

      <div className="mt-2 flex items-center gap-4 px-4">
        {thumb && (
          <img src={thumb} alt="Foto de la comida" width={72} height={72} className="size-18 shrink-0 rounded-inner object-cover" />
        )}
        <div className="min-w-0">
          <p className="text-title font-bold tabular">
            {formatInt(totals.kcal)} <span className="text-secondary font-medium text-text-2">kcal</span>
          </p>
          <p className="mt-0.5 text-secondary tabular">
            <span className="text-protein">P {formatInt(totals.protein)} g</span>
            <span className="text-text-2"> · </span>
            <span className="text-carbs">C {formatInt(totals.carbs)} g</span>
            <span className="text-text-2"> · </span>
            <span className="text-fat">G {formatInt(totals.fat)} g</span>
          </p>
        </div>
      </div>

      <SectionTitle>Comida</SectionTitle>
      <ChipGroup label="Comida" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />

      <SectionTitle>{rows.length === 1 ? 'Alimento' : `${rows.length} alimentos`}</SectionTitle>
      {rows.length === 0 && <p className="px-4 text-secondary text-text-2">Quitaste todos los alimentos. Cancela para volver.</p>}
      <ul className="flex flex-col gap-2 px-4">
        {rows.map((row, i) => (
          <ReviewRow
            key={row.key}
            row={row}
            item={items[i] ?? null}
            onChange={(patch) => update(row.key, patch)}
            onRemove={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
          />
        ))}
      </ul>

      {assumptions.length > 0 && (
        <>
          <SectionTitle>Supuestos de la IA</SectionTitle>
          <ul className="flex flex-wrap gap-2 px-4">
            {assumptions.map((a, i) => (
              <li key={i} className="rounded-full bg-card px-3 py-1.5 text-label text-text-2 shadow-card">
                {a}
              </li>
            ))}
          </ul>
        </>
      )}

      <BottomBar>
        <Button className="w-full" onClick={save} disabled={!valid || saving}>
          {saveLabel} · {formatInt(totals.kcal)} kcal
        </Button>
      </BottomBar>
    </main>
  )
}

function ReviewRow({
  row,
  item,
  onChange,
  onRemove,
}: {
  row: Row
  item: Item | null
  onChange: (patch: Partial<Row>) => void
  onRemove: () => void
}) {
  const nameId = useId()
  const gramsId = useId()
  const confidence = row.base.confidence

  return (
    <li className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-start gap-2">
        <label htmlFor={nameId} className="sr-only">
          Nombre del alimento
        </label>
        <input
          id={nameId}
          type="text"
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1 text-body font-semibold outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${row.name || 'alimento'}`}
          className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center text-text-2 active:text-danger"
        >
          <IconTrash size={20} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <label
          htmlFor={gramsId}
          className={`flex min-h-11 items-center gap-1 rounded-button bg-fill px-3 ${item ? '' : 'ring-2 ring-danger'}`}
        >
          <input
            id={gramsId}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={row.grams}
            placeholder="—"
            onChange={(e) => onChange({ grams: e.target.value })}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Gramos"
            className="w-16 bg-transparent text-right text-body font-semibold tabular outline-none"
          />
          <span className="text-secondary text-text-2">g</span>
        </label>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-body font-semibold tabular">{item ? `${formatInt(item.kcal)} kcal` : '—'}</p>
          {item && (
            <p className="text-label tabular">
              <span className="text-protein">P {formatInt(item.protein)}</span>
              <span className="text-text-2"> · </span>
              <span className="text-carbs">C {formatInt(item.carbs)}</span>
              <span className="text-text-2"> · </span>
              <span className="text-fat">G {formatInt(item.fat)}</span>
            </p>
          )}
        </div>
      </div>

      {(confidence !== undefined || row.warning) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {confidence !== undefined && <ConfidenceChip value={confidence} />}
          {row.warning && (
            <span className="rounded-full bg-carbs/15 px-2.5 py-1 text-label font-medium text-carbs">Revisa: {row.warning.toLowerCase()}</span>
          )}
        </div>
      )}
    </li>
  )
}

function ConfidenceChip({ value }: { value: number }) {
  const [label, cls] =
    value >= 0.75
      ? ['Confianza alta', 'bg-accent/15 text-accent']
      : value >= 0.5
        ? ['Confianza media', 'bg-carbs/15 text-carbs']
        : ['Confianza baja', 'bg-danger/15 text-danger']
  return <span className={`rounded-full px-2.5 py-1 text-label font-medium ${cls}`}>{label}</span>
}
