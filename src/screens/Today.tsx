import type { Meal, Profile } from '../db/types.ts'
import { DayView } from '../components/DayView.tsx'
import { SoftBoundary } from '../components/ErrorBoundary.tsx'
import { CoachPeek, StreakChip } from '../components/mascot/Coach.tsx'
import { useCoach } from '../components/mascot/useCoach.ts'
import { ScreenHeader, TabScreen } from '../components/ui.tsx'
import { formatLongDate } from '../domain/dates.ts'
import { useToday } from '../lib/useToday.ts'

export function Today({ profile, onRegister }: { profile: Profile; onRegister: (meal?: Meal, date?: string) => void }) {
  const today = useToday()
  return (
    <TabScreen>
      <ScreenHeader
        title="Hoy"
        eyebrow={formatLongDate(today)}
        right={
          <SoftBoundary label="La racha">
            <TodayStreak today={today} profile={profile} />
          </SoftBoundary>
        }
      />
      <DayView
        date={today}
        profile={profile}
        isToday
        onRegister={(meal) => onRegister(meal)}
        coach={
          <SoftBoundary label="El koala">
            <TodayCoach today={today} profile={profile} />
          </SoftBoundary>
        }
      />
    </TabScreen>
  )
}

/** Koala and its line; isolated so a failure here never takes down Hoy. */
function TodayCoach({ today, profile }: { today: string; profile: Profile }) {
  const coach = useCoach(today, profile)
  if (!coach) return null
  return <CoachPeek state={coach.state} still={coach.still} message={coach.message} onTap={coach.onTap} />
}

function TodayStreak({ today, profile }: { today: string; profile: Profile }) {
  const coach = useCoach(today, profile)
  return coach ? <StreakChip streak={coach.streak} /> : null
}
