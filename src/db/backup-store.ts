import { db, getProfile, updateSettings } from './db.ts'
import { serializeBackup, type BackupFile } from './backup.ts'

/** Reads everything that belongs in a backup. Settings (API key) never go in. */
export async function buildBackup(): Promise<BackupFile> {
  const [profile, entries] = await Promise.all([getProfile(), db.entries.orderBy('createdAt').toArray()])
  return serializeBackup(profile ?? null, entries)
}

export function markBackupExported(): Promise<void> {
  return updateSettings({ lastBackupAt: Date.now() })
}

/**
 * Replaces the profile and all entries with the backup's contents.
 * Settings (API key, model) are left untouched.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.profile, db.entries, async () => {
    await db.profile.clear()
    await db.entries.clear()
    if (backup.profile) await db.profile.put(backup.profile)
    await db.entries.bulkPut(backup.entries)
  })
}
