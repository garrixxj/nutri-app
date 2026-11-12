import 'fake-indexeddb/auto'
import { Dexie } from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMA_V1, createDb } from './db.ts'
import { PROFILE_ID, type Entry, type Profile } from './types.ts'

const profile: Profile = {
  id: PROFILE_ID,
  sex: 'male',
  age: 32,
  heightCm: 178,
  weightKg: 80.4,
  activityLevel: 'moderate',
  goal: 'gain_muscle',
  targets: { kcal: 2900, protein: 160, carbs: 390, fat: 80 },
  targetsEdited: false,
  // 2026-11-10 at noon local time.
  updatedAt: new Date(2026, 10, 10, 12).getTime(),
}

const entry: Entry = {
  id: 'e1',
  date: '2026-11-10',
  meal: 'almuerzo',
  items: [{ name: 'Porotos con riendas', grams: 400, kcal: 520, protein: 24, carbs: 80, fat: 10, confidence: 0.8 }],
  source: 'photo',
  photoThumb: 'data:image/jpeg;base64,AAAA',
  createdAt: 1,
}

let n = 0
const names: string[] = []
function freshName(): string {
  const name = `migration-test-${++n}`
  names.push(name)
  return name
}

/** Writes data with the exact v1 schema, as an installed phase-1 app would have it. */
async function seedV1(name: string, withProfile = true): Promise<void> {
  const v1 = new Dexie(name)
  v1.version(1).stores(SCHEMA_V1)
  await v1.open()
  if (withProfile) await v1.table('profile').put(profile)
  await v1.table('entries').put(entry)
  await v1.table('settings').put({ id: 'settings', geminiApiKey: 'k', geminiModel: 'm' })
  v1.close()
}

afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

describe('Dexie v1 → v2 migration', () => {
  it('keeps every v1 row untouched', async () => {
    const name = freshName()
    await seedV1(name)
    const db = createDb(name)
    await db.open()

    expect(db.verno).toBe(2)
    expect(await db.profile.get(PROFILE_ID)).toEqual(profile)
    expect(await db.entries.toArray()).toEqual([entry])
    expect((await db.settings.get('settings'))?.geminiApiKey).toBe('k')
    db.close()
  })

  it('creates the new tables and seeds one weigh-in from the profile', async () => {
    const name = freshName()
    await seedV1(name)
    const db = createDb(name)
    await db.open()

    expect(await db.favorites.count()).toBe(0)
    expect(await db.water.count()).toBe(0)
    expect(await db.weights.toArray()).toEqual([{ date: '2026-11-10', kg: 80.4, createdAt: profile.updatedAt }])
    db.close()
  })

  it('upgrades a database without a profile and seeds no weight', async () => {
    const name = freshName()
    await seedV1(name, false)
    const db = createDb(name)
    await db.open()

    expect(await db.entries.count()).toBe(1)
    expect(await db.weights.count()).toBe(0)
    db.close()
  })

  it('opens a brand-new install directly at v2', async () => {
    const db = createDb(freshName())
    await db.open()
    expect(db.verno).toBe(2)
    expect(db.tables.map((t) => t.name).sort()).toEqual(['entries', 'favorites', 'profile', 'settings', 'water', 'weights'])
    db.close()
  })
})
