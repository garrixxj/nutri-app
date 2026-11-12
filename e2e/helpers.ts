import { expect, type Page } from '@playwright/test'

/**
 * Seeds IndexedDB with plain IndexedDB calls (no app code), after the app has
 * created the database: a profile plus entries on the last `days` days, today included.
 */
export async function seed(
  page: Page,
  { days, todayKcal, settings }: { days: number; todayKcal: number; settings?: Record<string, unknown> },
) {
  await page.goto('/')
  // Onboarding shows once Dexie has opened (and created) the database.
  await expect(page.getByRole('button').first()).toBeVisible()
  await page.evaluate(
    async ({ days, todayKcal, settings }) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('nutri-app')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      const tx = db.transaction(['profile', 'entries', 'settings'], 'readwrite')
      if (settings) tx.objectStore('settings').put({ id: 'settings', ...settings })
      tx.objectStore('profile').put({
        id: 'me',
        sex: 'male',
        age: 30,
        heightCm: 178,
        weightKg: 78,
        activityLevel: 'moderate',
        goal: 'gain_muscle',
        targets: { kcal: 2100, protein: 150, carbs: 240, fat: 58 },
        targetsEdited: false,
        updatedAt: Date.now(),
      })
      for (let i = 0; i < days; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const kcal = i === 0 ? todayKcal : 1800
        tx.objectStore('entries').put({
          id: `e${i}`,
          date: iso(d),
          meal: 'almuerzo',
          items: [{ name: 'Prueba', grams: 100, kcal, protein: 40, carbs: 10, fat: 5 }],
          source: 'manual',
          createdAt: Date.now() - (i + 1) * 3_600_000,
        })
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
    { days, todayKcal, settings },
  )
  await page.reload()
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

