/**
 * JSON backup format. Pure functions only (no IndexedDB), so they unit-test directly.
 * The backup carries the profile, every entry and (since v2) favorites, weigh-ins and
 * water. It never carries Settings, so the Gemini API key cannot leak through an
 * exported file. Older backups (v1) still import: the v2 lists come back empty.
 */
import {
  ACTIVITY_LEVELS,
  ENTRY_SOURCES,
  GOALS,
  MEALS,
  PROFILE_ID,
  SEXES,
  type Entry,
  type Favorite,
  type Item,
  type Macros,
  type Profile,
  type WaterLog,
  type WeightLog,
} from './types.ts'

export const BACKUP_FORMAT = 'nutri-app-backup'
export const BACKUP_SCHEMA_VERSION = 2

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface BackupData {
  profile: Profile | null
  entries: Entry[]
  favorites: Favorite[]
  weights: WeightLog[]
  water: WaterLog[]
}

export interface BackupFile extends BackupData {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  exportedAt: string
}

export interface ParsedBackup extends BackupFile {
  /** Schema version the file was written with (1 = before favorites, weight and water). */
  fromVersion: number
}

export class BackupError extends Error {
  override name = 'BackupError'
}

export function serializeBackup(data: BackupData, now = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    profile: data.profile,
    entries: data.entries,
    favorites: data.favorites,
    weights: data.weights,
    water: data.water,
  }
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `nutri-respaldo-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

/** Parses and validates a backup. Throws BackupError with a user-facing message. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('El archivo no es un JSON válido.')
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    throw new BackupError('Este archivo no es un respaldo de Nutri.')
  }
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion < 1 || raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('El respaldo es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.')
  }
  if (!Array.isArray(raw.entries)) {
    throw new BackupError('El respaldo no tiene la lista de comidas.')
  }

  const fromVersion = raw.schemaVersion
  const profile = raw.profile == null ? null : parseProfile(raw.profile)
  const entries = raw.entries.map((e, i) => parseEntry(e, i))

  // v1 files predate these lists; a v2 file must carry them.
  const list = (key: 'favorites' | 'weights' | 'water', what: string): unknown[] => {
    const v = raw[key]
    if (fromVersion < 2) return []
    if (!Array.isArray(v)) throw new BackupError(`El respaldo no tiene la lista de ${what}.`)
    return v
  }
  const favorites = list('favorites', 'favoritos').map((f, i) => parseFavorite(f, i))
  const weights = list('weights', 'pesos').map((w, i) => parseWeight(w, i))
  const water = list('water', 'agua').map((w, i) => parseWater(w, i))

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    fromVersion,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    profile,
    entries,
    favorites,
    weights,
    water,
  }
}

function parseProfile(v: unknown): Profile {
  const fail = () => {
    throw new BackupError('El perfil del respaldo está dañado.')
  }
  if (!isRecord(v)) return fail()
  if (!isOneOf(v.sex, SEXES) || !isOneOf(v.activityLevel, ACTIVITY_LEVELS) || !isOneOf(v.goal, GOALS)) return fail()
  if (!isPositive(v.age) || !isPositive(v.heightCm) || !isPositive(v.weightKg)) return fail()
  const targets = parseMacros(v.targets)
  if (!targets) return fail()
  const profile: Profile = {
    id: PROFILE_ID,
    sex: v.sex,
    age: v.age,
    heightCm: v.heightCm,
    weightKg: v.weightKg,
    activityLevel: v.activityLevel,
    goal: v.goal,
    targets,
    targetsEdited: v.targetsEdited === true,
    updatedAt: isNonNegative(v.updatedAt) ? v.updatedAt : Date.now(),
  }
  if (isPositive(v.waterGoalMl) && v.waterGoalMl <= 10_000) profile.waterGoalMl = v.waterGoalMl
  return profile
}

function parseEntry(v: unknown, index: number): Entry {
  const fail = () => {
    throw new BackupError(`La comida número ${index + 1} del respaldo está dañada.`)
  }
  if (!isRecord(v)) return fail()
  if (typeof v.id !== 'string' || v.id === '') return fail()
  if (!isIsoDate(v.date)) return fail()
  if (!isOneOf(v.meal, MEALS) || !isOneOf(v.source, ENTRY_SOURCES)) return fail()
  if (!isNonNegative(v.createdAt) || !Array.isArray(v.items)) return fail()

  const items: Item[] = []
  for (const it of v.items) {
    const item = parseItem(it)
    if (!item) return fail()
    items.push(item)
  }

  const entry: Entry = { id: v.id, date: v.date, meal: v.meal, items, source: v.source, createdAt: v.createdAt }
  if (typeof v.photoThumb === 'string' && v.photoThumb.startsWith('data:image/')) entry.photoThumb = v.photoThumb
  return entry
}

function parseFavorite(v: unknown, index: number): Favorite {
  const fail = () => {
    throw new BackupError(`El favorito número ${index + 1} del respaldo está dañado.`)
  }
  if (!isRecord(v)) return fail()
  if (typeof v.id !== 'string' || v.id === '' || typeof v.name !== 'string' || v.name.trim() === '') return fail()
  if (!isOneOf(v.meal, MEALS) || !Array.isArray(v.items) || v.items.length === 0) return fail()
  if (!isNonNegative(v.createdAt) || !isNonNegative(v.lastUsedAt) || !isNonNegative(v.useCount)) return fail()

  const items: Item[] = []
  for (const it of v.items) {
    const item = parseItem(it)
    if (!item) return fail()
    items.push(item)
  }
  const fav: Favorite = {
    id: v.id,
    name: v.name.trim(),
    items,
    meal: v.meal,
    createdAt: v.createdAt,
    lastUsedAt: v.lastUsedAt,
    useCount: Math.floor(v.useCount),
  }
  if (typeof v.photoThumb === 'string' && v.photoThumb.startsWith('data:image/')) fav.photoThumb = v.photoThumb
  return fav
}

function parseWeight(v: unknown, index: number): WeightLog {
  if (!isRecord(v) || !isIsoDate(v.date) || !isPositive(v.kg) || v.kg > 500 || !isNonNegative(v.createdAt)) {
    throw new BackupError(`El peso número ${index + 1} del respaldo está dañado.`)
  }
  return { date: v.date, kg: v.kg, createdAt: v.createdAt }
}

function parseWater(v: unknown, index: number): WaterLog {
  if (
    !isRecord(v) ||
    typeof v.id !== 'string' ||
    v.id === '' ||
    !isIsoDate(v.date) ||
    !isPositive(v.ml) ||
    v.ml > 5000 ||
    !isNonNegative(v.createdAt)
  ) {
    throw new BackupError(`El registro de agua número ${index + 1} del respaldo está dañado.`)
  }
  return { id: v.id, date: v.date, ml: v.ml, createdAt: v.createdAt }
}

function parseItem(v: unknown): Item | null {
  if (!isRecord(v) || typeof v.name !== 'string' || !isNonNegative(v.grams)) return null
  const macros = parseMacros(v)
  if (!macros) return null
  const item: Item = { name: v.name, grams: v.grams, ...macros }
  if (typeof v.confidence === 'number' && v.confidence >= 0 && v.confidence <= 1) item.confidence = v.confidence
  return item
}

function parseMacros(v: unknown): Macros | null {
  if (!isRecord(v)) return null
  const { kcal, protein, carbs, fat } = v
  if (!isNonNegative(kcal) || !isNonNegative(protein) || !isNonNegative(carbs) || !isNonNegative(fat)) return null
  return { kcal, protein, carbs, fat }
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && ISO_DATE.test(v)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

function isPositive(v: unknown): v is number {
  return isNonNegative(v) && v > 0
}

function isOneOf<T extends string>(v: unknown, options: readonly T[]): v is T {
  return typeof v === 'string' && (options as readonly string[]).includes(v)
}
