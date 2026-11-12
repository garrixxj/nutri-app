import type { ComponentType } from 'react'
import { IconCalendar, IconCamera, IconChart, IconGear, IconToday } from '../components/icons.tsx'
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
        className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-label font-semibold transition-colors duration-150 ease-out ${active ? 'text-accent' : 'text-text-2'}`}
      >
        <Icon size={24} />
        {label}
      </button>
    )
  }

  return (
    <nav aria-label="Principal" className="tabbar-offset pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4">
      <div className="pointer-events-auto mx-auto grid h-16 max-w-md grid-cols-5 items-center rounded-full bg-[color-mix(in_srgb,var(--card)_90%,transparent)] px-1 shadow-[0_8px_30px_rgb(28_29_33/0.10)] ring-1 ring-separator backdrop-blur-xl">
        {LEFT.map(renderTab)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onRegister}
            aria-label="Registrar comida"
            className="-mt-7 flex size-15 items-center justify-center rounded-full bg-ink text-on-ink shadow-[0_6px_18px_rgb(28_29_33/0.28)] ring-4 ring-bg transition-transform duration-150 ease-out active:scale-95"
          >
            <IconCamera size={26} strokeWidth={2.1} />
          </button>
        </div>
        {RIGHT.map(renderTab)}
      </div>
    </nav>
  )
}
