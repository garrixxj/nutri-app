import { mealName, mealSignature, scaleItems } from '../domain/favorites.ts'
import { newId } from '../lib/id.ts'
import { db } from './db.ts'
import type { Entry, Favorite, Item, Meal } from './types.ts'

/** Saves a logged meal as a favorite. Items are copied, so editing the entry later doesn't change it. */
export async function saveFavoriteFromEntry(entry: Entry): Promise<Favorite> {
  const now = Date.now()
  const fav: Favorite = {
    id: newId(),
    name: mealName(entry.items),
    items: entry.items.map((i) => ({ ...i })),
    meal: entry.meal,
    ...(entry.photoThumb ? { photoThumb: entry.photoThumb } : {}),
    createdAt: now,
    lastUsedAt: now,
    useCount: 0,
  }
  await db.favorites.add(fav)
  return fav
}

/** The favorite holding the same foods as `items`, if any. */
export function findFavorite(favorites: readonly Favorite[], items: readonly Item[]): Favorite | undefined {
  const key = mealSignature(items)
  return favorites.find((f) => mealSignature(f.items) === key)
}

export function deleteFavorite(id: string): Promise<void> {
  return db.favorites.delete(id)
}

export async function renameFavorite(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (trimmed) await db.favorites.update(id, { name: trimmed })
}

/**
 * Logs a saved or frequent meal as a new entry. No AI involved.
 * `favoriteId` bumps that favorite's usage so it sorts first next time.
 */
export async function logSavedMeal({
  items,
  meal,
  date,
  portion,
  photoThumb,
  favoriteId,
}: {
  items: readonly Item[]
  meal: Meal
  date: string
  portion: number
  photoThumb?: string
  favoriteId?: string
}): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.entries, db.favorites, async () => {
    await db.entries.add({
      id: newId(),
      date,
      meal,
      items: scaleItems(items, portion),
      source: 'favorite',
      ...(photoThumb ? { photoThumb } : {}),
      createdAt: now,
    })
    if (favoriteId) {
      const fav = await db.favorites.get(favoriteId)
      if (fav) await db.favorites.update(favoriteId, { lastUsedAt: now, useCount: fav.useCount + 1 })
    }
  })
}
