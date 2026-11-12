import { backupFileName, type BackupFile } from '../db/backup.ts'

export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Hands the backup to the iOS share sheet ("Guardar en Archivos", AirDrop, etc.).
 * Falls back to a regular download where file sharing isn't supported.
 */
export async function shareOrDownloadBackup(backup: BackupFile): Promise<ExportResult> {
  const name = backupFileName()
  const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Respaldo de Nutri' })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Any other share failure: fall back to a download.
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
