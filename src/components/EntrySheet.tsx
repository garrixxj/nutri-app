import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { navigate } from '../app/router.ts'
import { db } from '../db/db.ts'
import { deleteFavorite, findFavorite, saveFavoriteFromEntry } from '../db/favorites-store.ts'
import type { Entry, EntrySource } from '../db/types.ts'
import { formatTime } from '../domain/dates.ts'
import { formatInt } from '../domain/format.ts'
import { MEAL_LABELS } from '../domain/labels.ts'
import { entryTotals } from '../domain/totals.ts'
import { IconEdit, IconStar, IconTrash } from './icons.tsx'
import { Sheet } from './Sheet.tsx'
import { Button, MacroDot } from './ui.tsx'

const SOURCE_LABELS: Record<EntrySource, string> = {
  photo: 'Foto',
  text: 'Descripción',
  barcode: 'Código de barras',
  manual: 'Manual',
  favorite: 'Favorito',
}

/** Read-only detail of an entry, with delete (two taps, no browser dialog). */
export function EntrySheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  // Keep the last entry rendered while the sheet slides out.
  const [shown, setShown] = useState(entry)
  if (entry && entry !== shown) setShown(entry)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!entry) return
    return () => setConfirming(false)
  }, [entry])

  async function remove() {
    if (!shown) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    await db.entries.delete(shown.id)
    onClose()
  }

  const totals = shown ? entryTotals(shown) : null
  const favorites = useLiveQuery(() => db.favorites.toArray(), [])
  const favorite = shown && favorites ? findFavorite(favorites, shown.items) : undefined

  async function toggleFavorite() {
    if (!shown || !favorites) return
    if (favorite) await deleteFavorite(favorite.id)
    else await saveFavoriteFromEntry(shown)
  }

  return (
    <Sheet open={entry !== null} onClose={onClose} title={shown ? MEAL_LABELS[shown.meal] : 'Comida'}>
      {shown && totals && (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-title font-bold">{MEAL_LABELS[shown.meal]}</h2>
            <span className="text-secondary text-text-2">
              {formatTime(shown.createdAt)} · {SOURCE_LABELS[shown.source]}
            </span>
          </div>

          {shown.photoThumb && (
            <img
              src={shown.photoThumb}
              alt={`Foto de ${MEAL_LABELS[shown.meal].toLowerCase()}`}
              width={96}
              height={96}
              className="mt-3 size-24 rounded-inner object-cover"
            />
          )}

          <ul className="mt-3 divide-y divide-separator rounded-inner bg-fill">
            {shown.items.map((item, i) => (
              <li key={i} className="px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 text-body">{item.name}</span>
                  <span className="text-body font-semibold tabular">{formatInt(item.kcal)} kcal</span>
                </div>
                <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-label text-text-2 tabular">
                  {item.grams > 0 && <span>{formatInt(item.grams)} g</span>}
                  <MacroDot dot="bg-protein" text={`P ${formatInt(item.protein)}`} />
                  <MacroDot dot="bg-carbs" text={`C ${formatInt(item.carbs)}`} />
                  <MacroDot dot="bg-fat" text={`G ${formatInt(item.fat)}`} />
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex justify-between px-1 text-secondary tabular">
            <span className="font-semibold">Total {formatInt(totals.kcal)} kcal</span>
            <span className="text-text-2">
              P {formatInt(totals.protein)} · C {formatInt(totals.carbs)} · G {formatInt(totals.fat)}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={toggleFavorite}
              disabled={favorites === undefined}
              aria-pressed={favorite !== undefined}
            >
              <IconStar size={20} fill={favorite ? 'currentColor' : 'none'} className={favorite ? 'text-warning' : ''} />
              {favorite ? 'En favoritos' : 'Guardar en favoritos'}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                onClose()
                navigate(`/editar?id=${encodeURIComponent(shown.id)}`)
              }}
            >
              <IconEdit size={20} />
              Editar
            </Button>
            <Button variant="danger" className="w-full" onClick={remove}>
              <IconTrash size={20} />
              {confirming ? 'Toca de nuevo para eliminar' : 'Eliminar comida'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
