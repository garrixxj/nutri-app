import type { ActivityLevel, Goal, Meal, Sex } from '../db/types.ts'

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Hombre' },
  { value: 'female', label: 'Mujer' },
]

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; detail: string }[] = [
  { value: 'sedentary', label: 'Sedentario', detail: 'Poco o nada de ejercicio' },
  { value: 'light', label: 'Ligero', detail: 'Ejercicio 1 a 3 días por semana' },
  { value: 'moderate', label: 'Moderado', detail: 'Ejercicio 3 a 5 días por semana' },
  { value: 'active', label: 'Activo', detail: 'Ejercicio 6 a 7 días por semana' },
  { value: 'very_active', label: 'Muy activo', detail: 'Entrenamiento intenso o trabajo físico' },
]

export const GOAL_OPTIONS: { value: Goal; label: string; detail: string }[] = [
  { value: 'gain_muscle', label: 'Ganar músculo', detail: '300 kcal sobre tu gasto diario' },
  { value: 'maintain', label: 'Mantener peso', detail: 'Lo mismo que gastas al día' },
  { value: 'cut', label: 'Bajar grasa', detail: '20% bajo tu gasto diario' },
]

export const MEAL_LABELS: Record<Meal, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  once: 'Once',
  cena: 'Cena',
  snack: 'Snack',
}
