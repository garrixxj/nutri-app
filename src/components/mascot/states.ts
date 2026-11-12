export const KOALA_STATES = ['idle', 'cheer', 'eat', 'celebrate', 'sleep', 'worried'] as const
export type KoalaState = (typeof KOALA_STATES)[number]
