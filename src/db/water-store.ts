import { newId } from '../lib/id.ts'
import { db } from './db.ts'

export function addWater(date: string, ml: number): Promise<string> {
  return db.water.add({ id: newId(), date, ml, createdAt: Date.now() })
}

/** Removes the most recent intake of that day. */
export async function undoLastWater(date: string): Promise<void> {
  const last = await db.water.where('date').equals(date).sortBy('createdAt')
  const latest = last[last.length - 1]
  if (latest) await db.water.delete(latest.id)
}
