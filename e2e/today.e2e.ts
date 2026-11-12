import { expect, test, type Page } from '@playwright/test'

/**
 * Seeds IndexedDB with plain IndexedDB calls (no app code), after the app has
 * created the database: a profile plus entries on the last `days` days, today included.
 */
async function seed(page: Page, { days, todayKcal }: { days: number; todayKcal: number }) {
  await page.goto('/')
  // Onboarding shows once Dexie has opened (and created) the database.
  await expect(page.getByRole('button').first()).toBeVisible()
  await page.evaluate(
    async ({ days, todayKcal }) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('nutri-app')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      const tx = db.transaction(['profile', 'entries'], 'readwrite')
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
    { days, todayKcal },
  )
  await page.reload()
}

/**
 * Simulates the iPhone bug: Safari on iOS can fail any IndexedDB cursor with
 * "UnknownError: Unable to open cursor". Desktop WebKit doesn't, so we force it.
 */
async function failCursorsLikeIos(page: Page) {
  await page.addInitScript(() => {
    const fail = () => {
      throw new DOMException('Unable to open cursor', 'UnknownError')
    }
    for (const proto of [IDBIndex.prototype, IDBObjectStore.prototype]) {
      Object.defineProperty(proto, 'openCursor', { value: fail, configurable: true })
      Object.defineProperty(proto, 'openKeyCursor', { value: fail, configurable: true })
    }
  })
}

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

test('Hoy shows the koala and the streak without errors', async ({ page }) => {
  const errors = collectErrors(page)
  await failCursorsLikeIos(page)
  await seed(page, { days: 5, todayKcal: 700 })

  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()
  await expect(page.getByText('Racha de 5 días', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Koala entrenador/ })).toBeVisible()
  await expect(page.getByText(/tuvo un error/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the streak waits for today and the koala sleeps with nothing logged', async ({ page }) => {
  const errors = collectErrors(page)
  await failCursorsLikeIos(page)
  await seed(page, { days: 4, todayKcal: 0 })
  // Remove today's entry: the streak should still count up to yesterday.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('nutri-app')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const tx = db.transaction('entries', 'readwrite')
    tx.objectStore('entries').delete('e0')
    await new Promise((resolve) => (tx.oncomplete = resolve))
    db.close()
  })
  await page.reload()

  await expect(page.getByText('Racha de 3 días', { exact: true })).toBeVisible()
  await expect(page.locator('svg.koala')).toHaveAttribute('data-state', /sleep|cheer/)
  await expect(page.getByText(/tuvo un error/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a read that fails once with UnknownError recovers by reopening the database', async ({ page }) => {
  const errors = collectErrors(page)
  await seed(page, { days: 3, todayKcal: 700 })
  // The first index read after load fails like Safari does; the next ones work.
  await page.addInitScript(() => {
    const getAll = IDBIndex.prototype.getAll
    const close = IDBDatabase.prototype.close
    IDBDatabase.prototype.close = function () {
      ;(window as unknown as { dbCloses: number }).dbCloses = ((window as unknown as { dbCloses?: number }).dbCloses ?? 0) + 1
      return close.apply(this)
    }
    let failed = false
    IDBIndex.prototype.getAll = function (...args: Parameters<IDBIndex['getAll']>) {
      if (!failed) {
        failed = true
        throw new DOMException('Unable to open cursor', 'UnknownError')
      }
      return getAll.apply(this, args)
    }
  })
  await page.reload()

  await expect(page.getByText('Racha de 3 días', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Koala entrenador/ })).toBeVisible()
  await expect(page.getByText('Prueba').first()).toBeVisible()
  await expect(page.getByText(/tuvo un error/)).toHaveCount(0)
  // It recovered by closing and reopening the database, not by luck.
  expect(await page.evaluate(() => (window as unknown as { dbCloses?: number }).dbCloses ?? 0)).toBeGreaterThanOrEqual(1)
  expect(errors).toEqual([])
})
