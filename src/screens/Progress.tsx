import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, getSettings, retryRead, saveProfile, updateSettings } from '../db/db.ts'
import type { Profile, WeightLog } from '../db/types.ts'
import { IconArrowDown, IconArrowUp, IconCheck, IconChevronLeft, IconChevronRight } from '../components/icons.tsx'
import { MacroBars } from '../components/MacroBars.tsx'
import { WeekKcalChart } from '../components/WeekKcalChart.tsx'
import { WeightChart } from '../components/WeightChart.tsx'
import { WeightSheet } from '../components/WeightSheet.tsx'
import { Button, Card, ScreenHeader, Segmented, TabScreen } from '../components/ui.tsx'
import { addDays, daysBetween, formatLongDate, fromISODate, toISODate } from '../domain/dates.ts'
import { formatInt, formatKg } from '../domain/format.ts'
import { GAIN_PACE_PCT, PACE_MIN_READINGS, PACE_MIN_SPAN_DAYS, PACE_WINDOW_DAYS, gainPace, weekStart, weeklySummary } from '../domain/progress.ts'
import { adjustKcal } from '../domain/targets.ts'
import { pointsInRange, sortByDate, weightTrend } from '../domain/weight.ts'
import { useToday } from '../lib/useToday.ts'

const RANGES = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
] as const
type Range = (typeof RANGES)[number]['value']

export function Progress({ profile }: { profile: Profile }) {
  const today = useToday()
  const weights = useLiveQuery(() => retryRead(async () => sortByDate(await db.weights.toArray())), [])

  return (
    <TabScreen>
      <ScreenHeader title="Progreso" />
      <div className="flex flex-col gap-3 px-4">
        {weights && <WeightCard logs={weights} today={today} profile={profile} />}
        {weights && profile.goal === 'gain_muscle' && <PaceCard weights={weights} today={today} profile={profile} />}
        {weights && <WeeklyCard weights={weights} today={today} profile={profile} />}
      </div>
    </TabScreen>
  )
}

function WeightCard({ logs, today, profile }: { logs: WeightLog[]; today: string; profile: Profile }) {
  const [range, setRange] = useState<Range>('30')
  const [sheetOpen, setSheetOpen] = useState(false)
  const trend = weightTrend(logs)
  const days = Number(range)
  const visible = pointsInRange(trend.points, today, days)
  const change = trend.weeklyChangeKg

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] leading-6 font-bold tracking-tight">Peso</h2>
        <div className="w-44">
          <Segmented label="Rango del gráfico" options={RANGES} value={range} onChange={setRange} />
        </div>
      </div>

      {trend.currentKg === null ? (
        <div className="py-6 text-center">
          <p className="text-body font-semibold">Aún no registras tu peso</p>
          <p className="mt-1 text-secondary text-text-2">Pésate unas veces por semana y aquí verás tu tendencia.</p>
        </div>
      ) : (
        <>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-metric font-bold tracking-tight">{formatKg(trend.currentKg)}</span>
            <span className="text-body font-medium text-text-2">kg</span>
          </p>
          <p className="text-secondary text-text-2">
            Promedio de tus últimos 7 días
            {change !== null && (
              <>
                {' · '}
                <span className="font-semibold text-text">
                  {change > 0 ? '+' : change < 0 ? '−' : '±'}
                  {formatKg(Math.abs(change))} kg
                </span>{' '}
                frente a la semana anterior
              </>
            )}
          </p>

          <div className="mt-6">
            {visible.length > 0 ? (
              <WeightChart points={visible} today={today} days={days} />
            ) : (
              <p className="rounded-inner bg-fill px-4 py-6 text-center text-secondary text-text-2">
                No tienes pesajes en los últimos {days} días.
              </p>
            )}
          </div>
          <p className="mt-2 flex items-center gap-3 text-label text-text-2">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-chart" aria-hidden="true" />
              Promedio de 7 días
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-text-2 opacity-50" aria-hidden="true" />
              Pesaje del día
            </span>
          </p>
        </>
      )}

      <Button variant="secondary" className="mt-4 w-full" onClick={() => setSheetOpen(true)}>
        Registrar peso
      </Button>
      <WeightSheet open={sheetOpen} onClose={() => setSheetOpen(false)} today={today} logs={logs} fallbackKg={profile.weightKg} />
    </Card>
  )
}

const dayMonth = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' })

function weekLabel(start: string, today: string): string {
  const thisWeek = weekStart(today)
  if (start === thisWeek) return 'Esta semana'
  if (start === addDays(thisWeek, -7)) return 'Semana pasada'
  const fmt = (iso: string) => dayMonth.format(fromISODate(iso)).replace('.', '')
  return `${fmt(start)} – ${fmt(addDays(start, 6))}`
}

