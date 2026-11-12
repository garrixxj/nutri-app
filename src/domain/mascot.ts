import type { Macros, Meal, Targets } from '../db/types.ts'
import { addDays } from './dates.ts'
import { formatInt } from './format.ts'

/** Moods derived from the day's data. Saludo and comiendo are reactions layered on top in the UI. */
export type Mood = 'idle' | 'celebrate' | 'sleep' | 'worried'

/** "Pasarse mucho": above this share of the kcal goal. */
export const WORRIED_RATIO = 1.15
/** Before this hour (and without dinner) the koala never looks worried, so it doesn't scold mid-day. */
export const WORRIED_FROM_HOUR = 18

export interface DayStatus {
  totals: Macros
  targets: Targets
  /** Meals with at least one entry today. */
  meals: readonly Meal[]
  /** Local hour, 0–23. */
  hour: number
}

export interface MoodResult {
  mood: Mood
  /** Which goals are met when celebrating. */
  met: { kcal: boolean; protein: boolean }
  /** Over the worried threshold, whether or not it's late enough to show it. */
  wayOver: boolean
}

export function dayMood({ totals, targets, meals, hour }: DayStatus): MoodResult {
  const kcalRatio = targets.kcal > 0 ? totals.kcal / targets.kcal : 0
  const wayOver = kcalRatio > WORRIED_RATIO
  const met = {
    kcal: kcalRatio >= 1 && !wayOver,
    protein: targets.protein > 0 && totals.protein >= targets.protein,
  }
  if (meals.length === 0) return { mood: 'sleep', met, wayOver }
  if (wayOver && (hour >= WORRIED_FROM_HOUR || meals.includes('cena'))) return { mood: 'worried', met, wayOver }
  if (met.kcal || met.protein) return { mood: 'celebrate', met, wayOver }
  return { mood: 'idle', met, wayOver }
}

/**
 * Consecutive days with at least one entry, ending today. If today has nothing yet,
 * it counts up to yesterday: the streak only breaks once a whole day goes by empty.
 */
export function loggingStreak(loggedDates: readonly string[], today: string): number {
  const days = new Set(loggedDates)
  let day = days.has(today) ? today : addDays(today, -1)
  let n = 0
  while (days.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

export function streakLabel(n: number): string {
  return `Racha de ${n} ${n === 1 ? 'día' : 'días'}`
}

/** Stable pick for the day, so the message doesn't change on every render. */
function pick(pool: readonly string[], seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return pool[Math.abs(h) % pool.length] ?? pool[0] ?? ''
}

export interface CoachContext extends DayStatus {
  today: string
  streak: number
}

/** Coach line for the day's mood: motivating, Chilean, never a scolding. */
export function coachMessage(result: MoodResult, ctx: CoachContext): string {
  const { totals, targets, hour, today, streak } = ctx
  const seed = `${today}:${result.mood}`
  const proteinLeft = Math.round(targets.protein - totals.protein)
  const kcalLeft = Math.round(targets.kcal - totals.kcal)

  switch (result.mood) {
    case 'sleep': {
      if (hour < 12) return pick(['¿Y el desayuno? Anota lo primero y partimos.', 'Buenos días. Anota tu desayuno y arrancamos.'], seed)
      if (hour < 18) return pick(['Todavía no anotas nada hoy. ¿Qué almorzaste?', 'Hoy va en blanco. Anota lo que llevas y seguimos.'], seed)
      if (streak > 0) return `Anota lo de hoy y no se corta tu racha de ${streak} ${streak === 1 ? 'día' : 'días'}.`
      return 'Anota lo que comiste hoy y partimos de nuevo.'
    }
    case 'worried':
      return pick(
        [
          'Hoy se pasó un poco, no pasa nada. Mañana le damos de nuevo.',
          'Un día no define nada. Lo que importa es la semana.',
          `Te pasaste por ${formatInt(-kcalLeft)} kcal. Tranqui, mañana volvemos al plan.`,
        ],
        seed,
      )
    case 'celebrate':
      if (result.met.kcal && result.met.protein) return '¡Kcal y proteína al día! Día redondo.'
      if (result.met.protein)
        return pick(['¡Meta de proteína lista! Los músculos lo agradecen.', '¡Proteína cumplida! Así se hace.'], seed)
      return pick(['¡Meta de kcal cumplida! Así se hace.', '¡Kcal al día! Bien ahí.'], seed)
    case 'idle': {
      if (result.wayOver) return 'Ya cubriste las kcal de hoy. Si te da hambre, algo liviano y con proteína.'
      if (proteinLeft > 0)
        return pick(
          [
            `¡Vamos que se puede! Te faltan ${formatInt(proteinLeft)} g de proteína.`,
            `Vas bien. Te faltan ${formatInt(proteinLeft)} g de proteína, dale.`,
            `Paso a paso. Quedan ${formatInt(proteinLeft)} g de proteína por sumar.`,
          ],
          seed,
        )
      return pick([`¡Vamos que se puede! Te quedan ${formatInt(kcalLeft)} kcal.`, `Bien ahí. Quedan ${formatInt(kcalLeft)} kcal para el resto del día.`], seed)
    }
  }
}

/** Short reaction right after saving a meal. */
export function eatMessage(kcal: number): string {
  return `¡Anotado! Sumaste ${formatInt(kcal)} kcal.`
}

const CHEERS = ['¡Vamos que se puede!', '¡Eso! Sigue así.', '¡Con todo hoy!'] as const

/** Reaction when tapping the koala; cycles through the lines. */
export function cheerMessage(tap: number): string {
  return CHEERS[tap % CHEERS.length] ?? CHEERS[0]
}
