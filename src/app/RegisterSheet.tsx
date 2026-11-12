import type { ComponentType } from 'react'
import { IconCamera, IconEdit, IconStar, IconText } from '../components/icons.tsx'
import { Sheet } from '../components/Sheet.tsx'

export type RegisterKind = 'photo' | 'text' | 'manual' | 'favorite'

interface Option {
  kind: RegisterKind
  title: string
  subtitle: string
  Icon: ComponentType<{ size?: number }>
}

const OPTIONS: Option[] = [
  { kind: 'photo', title: 'Foto', subtitle: 'Saca una foto de tu plato', Icon: IconCamera },
  { kind: 'text', title: 'Describir', subtitle: 'Escribe lo que comiste', Icon: IconText },
  { kind: 'manual', title: 'Manual', subtitle: 'Ingresa los valores tú mismo', Icon: IconEdit },
  { kind: 'favorite', title: 'Favoritos', subtitle: 'Tus comidas guardadas', Icon: IconStar },
]

/** Options not wired up yet in this build. */
const UNAVAILABLE: Partial<Record<RegisterKind, string>> = {
  favorite: 'Próximamente',
}

export function RegisterSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (kind: RegisterKind) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Registrar comida" showTitle>
      <ul className="flex flex-col gap-2">
        {OPTIONS.map(({ kind, title, subtitle, Icon }) => {
          const badge = UNAVAILABLE[kind]
          return (
            <li key={kind}>
              <button
                type="button"
                disabled={badge !== undefined}
                onClick={() => onPick(kind)}
                className="flex min-h-16 w-full items-center gap-3 rounded-inner bg-fill px-3 py-2.5 text-left transition-transform duration-150 ease-out active:scale-[0.98] disabled:active:scale-100"
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full ${badge ? 'bg-text-2/12 text-text-2' : 'bg-card text-text shadow-card'}`}
                >
                  <Icon size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-body font-semibold ${badge ? 'text-text-2' : ''}`}>{title}</span>
                  <span className="block text-secondary text-text-2">{subtitle}</span>
                </span>
                {badge && (
                  <span className="rounded-full bg-text-2/12 px-2.5 py-1 text-label font-medium text-text-2">{badge}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
