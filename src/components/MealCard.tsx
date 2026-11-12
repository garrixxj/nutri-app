import type { Entry, Meal } from '../db/types.ts'
import { formatInt } from '../domain/format.ts'
import { MEAL_LABELS } from '../domain/labels.ts'
import { entryTotals, sumMacros } from '../domain/totals.ts'
import { IconPlus } from './icons.tsx'
import { Card } from './ui.tsx'

export function MealCard({
  meal,
  entries,
  onAdd,
  onOpen,
}: {
  meal: Meal
  entries: Entry[]
  onAdd: () => void
  onOpen: (entry: Entry) => void
}) {
  const total = sumMacros(entries.map(entryTotals))
  const empty = entries.length === 0

  return (
    <Card>
      <div className="flex min-h-14 items-center gap-2 pr-1.5 pl-4">
        <h3 className="flex-1 text-body font-semibold">{MEAL_LABELS[meal]}</h3>
        {!empty && <span className="text-secondary font-medium tabular">{formatInt(total.kcal)} kcal</span>}
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Agregar a ${MEAL_LABELS[meal]}`}
          className="flex size-11 items-center justify-center rounded-full text-accent transition-transform duration-150 ease-out active:scale-90"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-accent/12">
            <IconPlus size={20} strokeWidth={2.4} />
          </span>
        </button>
      </div>

      {!empty && (
        <ul className="border-t border-separator">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-separator last:border-b-0">
              <button
                type="button"
                onClick={() => onOpen(entry)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 ease-out active:bg-text-2/8"
              >
                {entry.photoThumb && (
                  <img src={entry.photoThumb} alt="" width={40} height={40} className="size-10 shrink-0 rounded-[10px] object-cover" />
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
      )}
    </Card>
  )
}
