import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { goBack } from '../app/router.ts'
import { db } from '../db/db.ts'
import { deleteFavorite, logSavedMeal, renameFavorite } from '../db/favorites-store.ts'
import { MEALS, type Favorite, type Item, type Meal } from '../db/types.ts'
import { ChipGroup } from '../components/fields.tsx'
import { IconChevronRight, IconStar } from '../components/icons.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, FlowHeader, MacroDot, Segmented, SectionTitle } from '../components/ui.tsx'
import { addDays, toISODate } from '../domain/dates.ts'
import { frequentMeals, mealSignature, scaleItems, sortFavorites, type FrequentMeal } from '../domain/favorites.ts'
import { formatInt } from '../domain/format.ts'
import { MEAL_EMOJI, MEAL_LABELS } from '../domain/labels.ts'
import { isMeal, mealForHour } from '../domain/meals.ts'
import { sumMacros } from '../domain/totals.ts'

/** How far back "Frecuentes" looks. */
const FREQUENT_WINDOW_DAYS = 60

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m, label: MEAL_LABELS[m] }))
const PORTIONS = [
  { value: '0.5', label: '½' },
  { value: '1', label: '1' },
  { value: '1.5', label: '1½' },
  { value: '2', label: '2' },
] as const
type Portion = (typeof PORTIONS)[number]['value']

/** What the confirm sheet is about to log. */
type Pick =
  | { kind: 'favorite'; favorite: Favorite }
  | { kind: 'frequent'; frequent: FrequentMeal }

function pickItems(p: Pick): Item[] {
  return p.kind === 'favorite' ? p.favorite.items : p.frequent.items
}

export function Favorites({ params }: { params: URLSearchParams }) {
  const [meal] = useState<Meal>(() => {
    const m = params.get('meal')
    return isMeal(m) ? m : mealForHour(new Date().getHours())
  })
  const [date] = useState(() => {
    const d = params.get('date')
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : toISODate(new Date())
  })
  const [pick, setPick] = useState<Pick | null>(null)

  const favorites = useLiveQuery(() => db.favorites.toArray(), [])
  const recent = useLiveQuery(
    () => db.entries.where('date').aboveOrEqual(addDays(toISODate(new Date()), -FREQUENT_WINDOW_DAYS)).toArray(),
    [],
  )

  if (favorites === undefined || recent === undefined) return null

  const saved = sortFavorites(favorites)
  const frequents = frequentMeals(recent, {
    meal,
    excludeKeys: new Set(favorites.map((f) => mealSignature(f.items))),
  })
  const empty = saved.length === 0 && frequents.length === 0

  return (
    <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+32px)]">
      <FlowHeader title="Favoritos" onBack={() => goBack('/')} />

      {empty && (
        <div className="px-4 pt-2">
          <Card className="px-5 py-6 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-fill text-text" aria-hidden="true">
              <IconStar size={26} />
            </span>
            <p className="mt-3 text-body font-semibold">Aún no tienes favoritos</p>
            <p className="mt-1 text-secondary text-text-2">
              Abre una comida que ya registraste y toca «Guardar en favoritos». Lo que repitas seguido también aparecerá aquí.
            </p>
          </Card>
        </div>
      )}

      {saved.length > 0 && (
        <>
          <SectionTitle>Guardados</SectionTitle>
          <MealList>
            {saved.map((f) => (
              <MealRow
                key={f.id}
                name={f.name}
                items={f.items}
                photoThumb={f.photoThumb}
                meal={f.meal}
                detail={f.useCount > 0 ? `Usado ${f.useCount} ${f.useCount === 1 ? 'vez' : 'veces'}` : 'Sin usar aún'}
                onClick={() => setPick({ kind: 'favorite', favorite: f })}
              />
            ))}
          </MealList>
        </>
      )}

      {frequents.length > 0 && (
        <>
          <SectionTitle>Frecuentes</SectionTitle>
          <p className="-mt-1 px-4 pb-2 text-secondary text-text-2">
            Lo que más registraste estos {FREQUENT_WINDOW_DAYS} días. Primero lo que sueles comer en {MEAL_LABELS[meal].toLowerCase()}.
          </p>
          <MealList>
            {frequents.map((f) => (
              <MealRow
                key={f.key}
                name={f.name}
                items={f.items}
                photoThumb={f.photoThumb}
                meal={f.meal}
                detail={`${f.count} veces`}
                onClick={() => setPick({ kind: 'frequent', frequent: f })}
              />
            ))}
          </MealList>
        </>
      )}

      <LogSheet pick={pick} initialMeal={meal} date={date} onClose={() => setPick(null)} />
    </main>
  )
}

