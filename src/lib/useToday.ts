import { useEffect, useState } from 'react'
import { toISODate } from '../domain/dates.ts'

/** Today's local date; rolls over at midnight and when the app returns from background. */
export function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const update = () => setToday(toISODate(new Date()))
    const id = setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return today
}