function WeeklyCard({ weights, today, profile }: { weights: WeightLog[]; today: string; profile: Profile }) {
  const [start, setStart] = useState(() => weekStart(today))
  const end = addDays(start, 6)
  const entries = useLiveQuery(() => retryRead(() => db.entries.where('date').between(start, end, true, true).toArray()), [start, end])
  if (!entries) return null

  const summary = weeklySummary(entries, weights, start, today)
  const { targets } = profile
  // Days that already happened this week (all 7 for a past week).
  const elapsed = summary.isCurrentWeek ? daysBetween(start, today) + 1 : 7
  const avg = summary.average
  const change = summary.weightChangeKg

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[18px] leading-6 font-bold tracking-tight">Resumen semanal</h2>
        <div className="-mr-2 flex items-center">
          <button
            type="button"
            onClick={() => setStart(addDays(start, -7))}
            aria-label="Semana anterior"
            className="flex size-11 items-center justify-center rounded-full text-text active:bg-fill"
          >
            <IconChevronLeft size={20} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setStart(addDays(start, 7))}
            disabled={summary.isCurrentWeek}
            aria-label="Semana siguiente"
            className="flex size-11 items-center justify-center rounded-full text-text active:bg-fill disabled:text-text-2/40"
          >
            <IconChevronRight size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>
      <p className="text-secondary text-text-2" aria-live="polite">
        {weekLabel(start, today)} · {summary.loggedDays} de {elapsed} {elapsed === 1 ? 'día registrado' : 'días registrados'}
      </p>

      {avg ? (
        <>
          <p className="mt-4 flex items-baseline gap-1.5">
            <span className="text-display font-bold tracking-tight">{formatInt(avg.kcal)}</span>
            <span className="text-body font-medium text-text-2">kcal al día</span>
          </p>
          <p className="text-secondary text-text-2">
            Promedio de los días registrados ·{' '}
            <span className="font-semibold text-text">
              {avg.kcal >= targets.kcal ? '+' : '−'}
              {formatInt(Math.abs(avg.kcal - targets.kcal))}
            </span>{' '}
            frente a tu meta
          </p>

          <div className="mt-6">
            <WeekKcalChart days={summary.days} goal={targets.kcal} today={today} />
          </div>

          <div className="mt-4 rounded-inner bg-fill p-4">
            <MacroBars consumed={avg} targets={targets} />
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-inner bg-fill px-4 py-6 text-center text-secondary text-text-2">
          No registraste comidas esta semana.
        </p>
      )}

      <div className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-inner bg-fill px-4 py-2">
        <span className="text-secondary">Peso vs. semana anterior</span>
        <span className="shrink-0 text-secondary tabular">
          {change !== null ? (
            <span className="font-bold">
              {change > 0 ? '+' : change < 0 ? '−' : '±'}
              {formatKg(Math.abs(change))} kg
            </span>
          ) : (
            <span className="text-text-2">Faltan pesajes</span>
          )}
        </span>
      </div>
    </Card>
  )
}

