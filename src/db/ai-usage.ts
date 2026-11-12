import { getSettings, updateSettings } from './db.ts'

/**
 * Gemini's free quota resets at midnight Pacific time (3:00–5:00 in Chile),
 * so the counter uses that calendar day instead of the local one.
 */
const pacificDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function quotaDay(now = new Date()): string {
  return pacificDay.format(now)
}

export async function recordAiUsage(): Promise<void> {
  const s = await getSettings()
  const day = quotaDay()
  await updateSettings({ aiUsageDay: day, aiUsageCount: s.aiUsageDay === day ? (s.aiUsageCount ?? 0) + 1 : 1 })
}

/** Analyses counted for the current quota day. */
export function usageToday(settings: { aiUsageDay?: string; aiUsageCount?: number }, now = new Date()): number {
  return settings.aiUsageDay === quotaDay(now) ? (settings.aiUsageCount ?? 0) : 0
}
