import { useId } from 'react'
import { navigate } from '../app/router.ts'
import type { Meal, Profile } from '../db/types.ts'
import { DayView } from '../components/DayView.tsx'
import { IconChevronLeft, IconChevronRight } from '../components/icons.tsx'
import { Button, ScreenHeader, TabScreen } from '../components/ui.tsx'
import { addDays, formatLongDate, relativeDay } from '../domain/dates.ts'
import { useToday } from '../lib/useToday.ts'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Day-by-day history. The selected day lives in the URL (?d=) so it survives edits and back. */
export function History({
  profile,
  params,
  onRegister,
}: {
  profile: Profile
  params: URLSearchParams
  onRegister: (meal?: Meal, date?: string) => void
}) {
  const today = useToday()
  const raw = params.get('d')
  const date = raw && ISO.test(raw) && raw <= today ? raw : today
  const isToday = date === today
  const pickerId = useId()

  const go = (d: string) => navigate(d >= today ? '/historial' : `/historial?d=${d}`, { replace: true })
  const label = isToday ? 'Hoy' : relativeDay(date, today) === 'ayer' ? 'Ayer' : formatLongDate(date)

  return (
    <TabScreen>
      <ScreenHeader
        title="Historial"
        right={
          !isToday && (
            <Button variant="plain" className="-mr-2 px-2" onClick={() => go(today)}>
              Ir a hoy
            </Button>
          )
        }
      />

      <div className="flex items-center gap-1 px-2 pb-3">
        <button
          type="button"
          onClick={() => go(addDays(date, -1))}
          aria-label="Día anterior"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent active:bg-accent/12"
        >
          <IconChevronLeft size={24} />
        </button>

        <label htmlFor={pickerId} className="relative flex min-h-11 flex-1 flex-col items-center justify-center rounded-button">
          <span className="text-body font-semibold first-letter:uppercase">{label}</span>
          {!isToday && label !== formatLongDate(date) && (
            <span className="text-label text-text-2">{formatLongDate(date)}</span>
          )}
          <input
            id={pickerId}
            type="date"
            value={date}
            max={today}
            onChange={(e) => ISO.test(e.target.value) && go(e.target.value)}
            aria-label="Elegir día"
            className="absolute inset-0 h-full w-full opacity-0"
          />
        </label>

        <button
          type="button"
          onClick={() => go(addDays(date, 1))}
          disabled={isToday}
          aria-label="Día siguiente"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent active:bg-accent/12 disabled:text-text-2/40"
        >
          <IconChevronRight size={24} />
        </button>
      </div>

      <DayView
        date={date}
        profile={profile}
        isToday={isToday}
        onRegister={(meal) => onRegister(meal, isToday ? undefined : date)}
      />
    </TabScreen>
  )
}
