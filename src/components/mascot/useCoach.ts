import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { db, retryRead } from '../../db/db.ts'
import { addDays } from '../../domain/dates.ts'
import type { Profile } from '../../db/types.ts'
import { coachMessage, dayMood, loggingStreak } from '../../domain/mascot.ts'
import { dayTotals } from '../../domain/totals.ts'
import { getReaction, noticeEntries, subscribeReaction, tapKoala } from './reactions.ts'
import type { KoalaState } from './states.ts'

const CELEBRATED_KEY = 'koala.celebrated'
/** How far back the streak looks. */
const STREAK_WINDOW_DAYS = 730

function readCelebrated(): string | null {
  try {
    return localStorage.getItem(CELEBRATED_KEY)
  } catch {
    return null
  }
}
function writeCelebrated(value: string): void {
  try {
    localStorage.setItem(CELEBRATED_KEY, value)
  } catch {
    // Private mode: it just celebrates again next time.
  }
}

function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const update = () => setHour(new Date().getHours())
    const id = setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return hour
}

export interface Coach {
  state: KoalaState
  message: string
  /** Static pose: a celebration already played today. */
  still: boolean
  streak: number
  onTap: () => void
}

/** Koala state and line for Hoy, from today's entries, the hour and the logging streak. */
export function useCoach(today: string, profile: Profile): Coach | null {
  const entries = useLiveQuery(() => retryRead(() => db.entries.where('date').equals(today).toArray()), [today])
  // Unique logged days in a plain range read (no cursor: Safari's uniqueKeys() fails on iOS).
  const dates = useLiveQuery(
    () =>
      retryRead(async () => {
        const rows = await db.entries.where('date').between(addDays(today, -STREAK_WINDOW_DAYS), today, true, true).toArray()
        return [...new Set(rows.map((e) => e.date))]
      }),
    [today],
  )
  const hour = useHour()
  const reaction = useSyncExternalStore(subscribeReaction, getReaction)

  useEffect(() => {
    if (entries) noticeEntries(entries)
  }, [entries])

  const totals = dayTotals(entries ?? [])
  const meals = [...new Set((entries ?? []).map((e) => e.meal))]
  const status = { totals, targets: profile.targets, meals, hour }
  const result = dayMood(status)
  const celebrateKey = result.mood === 'celebrate' ? `${today}:${result.met.kcal ? 'k' : ''}${result.met.protein ? 'p' : ''}` : null

  // The full celebration plays once per day and goal; after that the pose stays still.
  const celebrateFresh = useMemo(() => celebrateKey !== null && readCelebrated() !== celebrateKey, [celebrateKey])
  useEffect(() => {
    if (celebrateKey) writeCelebrated(celebrateKey)
  }, [celebrateKey])

  if (!entries || !dates) return null
  const streak = loggingStreak(dates, today)
  if (reaction) return { state: reaction.state, message: reaction.message, still: false, streak, onTap: tapKoala }
  return {
    state: result.mood,
    message: coachMessage(result, { ...status, today, streak }),
    still: result.mood === 'celebrate' && !celebrateFresh,
    streak,
    onTap: tapKoala,
  }
}
