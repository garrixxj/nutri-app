import { useEffect, useState, type ReactNode } from 'react'
import { formatInt } from '../domain/format.ts'

const SIZE = 120
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Consumed-kcal ring with the percentage in the middle. The arc fills as you eat;
 * past the goal it turns red. A hidden <progress> carries the real values for VoiceOver.
 */
export function CalorieRing({ consumed, goal, center }: { consumed: number; goal: number; center?: ReactNode }) {
  const over = consumed > goal
  const target = goal > 0 ? Math.min(consumed / goal, 1) : 0
  const percent = goal > 0 ? Math.round((consumed / goal) * 100) : 0

  // Start empty and sweep to the value after mount, so the ring animates in.
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  return (
    <div className="relative size-[min(116px,30vw)] shrink-0">
      <progress
        className="sr-only"
        value={Math.round(consumed)}
        max={Math.round(goal)}
        aria-label={`${formatInt(consumed)} de ${formatInt(goal)} kcal consumidas`}
      />
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90" aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-fill" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className={`transition-[stroke-dashoffset,stroke] duration-250 ease-out ${over ? 'stroke-danger' : 'stroke-brand'} ${progress === 0 ? 'opacity-0' : ''}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden={center ? undefined : true}>
        {center ?? (
          <>
            <span className={`text-title font-bold tabular ${over ? 'text-danger' : ''}`}>{percent}%</span>
            <span className="text-label font-medium text-text-2">de la meta</span>
          </>
        )}
      </div>
    </div>
  )
}
