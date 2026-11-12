import { useLiveQuery } from 'dexie-react-hooks'
import { db, retryRead } from '../db/db.ts'
import type { Profile } from '../db/types.ts'
import { addWater, undoLastWater } from '../db/water-store.ts'
import { formatInt } from '../domain/format.ts'
import { WATER_QUICK_ADD_ML, totalWaterMl, waterGoalMl } from '../domain/water.ts'
import { IconDroplet, IconUndo } from './icons.tsx'

/** Water for one day: progress toward the goal, quick adds and undo of the last one. */
export function WaterCard({ date, profile }: { date: string; profile: Profile }) {
  const logs = useLiveQuery(() => retryRead(() => db.water.where('date').equals(date).toArray()), [date])
  const total = totalWaterMl(logs ?? [])
  const goal = waterGoalMl(profile)
  const ratio = goal > 0 ? Math.min(total / goal, 1) : 0
  const reached = total >= goal

  return (
    <section className="rounded-card bg-[color-mix(in_srgb,var(--water)_10%,var(--card))] p-4 shadow-card" aria-label="Agua">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-water" aria-hidden="true">
          <IconDroplet size={24} strokeWidth={2.1} fill={reached ? 'currentColor' : 'none'} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold">Agua</h2>
          <p className="text-secondary text-text-2 tabular">
            <span className="font-semibold text-text">{formatInt(total)}</span> de {formatInt(goal)} ml
            {reached && ' · meta cumplida'}
          </p>
        </div>
        {logs && logs.length > 0 && (
          <button
            type="button"
            onClick={() => void undoLastWater(date)}
            aria-label="Deshacer el último vaso"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 transition-transform duration-150 ease-out active:scale-90"
          >
            <IconUndo size={20} />
          </button>
        )}
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-card"
        role="progressbar"
        aria-label="Agua del día"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={total}
      >
        <div
          className="h-full origin-left rounded-full bg-water transition-transform duration-250 ease-out"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {WATER_QUICK_ADD_ML.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => void addWater(date, ml)}
            className="min-h-11 rounded-full bg-card text-secondary font-semibold text-text shadow-card transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            +{formatInt(ml)} ml
          </button>
        ))}
      </div>
    </section>
  )
}
