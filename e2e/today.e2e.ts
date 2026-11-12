import { expect, test, type Page } from '@playwright/test'
import { collectErrors, seed } from './helpers.ts'

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
