import { Dexie, type EntityTable } from 'dexie'
import {
  DEFAULT_GEMINI_MODEL,
  PROFILE_ID,
  SETTINGS_ID,
  type Entry,
  type Favorite,
  type Profile,
  type Settings,
  type WaterLog,
  type WeightLog,
} from './types.ts'
import { toISODate } from '../domain/dates.ts'

export const DB_NAME = 'nutri-app'

export type NutriDb = Dexie & {
  profile: EntityTable<Profile, 'id'>
  entries: EntityTable<Entry, 'id'>
  settings: EntityTable<Settings, 'id'>
  favorites: EntityTable<Favorite, 'id'>
  weights: EntityTable<WeightLog, 'date'>
  water: EntityTable<WaterLog, 'id'>
}

/** v1 schema, kept verbatim: Dexie needs every past version to upgrade old databases. */
export const SCHEMA_V1 = {
  profile: 'id',
  entries: 'id, date, createdAt',
  settings: 'id',
} as const

/**
 * Opens the app database. Versions only ever add: v2 adds favorites, weights and
 * water and leaves v1 tables (and their rows) untouched.
 */
export function createDb(name = DB_NAME): NutriDb {
  const d = new Dexie(name) as NutriDb
  d.version(1).stores(SCHEMA_V1)
  d.version(2)
    .stores({
      favorites: 'id, lastUsedAt',
      weights: 'date',
      water: 'id, date',
    })
    .upgrade(async (tx) => {
      // Seed the weight chart with the weight already entered in the profile.
      const profile = (await tx.table('profile').get(PROFILE_ID)) as Profile | undefined
      if (profile && profile.weightKg > 0) {
        const log: WeightLog = { date: toISODate(new Date(profile.updatedAt)), kg: profile.weightKg, createdAt: profile.updatedAt }
        await tx.table('weights').put(log)
      }
    })
  return d
}

export const db = createDb()

export function getProfile(): Promise<Profile | undefined> {
  return db.profile.get(PROFILE_ID)
}

export async function saveProfile(profile: Omit<Profile, 'id' | 'updatedAt'>): Promise<void> {
  await db.profile.put({ ...profile, id: PROFILE_ID, updatedAt: Date.now() })
}

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get(SETTINGS_ID)
  return stored ?? { id: SETTINGS_ID, geminiApiKey: '', geminiModel: DEFAULT_GEMINI_MODEL }
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: SETTINGS_ID })
}

/*
 * Safari on iOS can fail IndexedDB cursors ("UnknownError: Unable to open cursor").
 * Reads in this app avoid cursors (no orderBy/uniqueKeys/reverse/last/offset/limit):
 * they use where(...).equals/between(...).toArray() or table.toArray() and sort or
 * dedupe in JavaScript. As a second line of defense, reads go through `retryRead`.
 */
let reopening: Promise<unknown> | null = null

function isRecoverable(e: unknown): boolean {
  const err = e as { name?: string; inner?: { name?: string } } | null
  return err?.name === 'UnknownError' || err?.inner?.name === 'UnknownError' || err?.name === 'DatabaseClosedError'
}

/** Closes and reopens the database once, shared by every read that fails at the same time. */
function reopenDb(): Promise<unknown> {
  if (!reopening) {
    db.close({ disableAutoOpen: false })
    reopening = db.open().finally(() => {
      reopening = null
    })
  }
  return reopening
}

/** Runs a read; if Safari fails it with UnknownError, reopens the database and tries once more. */
export async function retryRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read()
  } catch (e) {
    if (!isRecoverable(e)) throw e
    await reopenDb()
    return read()
  }
}
