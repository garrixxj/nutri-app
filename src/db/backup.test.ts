import { describe, expect, it } from 'vitest'
import { BackupError, backupFileName, parseBackup, serializeBackup } from './backup.ts'
import type { Entry, Profile } from './types.ts'

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

describe('backup', () => {
  it('round-trips profile and entries', () => {
    const file = serializeBackup(profile, [entry], new Date('2026-11-12T12:00:00Z'))
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.profile).toEqual(profile)
    expect(parsed.entries).toEqual([entry])
    expect(parsed.exportedAt).toBe('2026-11-12T12:00:00.000Z')
  })

  it('never includes settings or an API key', () => {
    const json = JSON.stringify(serializeBackup(profile, [entry]))
    expect(json).not.toMatch(/apiKey|geminiApiKey|settings/i)
  })

  it('accepts a backup without profile', () => {
    expect(parseBackup(JSON.stringify(serializeBackup(null, []))).profile).toBeNull()
  })

  it('rejects files that are not a Nutri backup', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup('{"entries": []}')).toThrow('no es un respaldo de Nutri')
  })

  it('rejects backups from a newer schema version', () => {
    const file = { ...serializeBackup(profile, []), schemaVersion: 99 }
    expect(() => parseBackup(JSON.stringify(file))).toThrow('versión más nueva')
  })

  it('names the damaged entry', () => {
    const bad = { ...entry, meal: 'merienda' }
    const file = serializeBackup(profile, [entry, bad as unknown as Entry])
    expect(() => parseBackup(JSON.stringify(file))).toThrow('número 2')
  })

  it('rejects negative or non-numeric macros', () => {
    const bad = { ...entry, items: [{ ...entry.items[0], kcal: -5 }] }
    expect(() => parseBackup(JSON.stringify(serializeBackup(null, [bad as Entry])))).toThrow(BackupError)
  })

  it('builds a dated file name', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('nutri-respaldo-2026-01-05.json')
  })
})
