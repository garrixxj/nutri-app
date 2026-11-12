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
