export const SEXES = ['male', 'female'] as const
export type Sex = (typeof SEXES)[number]

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]

export const GOALS = ['gain_muscle', 'maintain', 'cut'] as const
export type Goal = (typeof GOALS)[number]

export const MEALS = ['desayuno', 'almuerzo', 'once', 'cena', 'snack'] as const
export type Meal = (typeof MEALS)[number]

export const ENTRY_SOURCES = ['photo', 'text', 'barcode', 'manual', 'favorite'] as const
export type EntrySource = (typeof ENTRY_SOURCES)[number]

export interface Macros {
  kcal: number
  /** grams */
  protein: number
  /** grams */
  carbs: number
  /** grams */
  fat: number
}

export type Targets = Macros

export const PROFILE_ID = 'me'

export interface Profile {
  id: typeof PROFILE_ID
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
  targets: Targets
  /** True when the user overrode the calculated targets by hand. */
  targetsEdited: boolean
  updatedAt: number
}

export interface Item extends Macros {
  name: string
  grams: number
  /** 0..1, as reported by the AI. */
  confidence?: number
}

export interface Entry {
  id: string
  /** Local date, YYYY-MM-DD. */
  date: string
  meal: Meal
  items: Item[]
  source: EntrySource
  /** Small JPEG data URL. */
  photoThumb?: string
  createdAt: number
}

export const SETTINGS_ID = 'settings'
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'

/** Device-only settings. Never included in the JSON backup (holds the API key). */
export interface Settings {
  id: typeof SETTINGS_ID
  geminiApiKey: string
  geminiModel: string
  lastBackupAt?: number
}
