import { db, getProfile, updateSettings } from './db.ts'
import { serializeBackup, type BackupFile } from './backup.ts'

/** Reads everything that belongs in a backup and records the export time. */
export async function exportBackup(): Promise<BackupFile> {
  const [profile, entries] = await Promise.all([getProfile(), db.entries.orderBy('createdAt').toArray()])
  const backup = serializeBackup(profile ?? null, entries)
  await updateSettings({ lastBackupAt: Date.now() })
  return backup
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
