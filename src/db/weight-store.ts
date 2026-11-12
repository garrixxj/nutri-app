import { db } from './db.ts'
import { PROFILE_ID } from './types.ts'

/**
 * Saves the weigh-in of a day (replacing that day's previous one). When it is the
 * latest weigh-in, the profile weight follows it; targets are never touched here.
 */
export async function logWeight(date: string, kg: number): Promise<void> {
  await db.transaction('rw', db.weights, db.profile, async () => {
    const existing = await db.weights.get(date)
    await db.weights.put({ date, kg, createdAt: existing?.createdAt ?? Date.now() })
    const latest = await db.weights.orderBy('date').last()
    if (latest?.date === date) await db.profile.update(PROFILE_ID, { weightKg: kg, updatedAt: Date.now() })
  })
}

export function deleteWeight(date: string): Promise<void> {
  return db.weights.delete(date)
}
