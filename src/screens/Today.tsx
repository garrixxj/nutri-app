import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db.ts'
import { MEALS, type Entry, type Meal, type Profile } from '../db/types.ts'
import { CalorieRing } from '../components/CalorieRing.tsx'
import { EntrySheet } from '../components/EntrySheet.tsx'
import { MacroBars } from '../components/MacroBars.tsx'
import { MealCard } from '../components/MealCard.tsx'
import { Button, Card, ScreenHeader, TabScreen } from '../components/ui.tsx'
import { formatLongDate } from '../domain/dates.ts'
import { formatInt } from '../domain/format.ts'
import { dayTotals, groupByMeal } from '../domain/totals.ts'
import { useToday } from '../lib/useToday.ts'

export function Today({ profile, onRegister }: { profile: Profile; onRegister: (meal?: Meal) => void }) {
  const today = useToday()
  const entries = useLiveQuery(() => db.entries.where('date').equals(today).sortBy('createdAt'), [today])
  const [openEntry, setOpenEntry] = useState<Entry | null>(null)

  const list = entries ?? []
  const totals = dayTotals(list)
  const byMeal = groupByMeal(list)
  const { targets } = profile

  return (
    <TabScreen>
      <ScreenHeader title="Hoy" eyebrow={formatLongDate(today)} />

      <div className="flex flex-col gap-3 px-4">
        <Card className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-1">
            <Stat label="Consumidas" value={totals.kcal} />
            <CalorieRing consumed={totals.kcal} goal={targets.kcal} />
            <Stat label="Meta" value={targets.kcal} />
          </div>
          <div className="mt-5">
            <MacroBars consumed={totals} targets={targets} />
          </div>
        </Card>

        {entries !== undefined && list.length === 0 && (
          <Card className="px-4 py-5 text-center">
            <p className="text-body font-semibold">Aún no registras nada hoy</p>
            <p className="mt-1 text-secondary text-text-2">Anota tu primera comida y aquí verás cuánto te queda.</p>
            <Button className="mt-4 w-full" onClick={() => onRegister()}>
              Registrar comida
            </Button>
          </Card>
        )}

        {MEALS.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            entries={byMeal[meal]}
            onAdd={() => onRegister(meal)}
            onOpen={setOpenEntry}
          />
        ))}
      </div>

      <EntrySheet entry={openEntry} onClose={() => setOpenEntry(null)} />
    </TabScreen>
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
