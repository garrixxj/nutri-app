import type { ComponentType } from 'react'
import { IconCalendar, IconChart, IconGear, IconPlus, IconToday } from '../components/icons.tsx'
import { navigate } from './router.ts'

interface Tab {
  path: string
  label: string
  Icon: ComponentType<{ size?: number }>
}

const LEFT: Tab[] = [
  { path: '/', label: 'Hoy', Icon: IconToday },
  { path: '/historial', label: 'Historial', Icon: IconCalendar },
]
const RIGHT: Tab[] = [
  { path: '/progreso', label: 'Progreso', Icon: IconChart },
  { path: '/ajustes', label: 'Ajustes', Icon: IconGear },
]

export function TabBar({ current, onRegister }: { current: string; onRegister: () => void }) {
  const renderTab = ({ path, label, Icon }: Tab) => {
    const active = current === path
    return (
      <button
        key={path}
        type="button"
        onClick={() => navigate(path, { replace: true })}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-11 flex-col items-center justify-center gap-0.5 pt-1.5 text-label leading-4 font-medium transition-colors duration-150 ease-out ${active ? 'text-accent' : 'text-text-2'}`}
      >
        <Icon size={24} />
        {label}
      </button>
    )
  }

  return (
    <nav
      aria-label="Principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-[color-mix(in_srgb,var(--card)_86%,transparent)] backdrop-blur-xl"
    >
      <div className="mx-auto grid h-[58px] max-w-md grid-cols-5 items-start">
        {LEFT.map(renderTab)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onRegister}
            className="-mt-4 flex flex-col items-center gap-0.5 text-label leading-4 font-semibold text-accent"
          >
            <span className="flex size-13 items-center justify-center rounded-full bg-accent text-white shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_40%,transparent)] transition-transform duration-150 ease-out active:scale-95">
              <IconPlus size={28} strokeWidth={2.4} />
            </span>
            Registrar
          </button>
        </div>
        {RIGHT.map(renderTab)}
      </div>
    </nav>
  )
}