const pctFormat = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })
const pctNum = (n: number) => pctFormat.format(n)
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${pctNum(Math.abs(n))}\u00a0%`

/** After changing the goal from a suggestion, wait this long before suggesting again. */
const PACE_COOLDOWN_DAYS = 14

/** Where the weekly % sits on a −0,25…+0,75 % track, with the ideal band highlighted. */
function PaceGauge({ weeklyPct }: { weeklyPct: number }) {
  const lo = -0.25
  const hi = 0.75
  const at = (v: number) => `${((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100}%`
  return (
    <div className="mt-4" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-fill">
        <div
          className="absolute inset-y-0 rounded-full bg-chart/35"
          style={{ left: at(GAIN_PACE_PCT.min), right: `calc(100% - ${at(GAIN_PACE_PCT.max)})` }}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-card"
          style={{ left: at(weeklyPct) }}
        />
      </div>
      <div className="relative mt-1.5 h-4 text-label text-text-2 tabular">
        <span className="absolute -translate-x-1/2" style={{ left: at(0) }}>0</span>
        <span className="absolute -translate-x-1/2" style={{ left: at(GAIN_PACE_PCT.min) }}>{pctNum(GAIN_PACE_PCT.min)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: at(GAIN_PACE_PCT.max) }}>{pctNum(GAIN_PACE_PCT.max)}&nbsp;%</span>
      </div>
    </div>
  )
}

/** Saves the suggested goal and starts the cooldown. Only runs on the user's tap. */
async function applyPaceGoal(profile: Profile, targets: Profile['targets']): Promise<void> {
  await saveProfile({ ...profile, targets, targetsEdited: true })
  await updateSettings({ paceAdjustedAt: Date.now() })
}

function PaceCard({ weights, today, profile }: { weights: WeightLog[]; today: string; profile: Profile }) {
  const [applied, setApplied] = useState<number | null>(null)
  const settings = useLiveQuery(() => getSettings(), [])
  const pace = gainPace(weights, today)
  const adjustedOn = settings?.paceAdjustedAt ? toISODate(new Date(settings.paceAdjustedAt)) : null
  const coolingDown = adjustedOn !== null && daysBetween(adjustedOn, today) < PACE_COOLDOWN_DAYS

  if (pace.status === 'insufficient') {
    const missing = Math.max(PACE_MIN_READINGS - pace.readings, 0)
    return (
      <Card className="p-5">
        <h2 className="text-[18px] leading-6 font-bold tracking-tight">Ritmo para ganar músculo</h2>
        <p className="mt-2 text-secondary text-text-2">
          Para saber si vas a buen ritmo necesito al menos {PACE_MIN_READINGS} pesajes repartidos en {PACE_MIN_SPAN_DAYS} días. En los
          últimos {PACE_WINDOW_DAYS} días llevas {pace.readings}
          {missing > 0 ? `; te faltan ${missing}.` : ', pero muy juntos: sigue pesándote unos días más.'}
        </p>
      </Card>
    )
  }

  const { status, weeklyKg, weeklyPct, suggestKcal } = pace
  const next = adjustKcal(profile.targets, suggestKcal)
  const head =
    status === 'ok'
      ? { text: 'Vas a buen ritmo', Icon: IconCheck, tone: 'text-accent bg-brand/15' }
      : status === 'slow'
        ? { text: 'Vas más lento de lo ideal', Icon: IconArrowDown, tone: 'text-warning bg-warning/12' }
        : { text: 'Vas más rápido de lo ideal', Icon: IconArrowUp, tone: 'text-warning bg-warning/12' }

  async function apply() {
    await applyPaceGoal(profile, next)
    setApplied(next.kcal)
  }

  return (
    <Card className="p-5">
      <h2 className="text-[18px] leading-6 font-bold tracking-tight">Ritmo para ganar músculo</h2>
      <p className="mt-3 flex items-center gap-2">
        <span className={`flex size-8 items-center justify-center rounded-full ${head.tone}`} aria-hidden="true">
          <head.Icon size={18} strokeWidth={2.4} />
        </span>
        <span className="text-body font-semibold">{head.text}</span>
      </p>
      <p className="mt-2 text-secondary text-text-2">
        Tu tendencia de las últimas 4 semanas es de{' '}
        <span className="font-semibold text-text tabular">
          {weeklyKg > 0 ? '+' : weeklyKg < 0 ? '−' : ''}
          {pctNum(Math.abs(weeklyKg))} kg por semana
        </span>{' '}
        ({pct(weeklyPct)} de tu peso). Para ganar músculo con poca grasa, lo razonable es entre {pct(GAIN_PACE_PCT.min)} y {pct(GAIN_PACE_PCT.max)} por semana.
      </p>
      <PaceGauge weeklyPct={weeklyPct} />

      {status !== 'ok' && applied === null && coolingDown && adjustedOn && (
        <p className="mt-4 rounded-inner bg-fill p-4 text-secondary">
          Ajustaste tu meta el {formatLongDate(adjustedOn)}. El peso tarda en reflejarlo: vuelve a mirar desde el{' '}
          {formatLongDate(addDays(adjustedOn, PACE_COOLDOWN_DAYS))}.
        </p>
      )}
      {status !== 'ok' && applied === null && settings && !coolingDown && (
        <div className="mt-4 rounded-inner bg-fill p-4">
          <p className="text-secondary">
            Podrías {suggestKcal > 0 ? 'subir' : 'bajar'} tu meta a <span className="font-bold tabular">{formatInt(next.kcal)} kcal</span> (
            {suggestKcal > 0 ? '+' : '−'}
            {formatInt(Math.abs(suggestKcal))} al día) y revisar de nuevo en 2 semanas. La proteína se mantiene; grasa y carbohidratos se
            ajustan.
          </p>
          <Button className="mt-3 w-full" onClick={apply}>
            Cambiar meta a {formatInt(next.kcal)} kcal
          </Button>
        </div>
      )}
      {applied !== null && (
        <p className="mt-4 rounded-inner bg-fill p-4 text-secondary" role="status">
          Listo: tu meta ahora es <span className="font-bold tabular">{formatInt(applied)} kcal</span>. Puedes cambiarla cuando quieras en
          Ajustes.
        </p>
      )}
    </Card>
  )
}

