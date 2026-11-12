/**
 * Asks the browser to keep IndexedDB data from being evicted under storage pressure.
 * Safari may still decide on its own; the JSON backup in Ajustes is the real safety net.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
