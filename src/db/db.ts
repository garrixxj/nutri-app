import { Dexie, type EntityTable } from 'dexie'
import {
  DEFAULT_GEMINI_MODEL,
  PROFILE_ID,
  SETTINGS_ID,
  type Entry,
  type Profile,
  type Settings,
} from './types.ts'

export const db = new Dexie('nutri-app') as Dexie & {
  profile: EntityTable<Profile, 'id'>
  entries: EntityTable<Entry, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  profile: 'id',
  entries: 'id, date, createdAt',
  settings: 'id',
})

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
