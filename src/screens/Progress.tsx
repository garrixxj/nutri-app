import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db.ts'
import type { Profile, WeightLog } from '../db/types.ts'
import { WeightChart } from '../components/WeightChart.tsx'
import { WeightSheet } from '../components/WeightSheet.tsx'
import { Button, Card, ScreenHeader, Segmented, TabScreen } from '../components/ui.tsx'
import { formatKg } from '../domain/format.ts'
import { pointsInRange, weightTrend } from '../domain/weight.ts'
import { useToday } from '../lib/useToday.ts'

const RANGES = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
] as const
type Range = (typeof RANGES)[number]['value']

export function Progress({ profile }: { profile: Profile }) {
  const today = useToday()
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])

  return (
    <TabScreen>
      <ScreenHeader title="Progreso" />
      <div className="flex flex-col gap-3 px-4">{weights && <WeightCard logs={weights} today={today} profile={profile} />}</div>
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
