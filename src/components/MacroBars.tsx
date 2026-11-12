import type { Macros } from '../db/types.ts'
import { formatInt } from '../domain/format.ts'

const MACROS = [
  { key: 'protein', label: 'Proteína', fill: 'bg-protein', track: 'bg-protein/15' },
  { key: 'carbs', label: 'Carbos', fill: 'bg-carbs', track: 'bg-carbs/15' },
  { key: 'fat', label: 'Grasa', fill: 'bg-fat', track: 'bg-fat/15' },
] as const

/** Three macro progress bars. The fill animates with transform (scaleX) only. */
export function MacroBars({ consumed, targets }: { consumed: Macros; targets: Macros }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {MACROS.map(({ key, label, fill, track }) => {
        const value = consumed[key]
        const goal = targets[key]
        const ratio = goal > 0 ? Math.min(value / goal, 1) : 0
        return (
          <div key={key} className="min-w-0">
            <p className="text-label font-medium text-text-2">{label}</p>
            <div
              className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${track}`}
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
            <p className="mt-1.5 text-secondary tabular">
              <span className="font-semibold">{formatInt(value)}</span>
              <span className="text-text-2"> / {formatInt(goal)} g</span>
            </p>
          </div>
        )
      })}
    </div>
  )
}
