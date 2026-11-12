import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_CHAIN } from '../ai/models.ts'
import { db, getSettings, migrateModelSettings } from './db.ts'
import { SETTINGS_ID } from './types.ts'

describe('model settings migration', () => {
  afterEach(() => db.settings.clear())

  it('turns the old gemini-flash-latest into the new chain and stores it once', async () => {
    await db.settings.put({ id: SETTINGS_ID, geminiApiKey: 'k', geminiModel: 'gemini-flash-latest', aiUsageCount: 3 })
    expect((await getSettings()).geminiModels).toEqual([...DEFAULT_MODEL_CHAIN])

    await migrateModelSettings()
    const stored = await db.settings.get(SETTINGS_ID)
    expect(stored?.geminiModels).toEqual([...DEFAULT_MODEL_CHAIN])
    expect(stored).not.toHaveProperty('geminiModel')
    expect(stored?.geminiApiKey).toBe('k')
    expect(stored?.aiUsageCount).toBe(3)
  })

  it('gives fresh installs the default chain', async () => {
    expect((await getSettings()).geminiModels).toEqual([...DEFAULT_MODEL_CHAIN])
  })
})
