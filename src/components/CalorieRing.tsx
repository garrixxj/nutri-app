import { useEffect, useState } from 'react'
import { formatInt } from '../domain/format.ts'

const SIZE = 184
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Remaining-kcal ring. The arc fills as you eat; past the goal it turns red.
 * A hidden <progress> carries the real values for VoiceOver.
 */
export function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const remaining = goal - consumed
  const over = remaining < 0
  const target = goal > 0 ? Math.min(consumed / goal, 1) : 0

  // Start empty and sweep to the value after mount, so the ring animates in.
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  return (
    <div className="relative size-[min(168px,44vw)] shrink-0">
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
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className={`text-display font-bold tracking-tight tabular ${over ? 'text-danger' : ''}`}>
          {formatInt(Math.abs(remaining))}
        </span>
        <span className="text-label font-medium text-text-2">{over ? 'kcal de más' : 'kcal restantes'}</span>
      </div>
    </div>
  )
}
