import type { Meal, Profile } from '../db/types.ts'
import { DayView } from '../components/DayView.tsx'
import { CoachPeek, StreakChip } from '../components/mascot/Coach.tsx'
import { useCoach } from '../components/mascot/useCoach.ts'
import { ScreenHeader, TabScreen } from '../components/ui.tsx'
import { formatLongDate } from '../domain/dates.ts'
import { useToday } from '../lib/useToday.ts'

export function Today({ profile, onRegister }: { profile: Profile; onRegister: (meal?: Meal, date?: string) => void }) {
  const today = useToday()
  const coach = useCoach(today, profile)
  return (
    <TabScreen>
      <ScreenHeader title="Hoy" eyebrow={formatLongDate(today)} right={coach && <StreakChip streak={coach.streak} />} />
      <DayView
        date={today}
        profile={profile}
        isToday
        onRegister={(meal) => onRegister(meal)}
        coach={coach && <CoachPeek state={coach.state} still={coach.still} message={coach.message} onTap={coach.onTap} />}
      />
    </TabScreen>
  )
}
