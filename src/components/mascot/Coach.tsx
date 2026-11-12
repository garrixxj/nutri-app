import { streakLabel } from '../../domain/mascot.ts'
import { Koala } from './Koala.tsx'
import type { KoalaState } from './states.ts'

/** Speech bubble; `tail` points toward the koala. */
export function CoachBubble({ message, tail = 'right', className = '' }: { message: string; tail?: 'right' | 'left'; className?: string }) {
  return (
    <div className={`relative rounded-inner bg-card px-4 py-3 shadow-card ${className}`}>
      <p aria-live="polite" className="text-secondary font-medium text-pretty">
        {message}
      </p>
      <span
        aria-hidden="true"
        className={`absolute bottom-5 size-3.5 rotate-45 rounded-[3px] bg-card ${tail === 'right' ? '-right-1.5' : '-left-1.5'}`}
      />
    </div>
  )
}

export function StreakChip({ streak }: { streak: number }) {
  if (streak <= 0) return null
  return (
    <span className="mb-1 shrink-0 rounded-full bg-fill px-3 py-1 text-label font-semibold text-text-2 tabular">{streakLabel(streak)}</span>
  )
}

/** Tappable koala; tapping makes it greet. */
export function KoalaButton({
  state,
  still,
  size,
  onTap,
  className = '',
}: {
  state: KoalaState
  still: boolean
  size: number
  onTap: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label="Koala entrenador, tócalo para que te salude"
      onClick={onTap}
      className={`shrink-0 rounded-inner transition-transform duration-150 ease-out active:scale-95 ${className}`}
    >
      <Koala state={state} size={size} still={still} />
    </button>
  )
}

/**
 * Koala peeking from behind the top edge of the next card (the calorie card), right above
 * the ring, with the bubble to its left. The card must sit above it (relative z-[1]).
 */
export function CoachPeek({ state, still, message, onTap }: { state: KoalaState; still: boolean; message: string; onTap: () => void }) {
  return (
    <div className="-mb-8 flex items-end gap-1">
      <CoachBubble message={message} className="mb-[52px] min-w-0 flex-1" />
      <KoalaButton state={state} still={still} size={136} onTap={onTap} className="mr-[19px]" />
    </div>
  )
}
