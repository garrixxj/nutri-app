import { db, getProfile, updateSettings } from './db.ts'
import { sortByDate } from '../domain/weight.ts'
import { serializeBackup, type BackupData, type BackupFile } from './backup.ts'

/** Reads everything that belongs in a backup. Settings (API key) never go in. */
export async function buildBackup(): Promise<BackupFile> {
  const [profile, entries, favorites, weights, water] = await Promise.all([
    getProfile(),
    db.entries.toArray().then((rows) => rows.sort((a, b) => a.createdAt - b.createdAt)),
    db.favorites.toArray(),
    db.weights.toArray().then(sortByDate),
    db.water.toArray(),
  ])
  return serializeBackup({ profile: profile ?? null, entries, favorites, weights, water })
}

export function markBackupExported(): Promise<void> {
  return updateSettings({ lastBackupAt: Date.now() })
}

/**
 * Replaces the profile, entries, favorites, weigh-ins and water with the backup's
 * contents (an old v1 backup leaves the last three empty). Settings (API key, model)
 * are left untouched.
 */
export async function restoreBackup(backup: BackupData): Promise<void> {
  await db.transaction('rw', [db.profile, db.entries, db.favorites, db.weights, db.water], async () => {
    await Promise.all([db.profile.clear(), db.entries.clear(), db.favorites.clear(), db.weights.clear(), db.water.clear()])
    if (backup.profile) await db.profile.put(backup.profile)
    await db.entries.bulkPut(backup.entries)
    await db.favorites.bulkPut(backup.favorites)
    await db.weights.bulkPut(backup.weights)
    await db.water.bulkPut(backup.water)
  })
}
