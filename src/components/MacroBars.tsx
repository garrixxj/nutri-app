import type { Macros } from '../db/types.ts'
import { formatInt } from '../domain/format.ts'

const MACROS = [
  { key: 'protein', label: 'Proteína', fill: 'bg-protein' },
  { key: 'carbs', label: 'Carbos', fill: 'bg-carbs' },
  { key: 'fat', label: 'Grasa', fill: 'bg-fat' },
] as const

/**
 * Three macro progress bars, meant to sit on a `bg-fill` panel (the track is card-colored).
 * The fill animates with transform (scaleX) only.
 */
export function MacroBars({ consumed, targets }: { consumed: Macros; targets: Macros }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {MACROS.map(({ key, label, fill }) => {
        const value = consumed[key]
        const goal = targets[key]
        const ratio = goal > 0 ? Math.min(value / goal, 1) : 0
        return (
          <div key={key} className="min-w-0">
            <p className="truncate text-label font-medium text-text-2">{label}</p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-card"
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={Math.round(goal)}
              aria-valuenow={Math.round(value)}
            >
              <div
                className={`h-full origin-left rounded-full ${fill} transition-transform duration-250 ease-out`}
                style={{ transform: `scaleX(${ratio})` }}
              />
            </div>
            <p className="mt-1.5 text-label text-text-2 tabular">
              <span className={`text-secondary font-bold ${goal > 0 && value > goal ? 'text-danger' : 'text-text'}`}>{formatInt(value)}</span> / {formatInt(goal)} g
            </p>
          </div>
        )
      })}
    </div>
  )
}