function MealList({ children }: { children: ReactNode }) {
  return <ul className="mx-4 divide-y divide-separator overflow-hidden rounded-card bg-card shadow-card">{children}</ul>
}

function MealRow({
  name,
  items,
  photoThumb,
  meal,
  detail,
  onClick,
}: {
  name: string
  items: Item[]
  photoThumb?: string
  meal: Meal
  detail: string
  onClick: () => void
}) {
  const kcal = sumMacros(items).kcal
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out active:bg-text-2/8"
      >
        {photoThumb ? (
          <img src={photoThumb} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-fill text-2xl" aria-hidden="true">
            {MEAL_EMOJI[meal]}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-body font-semibold">{name}</span>
          <span className="mt-0.5 block text-secondary text-text-2 tabular">
            {formatInt(kcal)} kcal · {detail}
          </span>
        </span>
        <IconChevronRight size={20} className="shrink-0 text-text-2" />
      </button>
    </li>
  )
}

function LogSheet({
  pick,
  initialMeal,
  date,
  onClose,
}: {
  pick: Pick | null
  initialMeal: Meal
  date: string
  onClose: () => void
}) {
  // Keep the last pick rendered while the sheet slides out.
  const [shown, setShown] = useState(pick)
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [portion, setPortion] = useState<Portion>('1')
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  if (pick && pick !== shown) {
    setShown(pick)
    setMeal(initialMeal)
    setPortion('1')
    setName(pick.kind === 'favorite' ? pick.favorite.name : pick.frequent.name)
    setConfirmDelete(false)
  }

  const items = shown ? scaleItems(pickItems(shown), Number(portion)) : []
  const totals = sumMacros(items)
  const favorite = shown?.kind === 'favorite' ? shown.favorite : null

  async function log() {
    if (!shown) return
    setSaving(true)
    try {
      if (favorite && name.trim() && name.trim() !== favorite.name) await renameFavorite(favorite.id, name)
      await logSavedMeal({
        items: pickItems(shown),
        meal,
        date,
        portion: Number(portion),
        photoThumb: favorite ? favorite.photoThumb : shown.kind === 'frequent' ? shown.frequent.photoThumb : undefined,
        favoriteId: favorite?.id,
      })
      goBack('/')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!favorite) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteFavorite(favorite.id)
    onClose()
  }

  return (
    <Sheet open={pick !== null} onClose={onClose} title={favorite ? 'Favorito' : 'Comida frecuente'}>
      {shown && (
        <div>
          {favorite ? (
            <label className="block">
              <span className="sr-only">Nombre del favorito</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => favorite && void renameFavorite(favorite.id, name)}
                autoComplete="off"
                enterKeyHint="done"
                className="w-full rounded-inner bg-fill px-4 py-3 text-title font-bold tracking-tight outline-none"
              />
            </label>
          ) : (
            <h2 className="text-title font-bold tracking-tight">{name}</h2>
          )}

          <ul className="mt-3 divide-y divide-separator rounded-inner bg-fill">
            {items.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 text-secondary">
                  {item.name}
                  {item.grams > 0 && <span className="text-text-2"> · {formatInt(item.grams)} g</span>}
                </span>
                <span className="shrink-0 text-secondary text-text-2 tabular">{formatInt(item.kcal)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 px-1 text-label text-text-2 tabular">
            <MacroDot dot="bg-protein" text={`P ${formatInt(totals.protein)} g`} />
            <MacroDot dot="bg-carbs" text={`C ${formatInt(totals.carbs)} g`} />
            <MacroDot dot="bg-fat" text={`G ${formatInt(totals.fat)} g`} />
          </p>

          <p className="mt-5 mb-2 text-secondary font-semibold">Porción</p>
          <Segmented label="Porción" options={PORTIONS} value={portion} onChange={setPortion} />

          <p className="mt-5 mb-2 text-secondary font-semibold">¿En qué comida?</p>
          <div className="-mx-4">
            <ChipGroup label="Comida" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
          </div>

          <Button className="mt-5 w-full" onClick={log} disabled={saving}>
            Agregar a {MEAL_LABELS[meal].toLowerCase()} · {formatInt(totals.kcal)} kcal
          </Button>
          {favorite && (
            <Button variant="plain" className="mt-1 w-full text-danger" onClick={remove}>
              {confirmDelete ? 'Toca de nuevo para quitarlo' : 'Quitar de favoritos'}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  )
}
