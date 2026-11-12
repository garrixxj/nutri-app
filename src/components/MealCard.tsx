import type { Entry, Meal } from '../db/types.ts'
import { formatInt } from '../domain/format.ts'
import { MEAL_EMOJI, MEAL_LABELS } from '../domain/labels.ts'
import { entryTotals, sumMacros } from '../domain/totals.ts'
import { IconPlus } from './icons.tsx'
import { Sheet } from './Sheet.tsx'
import { Button } from './ui.tsx'

function itemNames(entries: Entry[]): string {
  return entries.flatMap((e) => e.items.map((i) => i.name)).join(', ')
}

/** Compact meal tile for the 2-column grid on Hoy / Historial. */
export function MealCard({
  meal,
  entries,
  onAdd,
  onOpen,
  wide = false,
}: {
  meal: Meal
  entries: Entry[]
  onAdd: () => void
  onOpen: () => void
  wide?: boolean
}) {
  const total = sumMacros(entries.map(entryTotals))
  const empty = entries.length === 0
  const thumb = entries.find((e) => e.photoThumb)?.photoThumb
  const label = MEAL_LABELS[meal]

  return (
    <section className={`relative rounded-card bg-card shadow-card ${wide ? 'col-span-2' : ''}`}>
      {/* The whole tile opens the meal; the + button sits on top of it. */}
      <button
        type="button"
        onClick={empty ? onAdd : onOpen}
        aria-label={empty ? `Agregar a ${label}` : `Ver ${label}, ${formatInt(total.kcal)} kcal`}
        className={`flex size-full gap-3 p-4 text-left ${wide ? 'flex-row items-center pr-14' : 'flex-col items-start'} transition-transform duration-150 ease-out active:scale-[0.98]`}
      >
        {thumb ? (
          <img src={thumb} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-fill text-2xl" aria-hidden="true">
            {MEAL_EMOJI[meal]}
          </span>
        )}
        <span className="block w-full min-w-0">
          <span className="block text-label font-semibold tracking-wide text-text-2 uppercase">{label}</span>
          <span className={`mt-0.5 line-clamp-2 block text-body font-semibold ${empty ? 'text-text-2' : ''}`}>
            {empty ? 'Sin registrar' : itemNames(entries)}
          </span>
          {!empty && <span className="mt-0.5 block text-secondary text-text-2 tabular">{formatInt(total.kcal)} kcal</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Agregar a ${label}`}
        className="absolute top-2.5 right-2.5 flex size-11 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-fill text-text">
          <IconPlus size={18} strokeWidth={2.4} />
        </span>
      </button>
    </section>
  )
}

/** Lists one meal's entries; tapping one opens its detail. */
export function MealSheet({
  meal,
  entries,
  onClose,
  onPick,
  onAdd,
}: {
  meal: Meal | null
  entries: Entry[]
  onClose: () => void
  onPick: (entry: Entry) => void
  onAdd: () => void
}) {
  const title = meal ? MEAL_LABELS[meal] : 'Comida'
  return (
    <Sheet open={meal !== null} onClose={onClose} title={title} showTitle>
      <ul className="divide-y divide-separator overflow-hidden rounded-inner bg-fill">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onPick(entry)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out active:bg-text-2/8"
            >
              {entry.photoThumb && (
                <img src={entry.photoThumb} alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl object-cover" />
              )}
              <span className="min-w-0 flex-1">
                {entry.items.map((item, i) => (
                  <span key={i} className="flex items-baseline gap-2 py-0.5">
                    <span className="min-w-0 flex-1 truncate text-secondary">
                      {item.name}
                      {item.grams > 0 && <span className="text-text-2"> · {formatInt(item.grams)} g</span>}
                    </span>
                    <span className="shrink-0 text-secondary text-text-2 tabular">{formatInt(item.kcal)}</span>
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" className="mt-3 w-full" onClick={onAdd}>
        <IconPlus size={20} strokeWidth={2.4} />
        Agregar a {title.toLowerCase()}
      </Button>
    </Sheet>
  )
}
