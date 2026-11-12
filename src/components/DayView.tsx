import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db.ts'
import { MEALS, type Entry, type Meal, type Profile } from '../db/types.ts'
import { formatInt } from '../domain/format.ts'
import { dayTotals, groupByMeal } from '../domain/totals.ts'
import { CalorieRing } from './CalorieRing.tsx'
import { EntrySheet } from './EntrySheet.tsx'
import { MacroBars } from './MacroBars.tsx'
import { MealCard, MealSheet } from './MealCard.tsx'
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
  const [openMeal, setOpenMeal] = useState<Meal | null>(null)

  const list = entries ?? []
  const totals = dayTotals(list)
  const byMeal = groupByMeal(list)
  const { targets } = profile

  const remaining = targets.kcal - totals.kcal
  const over = remaining < 0
  const loggedMeals = MEALS.filter((m) => byMeal[m].length > 0).length

  function openMealCard(meal: Meal) {
    const mealEntries = byMeal[meal]
    // One entry: straight to its detail. Several: list them first.
    const [first] = mealEntries
    if (mealEntries.length === 1 && first) setOpenEntry(first)
    else setOpenMeal(meal)
  }

  return (
    <div className="flex flex-col gap-3 px-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-secondary font-medium text-text-2">{over ? 'Te pasaste por' : 'Te quedan'}</p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className={`text-metric font-bold tracking-tight tabular ${over ? 'text-danger' : ''}`}>
                {formatInt(Math.abs(remaining))}
              </span>
              <span className="text-body font-medium text-text-2">kcal</span>
            </p>
            <p className="mt-1 text-secondary text-text-2 tabular">
              <span className="font-semibold text-text">{formatInt(totals.kcal)}</span> de {formatInt(targets.kcal)} consumidas
            </p>
          </div>
          <CalorieRing key={date} consumed={totals.kcal} goal={targets.kcal} />
        </div>
        <div className="mt-5 rounded-inner bg-fill p-4">
          <MacroBars consumed={totals} targets={targets} />
        </div>
      </Card>

      {entries !== undefined && list.length === 0 && (
        <Card className="px-5 py-5 text-center">
          <p className="text-body font-semibold">{isToday ? 'Aún no registras nada hoy' : 'No registraste nada este día'}</p>
          <p className="mt-1 text-secondary text-text-2">
            {isToday ? 'Anota tu primera comida y aquí verás cuánto te queda.' : 'Si se te olvidó, puedes agregarlo ahora.'}
          </p>
          <Button className="mt-4 w-full" onClick={() => onRegister()}>
            Registrar comida
          </Button>
        </Card>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <h2 className="text-[18px] leading-6 font-bold tracking-tight">Comidas</h2>
        <span className="rounded-full bg-fill px-3 py-1 text-label font-semibold text-text-2 tabular">
          {loggedMeals} de {MEALS.length} registradas
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MEALS.map((meal, i) => (
          <MealCard
            key={meal}
            meal={meal}
            entries={byMeal[meal]}
            onAdd={() => onRegister(meal)}
            onOpen={() => openMealCard(meal)}
            wide={MEALS.length % 2 === 1 && i === MEALS.length - 1}
          />
        ))}
      </div>

      <MealSheet
        meal={openMeal}
        entries={openMeal ? byMeal[openMeal] : []}
        onClose={() => setOpenMeal(null)}
        onPick={(entry) => {
          setOpenMeal(null)
          setOpenEntry(entry)
        }}
        onAdd={() => {
          const meal = openMeal
          setOpenMeal(null)
          if (meal) onRegister(meal)
        }}
      />
      <EntrySheet entry={openEntry} onClose={() => setOpenEntry(null)} />
    </div>
  )
}
