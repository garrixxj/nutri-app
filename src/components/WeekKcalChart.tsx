import { useEffect, useRef, useState } from 'react'
import { fromISODate } from '../domain/dates.ts'
import { formatInt } from '../domain/format.ts'
import type { SummaryDay } from '../domain/progress.ts'

const HEIGHT = 156
const PAD = { top: 18, bottom: 26 }
const BAR_MAX = 24
const RADIUS = 4
const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const dayName = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })

/** Column with a 4px rounded top and a square base, grown from the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

/**
 * Kcal per day of one week against the daily goal (a solid hairline).
 * Single series, so no legend. Tap a day for its value; a hidden table has them all.
 */
export function WeekKcalChart({ days, goal, today }: { days: SummaryDay[]; goal: number; today: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e?.contentRect.width ?? 0)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const plotH = HEIGHT - PAD.top - PAD.bottom
  const yMax = Math.max(goal * 1.15, ...days.map((d) => d.kcal * 1.05), 1)
  const y = (kcal: number) => PAD.top + (1 - kcal / yMax) * plotH
  const slot = width / 7
  const barW = Math.min(BAR_MAX, slot * 0.55)
  const baseline = PAD.top + plotH
  const sel = active !== null ? days[active] : undefined

  return (
    <div className="relative">
      <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden="true" className="block select-none">
            <line x1={0} x2={width} y1={baseline} y2={baseline} className="stroke-separator" strokeWidth={1} />
            {days.map((d, i) => {
              const cx = slot * i + slot / 2
              const h = baseline - y(d.kcal)
              return (
                <g key={d.date}>
                  {d.logged && h > 0 && (
                    <path
                      d={columnPath(cx - barW / 2, y(d.kcal), barW, h)}
                      className={`fill-chart transition-opacity duration-150 ease-out ${active !== null && active !== i ? 'opacity-40' : ''}`}
                    />
                  )}
                  <text
                    x={cx}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                    className={`text-[11px] ${d.date === today ? 'fill-text font-bold' : 'fill-text-2'} ${d.future ? 'opacity-40' : ''}`}
                  >
                    {LETTERS[i]}
                  </text>
                </g>
              )
            })}
            <line x1={0} x2={width} y1={y(goal)} y2={y(goal)} className="stroke-text-2" strokeWidth={1} />
            <text x={width} y={y(goal) - 5} textAnchor="end" className="fill-text-2 text-[11px] tabular">
              Meta {formatInt(goal)}
            </text>
          </svg>
        )}
        {/* One hit target per day, the full column height: easier than aiming at a bar. */}
        <div className="absolute inset-0 grid grid-cols-7">
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              disabled={d.future}
              aria-label={`${dayName.format(fromISODate(d.date))}: ${d.logged ? `${formatInt(d.kcal)} kcal` : 'sin registros'}`}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((a) => (a === i ? null : i))}
              className="h-full rounded-inner outline-none focus-visible:bg-fill/60"
            />
          ))}
        </div>
      </div>

      {sel && (
        <div
          className="pointer-events-none absolute -top-2 z-10 w-max -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-inner bg-card px-3 py-2 shadow-card ring-1 ring-separator"
          style={{ left: Math.min(Math.max(slot * (active ?? 0) + slot / 2, 64), Math.max(width - 64, 64)) }}
          aria-live="polite"
        >
          <p className="text-label text-text-2 first-letter:uppercase">{dayName.format(fromISODate(sel.date)).replace('.', '')}</p>
          <p className="text-secondary font-bold tabular">{sel.logged ? `${formatInt(sel.kcal)} kcal` : 'Sin registros'}</p>
          {sel.logged && goal > 0 && (
            <p className="text-label text-text-2 tabular">{Math.round((sel.kcal / goal) * 100)}% de la meta</p>
          )}
        </div>
      )}

      <div className="sr-only">
        <table>
          <caption>Calorías por día</caption>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{dayName.format(fromISODate(d.date))}</th>
                <td>{d.logged ? `${formatInt(d.kcal)} kcal` : 'sin registros'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
