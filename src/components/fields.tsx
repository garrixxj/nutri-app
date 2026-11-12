import { useId, type ReactNode } from 'react'

/** Grouped-list row with a right-aligned numeric input (iOS settings style). */
export function NumberRow({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  invalid = false,
  decimals = true,
}: {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  suffix?: string
  placeholder?: string
  invalid?: boolean
  decimals?: boolean
}) {
  const id = useId()
  return (
    <div className="flex min-h-12 items-center gap-3 px-4">
      <label htmlFor={id} className="flex-1 text-body">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        enterKeyHint="done"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        className={`w-24 min-w-0 bg-transparent py-2 text-right text-body tabular outline-none placeholder:text-text-2/60 ${invalid ? 'text-danger' : ''}`}
      />
      {suffix !== undefined && <span className="w-9 shrink-0 text-secondary text-text-2">{suffix}</span>}
    </div>
  )
}

/** Card holding rows separated by hairlines. */
export function RowGroup({ children }: { children: ReactNode }) {
  return (
    <div className="mx-4 divide-y divide-separator overflow-hidden rounded-card bg-card shadow-card">{children}</div>
  )
}

/** Selectable row with a check mark, for single-choice lists. */
export function ChoiceRow({
  label,
  detail,
  selected,
  onSelect,
}: {
  label: string
  detail?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-body">{label}</span>
        {detail && <span className="block text-secondary text-text-2">{detail}</span>}
      </span>
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ease-out ${selected ? 'border-accent bg-accent text-white' : 'border-text-2/40'}`}
        aria-hidden="true"
      >
        {selected && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
    </button>
  )
}
