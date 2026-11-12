import { useId, useState } from 'react'
import type { WeightLog } from '../db/types.ts'
import { deleteWeight, logWeight } from '../db/weight-store.ts'
import { formatKg, parseDecimal, toInputString } from '../domain/format.ts'
import { formatLongDate } from '../domain/dates.ts'
import { Sheet } from './Sheet.tsx'
import { Button } from './ui.tsx'

/** Logs (or replaces) the weigh-in of a day. Defaults to today and the last known weight. */
export function WeightSheet({
  open,
  onClose,
  today,
  logs,
  fallbackKg,
}: {
  open: boolean
  onClose: () => void
  today: string
  logs: readonly WeightLog[]
  fallbackKg: number
}) {
  const kgId = useId()
  const dateId = useId()
  const [date, setDate] = useState(today)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)

  const existing = logs.find((l) => l.date === date)
  const last = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1))[0]

  // Reset the form each time the sheet opens.
  if (open && !wasOpen) {
    setWasOpen(true)
    setDate(today)
    const todays = logs.find((l) => l.date === today)
    setValue(toInputString(todays?.kg ?? last?.kg ?? fallbackKg))
    setError(null)
  }
  if (!open && wasOpen) setWasOpen(false)

  async function save() {
    const kg = parseDecimal(value)
    if (kg === null || kg < 25 || kg > 350) {
      setError('Escribe tu peso en kilos, por ejemplo 80,4.')
      return
    }
    await logWeight(date, Math.round(kg * 10) / 10)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Registrar peso" showTitle>
      <label htmlFor={kgId} className="sr-only">
        Peso en kilos
      </label>
      <div className="flex items-baseline justify-center gap-2 rounded-inner bg-fill px-4 py-5">
        <input
          id={kgId}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          aria-invalid={error ? true : undefined}
          className="w-32 bg-transparent text-center text-metric font-bold tracking-tight outline-none"
        />
        <span className="text-title font-semibold text-text-2">kg</span>
      </div>
      {error && (
        <p className="mt-2 text-secondary text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-inner bg-fill px-4">
        <label htmlFor={dateId} className="text-body">
          Día
        </label>
        <input
          id={dateId}
          type="date"
          value={date}
          max={today}
          onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && setDate(e.target.value)}
          className="bg-transparent text-right text-body text-text outline-none"
        />
      </div>
      <p className="mt-2 px-1 text-label text-text-2">
        {existing
          ? `Reemplaza el pesaje de ${date === today ? 'hoy' : formatLongDate(date)} (${formatKg(existing.kg)} kg).`
          : 'Pésate a la misma hora, idealmente en ayunas. El gráfico suaviza las variaciones del día a día.'}
      </p>

      <Button className="mt-4 w-full" onClick={save}>
        Guardar peso
      </Button>
      {existing && (
        <Button
          variant="plain"
          className="mt-1 w-full text-danger"
          onClick={async () => {
            await deleteWeight(existing.date)
            onClose()
          }}
        >
          Borrar este pesaje
        </Button>
      )}
    </Sheet>
  )
}
