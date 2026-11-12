import { expect, test, type Page, type Route } from '@playwright/test'
import { collectErrors, seed } from './helpers.ts'

const ok = {
  candidates: [
    {
      finishReason: 'STOP',
      content: {
        parts: [
          {
            text: JSON.stringify({
              items: [{ name: 'Marraqueta con palta', grams: 150, kcal: 380, protein: 9, carbs: 50, fat: 16, confidence: 0.8 }],
              assumptions: [],
            }),
          },
        ],
      },
    },
  ],
}

/** Answers generateContent per model with the given status (200 = a real analysis). Counts calls. */
async function mockGemini(page: Page, statusFor: (model: string) => number): Promise<string[]> {
  const calls: string[] = []
  await page.route('https://generativelanguage.googleapis.com/**', async (route: Route) => {
    const url = route.request().url()
    const model = url.split('/models/')[1]?.split(':')[0] ?? ''
    calls.push(model)
    const status = statusFor(model)
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(status === 200 ? ok : { error: { code: status, message: `Simulated ${status} for ${model}` } }),
    })
  })
  return calls
}

async function describeMeal(page: Page) {
  await page.goto('/#/registrar/describir')
  await page.locator('textarea').fill('marraqueta con palta')
  await page.getByRole('button', { name: 'Analizar' }).click()
}

// Old settings with the single gemini-flash-latest model: the app must migrate them to the chain.
const legacySettings = { geminiApiKey: 'test-key', geminiModel: 'gemini-flash-latest' }

test('falls back down the chain and says which model analyzed', async ({ page }) => {
  const errors = collectErrors(page)
  await seed(page, { days: 1, todayKcal: 500, settings: legacySettings })
  const calls = await mockGemini(page, (m) => (m === 'gemini-3.5-flash-lite' ? 200 : 503))
  await describeMeal(page)

  await expect(page.getByText('Analizado con gemini-3.5-flash-lite')).toBeVisible()
  expect(calls).toEqual(['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'])
  // The simulated 503s are logged by the browser itself; anything else is a real error.
  expect(errors.filter((e) => !e.startsWith('Failed to load resource'))).toEqual([])
})

test('when every model fails, shows the technical detail per model without the key', async ({ page }) => {
  await seed(page, { days: 1, todayKcal: 500, settings: legacySettings })
  await mockGemini(page, (m) => (m.includes('lite') ? 429 : 503))
  await describeMeal(page)

  await expect(page.getByText('No pude analizar tu comida')).toBeVisible()
  await page.getByText('Ver detalle técnico').click()
  for (const model of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']) {
    await expect(page.getByText(model, { exact: true })).toBeVisible()
  }
  await expect(page.getByText('HTTP 503: Simulated 503 for gemini-3.6-flash')).toBeVisible()
  await expect(page.getByText('HTTP 429: Simulated 429 for gemini-3.1-flash-lite')).toBeVisible()
  await expect(page.getByText('test-key')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/ai-error-detail.png', fullPage: true })
})

test('Ajustes shows the migrated chain and verifies a new key with Google', async ({ page }) => {
  await seed(page, { days: 1, todayKcal: 500, settings: legacySettings })
  await page.route('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'API key not valid.' } }) }),
  )
  await page.goto('/#/ajustes')
  await expect(page.getByLabel('Modelos, en orden')).toHaveValue(
    'gemini-3.6-flash\ngemini-3.5-flash\ngemini-3.5-flash-lite\ngemini-3.1-flash-lite',
  )
  // A key with the new "AQ." format is not rejected by format, only by Google's answer.
  await page.getByLabel('API key').fill('AQ.' + 'x'.repeat(50))
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Google rechazó esta key y no la guardé. Detalle: HTTP 400: API key not valid.')).toBeVisible()
  await page.screenshot({ path: 'test-results/ai-settings.png', fullPage: true })
})
