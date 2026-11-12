import type { Meal, Profile } from '../db/types.ts'
import { DayView } from '../components/DayView.tsx'
import { ScreenHeader, TabScreen } from '../components/ui.tsx'
import { formatLongDate } from '../domain/dates.ts'
import { useToday } from '../lib/useToday.ts'

export function Today({ profile, onRegister }: { profile: Profile; onRegister: (meal?: Meal, date?: string) => void }) {
  const today = useToday()
  return (
    <TabScreen>
      <ScreenHeader title="Hoy" eyebrow={formatLongDate(today)} />
      <DayView date={today} profile={profile} isToday onRegister={(meal) => onRegister(meal)} />
    </TabScreen>
  )
}
