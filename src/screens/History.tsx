import { useLiveQuery } from 'dexie-react-hooks'
import { useId } from 'react'
import { navigate } from '../app/router.ts'
import { db } from '../db/db.ts'
import type { Meal, Profile } from '../db/types.ts'
import { DayView } from '../components/DayView.tsx'
import { IconChevronLeft, IconChevronRight } from '../components/icons.tsx'
import { Button, ScreenHeader, TabScreen } from '../components/ui.tsx'
import { addDays, formatLongDate, fromISODate, relativeDay } from '../domain/dates.ts'
import { useToday } from '../lib/useToday.ts'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

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

  // Monday-first week containing the selected day.
  const weekStart = addDays(date, -((fromISODate(date).getDay() + 6) % 7))
  const week = WEEKDAY_LETTERS.map((letter, i) => ({ letter, iso: addDays(weekStart, i) }))
  const weekEnd = addDays(weekStart, 6)
  const loggedDays = useLiveQuery(
    async () => new Set((await db.entries.where('date').between(weekStart, weekEnd, true, true).toArray()).map((e) => e.date)),
    [weekStart, weekEnd],
  )

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

      <div className="px-4 pb-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(addDays(date, -7))}
            aria-label="Semana anterior"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-text active:bg-fill"
          >
            <IconChevronLeft size={22} strokeWidth={2.2} />
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
            onClick={() => go(addDays(date, 7) > today ? today : addDays(date, 7))}
            disabled={weekEnd >= today}
            aria-label="Semana siguiente"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-text active:bg-fill disabled:text-text-2/40"
          >
            <IconChevronRight size={22} strokeWidth={2.2} />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1 rounded-card bg-card p-2 shadow-card" role="group" aria-label="Días de la semana">
          {week.map(({ letter, iso }) => {
            const selected = iso === date
            const future = iso > today
            const logged = loggedDays?.has(iso) ?? false
            return (
              <button
                key={iso}
                type="button"
                disabled={future}
                onClick={() => go(iso)}
                aria-label={formatLongDate(iso)}
                aria-current={selected ? 'date' : undefined}
                className={`flex min-h-17 flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-150 ease-out disabled:opacity-30 ${selected ? 'bg-ink text-on-ink' : iso === today ? 'text-accent' : 'text-text'}`}
              >
                <span className={`text-label font-semibold ${selected ? '' : 'text-text-2'}`}>{letter}</span>
                <span className="text-body font-bold tabular">{fromISODate(iso).getDate()}</span>
                <span
                  className={`size-1.5 rounded-full ${logged ? (selected ? 'bg-on-ink' : 'bg-brand') : 'bg-transparent'}`}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>
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
