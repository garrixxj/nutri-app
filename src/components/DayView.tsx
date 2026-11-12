import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db.ts'
import { MEALS, type Entry, type Meal, type Profile } from '../db/types.ts'
import { formatInt } from '../domain/format.ts'
import { dayTotals, groupByMeal } from '../domain/totals.ts'
import { CalorieRing } from './CalorieRing.tsx'
import { EntrySheet } from './EntrySheet.tsx'
import { MacroBars } from './MacroBars.tsx'
import { MealCard } from './MealCard.tsx'
import { Button, Card } from './ui.tsx'

/** One day's summary (ring + macros) and its meals. Shared by Hoy and Historial. */
export function DayView({
  date,
  profile,
  isToday,
  onRegister,
}: {
  date: string
  profile: Profile
  isToday: boolean
  onRegister: (meal?: Meal) => void
}) {
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date])
  const [openEntry, setOpenEntry] = useState<Entry | null>(null)

  const list = entries ?? []
  const totals = dayTotals(list)
  const byMeal = groupByMeal(list)
  const { targets } = profile

  return (
    <div className="flex flex-col gap-3 px-4">
      <Card className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-1">
          <Stat label="Consumidas" value={totals.kcal} />
          <CalorieRing key={date} consumed={totals.kcal} goal={targets.kcal} />
          <Stat label="Meta" value={targets.kcal} />
        </div>
        <div className="mt-5">
          <MacroBars consumed={totals} targets={targets} />
        </div>
      </Card>

      {entries !== undefined && list.length === 0 && (
        <Card className="px-4 py-5 text-center">
          <p className="text-body font-semibold">{isToday ? 'Aún no registras nada hoy' : 'No registraste nada este día'}</p>
          <p className="mt-1 text-secondary text-text-2">
            {isToday ? 'Anota tu primera comida y aquí verás cuánto te queda.' : 'Si se te olvidó, puedes agregarlo ahora.'}
          </p>
          <Button className="mt-4 w-full" onClick={() => onRegister()}>
            Registrar comida
          </Button>
        </Card>
      )}

      {MEALS.map((meal) => (
        <MealCard key={meal} meal={meal} entries={byMeal[meal]} onAdd={() => onRegister(meal)} onOpen={setOpenEntry} />
      ))}

      <EntrySheet entry={openEntry} onClose={() => setOpenEntry(null)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-body font-semibold tabular">{formatInt(value)}</p>
      <p className="text-label text-text-2">{label}</p>
    </div>
  )
}
