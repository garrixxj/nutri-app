import type { Entry } from '../../db/types.ts'
import { cheerMessage, eatMessage } from '../../domain/mascot.ts'
import { entryTotals } from '../../domain/totals.ts'

/**
 * Short koala reactions (greeting, sipping after a save, tap) as a tiny external store.
 * Module scope, so leaving Hoy and coming back doesn't replay them.
 */
export interface Reaction {
  state: 'cheer' | 'eat'
  message: string
}

/** A meal saved this recently counts as "just eaten" when Hoy sees it. */
const JUST_SAVED_MS = 20_000
const EAT_MS = 3200
const CHEER_MS = 1900

let current: Reaction | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const seen = new Set<string>()
let greeted = false
let taps = 0
const listeners = new Set<() => void>()

function show(reaction: Reaction, ms: number): void {
  clearTimeout(timer)
  current = reaction
  listeners.forEach((l) => l())
  timer = setTimeout(() => {
    current = null
    listeners.forEach((l) => l())
  }, ms)
}

export function subscribeReaction(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getReaction(): Reaction | null {
  return current
}

/** Called with today's entries whenever they change: sip after a save, else greet once per session. */
export function noticeEntries(entries: readonly Entry[]): void {
  let newest: Entry | null = null
  for (const e of entries) {
    if (!seen.has(e.id) && (!newest || e.createdAt > newest.createdAt)) newest = e
  }
  for (const e of entries) seen.add(e.id)
  if (newest && Date.now() - newest.createdAt < JUST_SAVED_MS) {
    greeted = true
    show({ state: 'eat', message: eatMessage(entryTotals(newest).kcal) }, EAT_MS)
    return
  }
  if (!greeted) {
    greeted = true
    show({ state: 'cheer', message: cheerMessage(0) }, CHEER_MS)
  }
}

export function tapKoala(): void {
  taps++
  show({ state: 'cheer', message: cheerMessage(taps) }, CHEER_MS)
}
