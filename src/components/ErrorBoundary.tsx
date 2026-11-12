import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  where: string
}

function detail(error: Error, where: string): string {
  return [error.name + ': ' + error.message, error.stack ?? '', where].filter(Boolean).join('\n').slice(0, 2000)
}

/**
 * Shows the error on screen instead of leaving the app blank, so it can be read
 * (and copied) on the iPhone, where there is no console.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, where: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(_error: Error, info: ErrorInfo) {
    this.setState({ where: info.componentStack?.trim().split('\n').slice(0, 6).join('\n') ?? '' })
  }

  render() {
    const { error, where } = this.state
    if (!error) return this.props.children
    const text = detail(error, where)
    return (
      <main className="safe-top mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pt-6 pb-10">
        <h1 className="text-title font-bold tracking-tight">La app tuvo un error</h1>
        <p className="text-body text-text-2">
          Tus datos siguen guardados. Recarga para intentar de nuevo; si vuelve a pasar, copia el detalle y envíalo.
        </p>
        <pre className="max-h-[50dvh] overflow-auto rounded-inner bg-fill p-4 text-label whitespace-pre-wrap text-text">{text}</pre>
        <div className="flex gap-3">
          <button
            type="button"
            className="min-h-13 flex-1 rounded-button bg-ink px-4 text-body font-semibold text-on-ink"
            onClick={() => location.reload()}
          >
            Recargar
          </button>
          <button
            type="button"
            className="min-h-13 flex-1 rounded-button bg-fill px-4 text-body font-semibold text-text"
            onClick={() => void navigator.clipboard?.writeText(text)}
          >
            Copiar detalle
          </button>
        </div>
      </main>
    )
  }
}

/** Contains a failure in an optional part (the koala) so the rest of the screen keeps working. */
export class SoftBoundary extends Component<{ children: ReactNode; label: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <p className="rounded-inner bg-fill px-4 py-3 text-label text-text-2">
        {this.props.label} tuvo un error: {error.message}
      </p>
    )
  }
}
