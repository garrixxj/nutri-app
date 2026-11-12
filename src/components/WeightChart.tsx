import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { addDays, daysBetween, fromISODate } from '../domain/dates.ts'
import { formatDecimal, formatKg } from '../domain/format.ts'
import type { TrendPoint } from '../domain/weight.ts'

const HEIGHT = 184
const PAD = { top: 14, right: 44, bottom: 26, left: 6 }
const shortDate = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e?.contentRect.width ?? 0)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Clean tick step (0.5, 1, 2, 5…) for a kg span, aiming at 3–4 gridlines. */
function niceStep(span: number): number {
  const raw = span / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

/**
 * Weight trend: faint daily weigh-ins plus the 7-day average as the one line.
 * Single series, so no legend: the card title names it. Tap or drag for a
 * crosshair readout; arrow keys do the same. A hidden table carries every value.
 */
export function WeightChart({ points, today, days }: { points: TrendPoint[]; today: string; days: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const start = addDays(today, -(days - 1))
  const plotW = Math.max(width - PAD.left - PAD.right, 1)
  const plotH = HEIGHT - PAD.top - PAD.bottom

  const values = points.flatMap((p) => [p.kg, p.avgKg])
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const step = niceStep(Math.max(hi - lo, 1))
  const yMin = Math.floor((lo - step * 0.25) / step) * step
  const yMax = Math.ceil((hi + step * 0.25) / step) * step
  const ticks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)

  const x = (date: string) => PAD.left + (daysBetween(start, date) / Math.max(days - 1, 1)) * plotW
  const y = (kg: number) => PAD.top + (1 - (kg - yMin) / (yMax - yMin || 1)) * plotH

  // The average only becomes a line once it actually averages something.
  const firstSmoothed = points.findIndex((p) => p.samples >= 2)
  const line = firstSmoothed === -1 ? [] : points.slice(firstSmoothed)
  const path = line.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.avgKg).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const xLabels = [start, addDays(start, Math.round((days - 1) / 2)), today]

  function nearest(clientX: number, target: Element) {
    const box = target.getBoundingClientRect()
    const px = clientX - box.left
    let best = 0
    let bestDist = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(x(p.date) - px)
      if (d < bestDist) {
        best = i
        bestDist = d
      }
    })
    setActive(best)
  }

  function onPointer(e: PointerEvent<SVGRectElement>) {
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId)
    nearest(e.clientX, e.currentTarget.ownerSVGElement ?? e.currentTarget)
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const delta = e.key === 'ArrowLeft' ? -1 : 1
    setActive((a) => Math.min(Math.max((a ?? points.length) + delta, 0), points.length - 1))
  }

  const sel = active !== null ? points[active] : undefined
  const tipLeft = sel ? Math.min(Math.max(x(sel.date), 70), Math.max(width - 70, 70)) : 0

  return (
    <div className="relative">
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={`Gráfico de peso de los últimos ${days} días. Usa las flechas para recorrerlo.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="relative rounded-inner outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        {width > 0 && points.length > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden="true" className="block touch-pan-y select-none">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} className="stroke-separator" strokeWidth={1} />
                <text x={width - 2} y={y(t) + 4} textAnchor="end" className="fill-text-2 text-[11px] tabular">
                  {formatDecimal(t)}
                </text>
              </g>
            ))}
            {xLabels.map((d, i) => (
              <text
                key={d}
                x={x(d)}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
                className="fill-text-2 text-[11px]"
              >
                {i === 2 ? 'Hoy' : shortDate.format(fromISODate(d)).replace('.', '')}
              </text>
            ))}

            {sel && (
              <line x1={x(sel.date)} x2={x(sel.date)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-text-2" strokeWidth={1} />
            )}

            {points.map((p) => (
              <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={3} className="fill-text-2" opacity={0.35} />
            ))}

            {path && (
              <path d={path} fill="none" className="stroke-chart" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}

            {(sel ?? last) && (
              <circle
                cx={x((sel ?? last)!.date)}
                cy={y((sel ?? last)!.avgKg)}
                r={4.5}
                className="fill-chart stroke-card"
                strokeWidth={2}
              />
            )}

            <rect
              x={PAD.left}
              y={0}
              width={plotW}
              height={HEIGHT}
              fill="transparent"
              onPointerDown={onPointer}
              onPointerMove={(e) => e.buttons > 0 || e.pointerType === 'mouse' ? onPointer(e) : undefined}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
              onPointerUp={(e) => e.pointerType !== 'mouse' && setTimeout(() => setActive(null), 1600)}
            />
          </svg>
        )}
      </div>

      {sel && (
        <div
          className="pointer-events-none absolute -top-2 z-10 w-max -translate-x-1/2 whitespace-nowrap -translate-y-full rounded-inner bg-card px-3 py-2 shadow-card ring-1 ring-separator"
          style={{ left: tipLeft }}
          aria-live="polite"
        >
          <p className="text-label text-text-2 first-letter:uppercase">{longDate.format(fromISODate(sel.date)).replace('.', '')}</p>
          <p className="flex items-center gap-1.5 text-secondary font-bold tabular">
            <span className="h-0.5 w-3 rounded-full bg-chart" aria-hidden="true" />
            {formatKg(sel.avgKg)} kg
            <span className="font-normal text-text-2">promedio</span>
          </p>
          <p className="text-label text-text-2 tabular">Pesaje: {formatKg(sel.kg)} kg</p>
        </div>
      )}

      {/* Tables ignore sr-only's 1px width, so the wrapper clips it instead. */}
      <div className="sr-only">
      <table>
        <caption>Pesajes de los últimos {days} días</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Pesaje (kg)</th>
            <th scope="col">Promedio de 7 días (kg)</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{longDate.format(fromISODate(p.date))}</td>
              <td>{formatKg(p.kg)}</td>
              <td>{formatKg(p.avgKg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
