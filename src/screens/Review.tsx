import { useId, useState } from 'react'
import { MEALS, type Item, type Meal } from '../db/types.ts'
import { ChipGroup } from '../components/fields.tsx'
import { IconTrash } from '../components/icons.tsx'
import { PhotoHero } from '../components/PhotoHero.tsx'
import { BottomBar, Button, FlowHeader, SectionTitle } from '../components/ui.tsx'
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
  photo,
  saveLabel,
  onCancel,
  onSave,
}: {
  title: string
  initialItems: ReviewInput[]
  initialMeal: Meal
  assumptions?: string[]
  /** Small saved thumbnail, shown inside the summary card. */
  thumb?: string
  /** Full-size photo (data URL); when present it is shown as the hero. */
  photo?: string
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

  const confidences = rows.map((r) => r.base.confidence).filter((c): c is number => c !== undefined)
  const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null

  return (
    <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+104px)]">
      {photo ? <PhotoHero src={photo} alt="Foto de tu comida" onBack={onCancel} /> : <FlowHeader title={title} onBack={onCancel} backLabel="Cancelar" />}

      <div className="px-4">
        <section className={`relative z-10 rounded-card bg-card p-5 shadow-card ${photo ? '-mt-10' : 'mt-2'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {thumb && !photo && (
                <img src={thumb} alt="Foto de la comida" width={56} height={56} className="size-14 shrink-0 rounded-inner object-cover" />
              )}
              {avgConfidence !== null ? <ConfidenceChip value={avgConfidence} withPercent /> : null}
            </div>
            <p className="shrink-0 text-right tabular">
              <span className="text-display font-bold tracking-tight">{formatInt(totals.kcal)}</span>
              <span className="ml-1 text-secondary font-medium text-text-2">kcal</span>
            </p>
          </div>
          {photo && <h1 className="mt-2 text-title font-bold tracking-tight">{title}</h1>}
          <p className={`text-secondary text-text-2 ${photo ? 'mt-0.5' : 'mt-2'}`}>
            {rows.length === 1 ? '1 alimento' : `${rows.length} alimentos`}
            {assumptions.length > 0 ? ' · revisa los supuestos abajo' : ''}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MacroTile label="Proteína" value={totals.protein} dot="bg-protein" />
            <MacroTile label="Carbos" value={totals.carbs} dot="bg-carbs" />
            <MacroTile label="Grasa" value={totals.fat} dot="bg-fat" />
          </div>
        </section>
      </div>

      <SectionTitle>¿En qué comida?</SectionTitle>
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
          {saveLabel ?? `Guardar en ${MEAL_LABELS[meal].toLowerCase()}`} · {formatInt(totals.kcal)} kcal
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
            <p className="flex justify-end gap-2.5 text-label text-text-2 tabular">
              <MacroDot dot="bg-protein" text={`P ${formatInt(item.protein)}`} />
              <MacroDot dot="bg-carbs" text={`C ${formatInt(item.carbs)}`} />
              <MacroDot dot="bg-fat" text={`G ${formatInt(item.fat)}`} />
            </p>
          )}
        </div>
      </div>

      {(confidence !== undefined || row.warning) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {confidence !== undefined && <ConfidenceChip value={confidence} />}
          {row.warning && (
            <span className="rounded-full bg-warning/12 px-2.5 py-1 text-label font-semibold text-warning">Revisa: {row.warning.toLowerCase()}</span>
          )}
        </div>
      )}
    </li>
  )
}

function ConfidenceChip({ value, withPercent = false }: { value: number; withPercent?: boolean }) {
  const [label, cls] =
    value >= 0.75
      ? ['Confianza alta', 'bg-brand/15 text-accent']
      : value >= 0.5
        ? ['Confianza media', 'bg-warning/12 text-warning']
        : ['Confianza baja', 'bg-danger/12 text-danger']
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-semibold ${cls}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {withPercent ? `Confianza ${Math.round(value * 100)}%` : label}
    </span>
  )
}

function MacroTile({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-inner bg-fill px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-label font-medium text-text-2">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-0.5 text-body font-bold tabular">{formatInt(value)} g</p>
    </div>
  )
}

function MacroDot({ dot, text }: { dot: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </span>
  )
}
