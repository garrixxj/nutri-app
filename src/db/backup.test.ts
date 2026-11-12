import { describe, expect, it } from 'vitest'
import { BackupError, backupFileName, parseBackup, serializeBackup, type BackupData } from './backup.ts'
import type { Entry, Favorite, Profile, WaterLog, WeightLog } from './types.ts'

const profile: Profile = {
  id: 'me',
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'moderate',
  goal: 'maintain',
  targets: { kcal: 2633, protein: 150, carbs: 344, fat: 73 },
  targetsEdited: false,
  updatedAt: 1,
}

const entry: Entry = {
  id: 'a1',
  date: '2026-11-12',
  meal: 'once',
  source: 'text',
  createdAt: 2,
  items: [{ name: 'Marraqueta con palta', grams: 150, kcal: 380, protein: 9, carbs: 50, fat: 16, confidence: 0.8 }],
}

const favorite: Favorite = {
  id: 'f1',
  name: 'Marraqueta con palta',
  items: entry.items,
  meal: 'once',
  createdAt: 3,
  lastUsedAt: 4,
  useCount: 2,
}
const weight: WeightLog = { date: '2026-11-12', kg: 75.2, createdAt: 5 }
const glass: WaterLog = { id: 'w1', date: '2026-11-12', ml: 250, createdAt: 6 }

function data(partial: Partial<BackupData> = {}): BackupData {
  return { profile, entries: [entry], favorites: [], weights: [], water: [], ...partial }
}

/** A file exactly as phase 1 (backup schema v1) exported it. */
const V1_FILE = JSON.stringify({
  format: 'nutri-app-backup',
  schemaVersion: 1,
  exportedAt: '2026-11-01T10:00:00.000Z',
  profile,
  entries: [entry],
})

describe('backup', () => {
  it('round-trips profile and entries', () => {
    const file = serializeBackup(data(), new Date('2026-11-12T12:00:00Z'))
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.profile).toEqual(profile)
    expect(parsed.entries).toEqual([entry])
    expect(parsed.exportedAt).toBe('2026-11-12T12:00:00.000Z')
  })

  it('never includes settings or an API key', () => {
    const json = JSON.stringify(serializeBackup(data({ favorites: [favorite], weights: [weight], water: [glass] })))
    expect(json).not.toMatch(/apiKey|geminiApiKey|settings/i)
  })

  it('accepts a backup without profile', () => {
    expect(parseBackup(JSON.stringify(serializeBackup(data({ profile: null, entries: [] })))).profile).toBeNull()
  })

  it('rejects files that are not a Nutri backup', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup('{"entries": []}')).toThrow('no es un respaldo de Nutri')
  })

  it('rejects backups from a newer schema version', () => {
    const file = { ...serializeBackup(data()), schemaVersion: 99 }
    expect(() => parseBackup(JSON.stringify(file))).toThrow('versión más nueva')
  })

  it('names the damaged entry', () => {
    const bad = { ...entry, meal: 'merienda' }
    const file = serializeBackup(data({ entries: [entry, bad as unknown as Entry] }))
    expect(() => parseBackup(JSON.stringify(file))).toThrow('número 2')
  })

  it('rejects negative or non-numeric macros', () => {
    const bad = { ...entry, items: [{ ...entry.items[0], kcal: -5 }] }
    expect(() => parseBackup(JSON.stringify(serializeBackup(data({ profile: null, entries: [bad as Entry] }))))).toThrow(BackupError)
  })

  it('round-trips favorites, weigh-ins, water and the water goal (v2)', () => {
    const withGoal = { ...profile, waterGoalMl: 2600 }
    const file = serializeBackup(data({ profile: withGoal, favorites: [favorite], weights: [weight], water: [glass] }))
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.fromVersion).toBe(2)
    expect(parsed.profile).toEqual(withGoal)
    expect(parsed.favorites).toEqual([favorite])
    expect(parsed.weights).toEqual([weight])
    expect(parsed.water).toEqual([glass])
  })

  it('still imports a v1 backup, with empty v2 lists', () => {
    const parsed = parseBackup(V1_FILE)
    expect(parsed.fromVersion).toBe(1)
    expect(parsed.schemaVersion).toBe(2)
    expect(parsed.profile).toEqual(profile)
    expect(parsed.entries).toEqual([entry])
    expect(parsed.favorites).toEqual([])
    expect(parsed.weights).toEqual([])
    expect(parsed.water).toEqual([])
  })

  it('rejects a v2 backup missing a v2 list', () => {
    const { water: _water, ...rest } = serializeBackup(data())
    expect(() => parseBackup(JSON.stringify(rest))).toThrow('lista de agua')
  })

  it('names the damaged favorite, weigh-in or water log', () => {
    const badFav = serializeBackup(data({ favorites: [favorite, { ...favorite, items: [] }] }))
    expect(() => parseBackup(JSON.stringify(badFav))).toThrow('favorito número 2')
    const badWeight = serializeBackup(data({ weights: [{ ...weight, kg: 0 }] }))
    expect(() => parseBackup(JSON.stringify(badWeight))).toThrow('peso número 1')
    const badWater = serializeBackup(data({ water: [glass, { ...glass, date: '12-11-2026' }] }))
    expect(() => parseBackup(JSON.stringify(badWater))).toThrow('agua número 2')
  })

  it('builds a dated file name', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('nutri-respaldo-2026-01-05.json')
  })
})
