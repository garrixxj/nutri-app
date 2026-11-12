import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconChevronLeft } from './icons.tsx'

export function ScreenHeader({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: ReactNode }) {
  return (
    <header className="safe-top px-4">
      <div className="flex min-h-14 items-end justify-between gap-3 pt-3 pb-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-label font-semibold tracking-wide text-text-2 uppercase">{eyebrow}</p>}
          <h1 className="text-[28px] leading-9 font-bold tracking-tight">{title}</h1>
        </div>
        {right}
      </div>
    </header>
  )
}

/** Content area of a tab screen; leaves room for the fixed tab bar. */
export function TabScreen({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+112px)]">{children}</main>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card bg-card shadow-card ${className}`}>{children}</section>
}

type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'danger'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-on-ink font-semibold disabled:opacity-40',
  secondary: 'bg-fill text-text font-semibold disabled:opacity-40',
  plain: 'text-accent font-medium disabled:opacity-40',
  danger: 'bg-danger/12 text-danger font-semibold disabled:opacity-40',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-13 items-center justify-center gap-2 rounded-button px-4 text-body transition-[opacity,transform] duration-150 ease-out active:scale-[0.98] ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

/** Round icon button (back, close), 44x44. `onImage` adds a frosted backdrop for use over photos. */
export function CircleButton({
  label,
  onImage = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; onImage?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full text-text transition-transform duration-150 ease-out active:scale-90 ${onImage ? 'bg-[color-mix(in_srgb,var(--card)_80%,transparent)] shadow-card backdrop-blur-md' : 'bg-card shadow-card'} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Header for full-screen flows: back button and title on one row. */
export function FlowHeader({ title, onBack, backLabel = 'Volver' }: { title: string; onBack: () => void; backLabel?: string }) {
  return (
    <header className="safe-top px-4">
      <div className="flex min-h-14 items-center gap-3 pt-2 pb-2">
        <CircleButton label={backLabel} onClick={onBack}>
          <IconChevronLeft size={22} strokeWidth={2.2} />
        </CircleButton>
        <h1 className="min-w-0 truncate text-title font-bold tracking-tight">{title}</h1>
      </div>
    </header>
  )
}

/** Fixed bottom action area for full-screen flows (no tab bar). */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl">
      <div className="mx-auto max-w-md px-4 pt-3 pb-3">{children}</div>
    </div>
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentedOption<T>[]
  value: T | null
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-fill p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-10 flex-1 rounded-full px-2 text-secondary font-semibold transition-colors duration-150 ease-out ${active ? 'bg-card text-text shadow-[0_1px_3px_rgb(0_0_0/0.10)]' : 'text-text-2'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-4 pt-6 pb-2 text-[18px] leading-6 font-bold tracking-tight">{children}</h2>
}
