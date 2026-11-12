/**
 * Minimal hash router. Hash routes work on any static host and never hit the
 * server, so the PWA's offline shell always resolves.
 */
import { useSyncExternalStore } from 'react'

export interface Route {
  path: string
  params: URLSearchParams
}

export const TAB_PATHS = ['/', '/historial', '/progreso', '/ajustes'] as const

/** Pushes made inside this session; lets `goBack` know whether history.back() stays in the app. */
let depth = 0

function readHash(): string {
  return window.location.hash.slice(1) || '/'
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, readHash)
  const [path = '/', query = ''] = hash.split('?')
  return { path, params: new URLSearchParams(query) }
}

export function navigate(to: string, { replace = false }: { replace?: boolean } = {}): void {
  if (readHash() === to) return
  if (replace) {
    history.replaceState(history.state, '', `#${to}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    depth++
    window.location.hash = to
  }
  window.scrollTo(0, 0)
}

export function goBack(fallback = '/'): void {
  if (depth > 0) {
    depth--
    history.back()
  } else {
    navigate(fallback, { replace: true })
  }
}
