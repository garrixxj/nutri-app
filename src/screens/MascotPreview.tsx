import { useState, type CSSProperties } from 'react'
import { Koala } from '../components/mascot/Koala.tsx'
import { KOALA_STATES, type KoalaState } from '../components/mascot/states.ts'
import { Button, Card, FlowHeader, Segmented } from '../components/ui.tsx'
import { goBack } from '../app/router.ts'

const STATE_LABELS: Record<KoalaState, { title: string; when: string }> = {
  idle: { title: 'En reposo', when: 'Por defecto: respira y parpadea' },
  cheer: { title: 'Saludo', when: 'Al tocarlo o al abrir Hoy' },
  eat: { title: 'Comiendo', when: 'Recién guardaste una comida' },
  celebrate: { title: 'Celebración', when: 'Cumpliste la meta de kcal o proteína' },
  sleep: { title: 'Sueño', when: 'Sin registros hoy' },
  worried: { title: 'Preocupado', when: 'Más del 115 % de kcal, desde las 18:00 o con la cena' },
}

/** Dark tokens from DESIGN.md, to preview without changing the system setting. */
const DARK: CSSProperties = {
  ['--bg' as string]: '#121316',
  ['--card' as string]: '#1d1e22',
  ['--fill' as string]: '#2a2b30',
  ['--text' as string]: '#f2f1f6',
  ['--text-2' as string]: '#a4a5ad',
  ['--ink' as string]: '#f2f1f6',
  ['--on-ink' as string]: '#121316',
  ['--card-shadow' as string]: 'none',
}

const THEMES = [
  { value: 'system', label: 'Sistema' },
  { value: 'dark', label: 'Oscuro' },
] as const
const MOTION = [
  { value: 'full', label: 'Con movimiento' },
  { value: 'still', label: 'Reducido' },
] as const

/** Hidden page (#/mascot-preview) to check every koala state before using it in the app. */
export function MascotPreview() {
  const [theme, setTheme] = useState<'system' | 'dark'>('system')
  const [motion, setMotion] = useState<'full' | 'still'>('full')
  const [runs, setRuns] = useState<Record<KoalaState, number>>(() => Object.fromEntries(KOALA_STATES.map((s) => [s, 0])) as Record<KoalaState, number>)
  const [live, setLive] = useState<KoalaState>('idle')
  const still = motion === 'still'

  return (
    <div style={theme === 'dark' ? DARK : undefined} className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-md pb-16">
        <FlowHeader title="Mascota" onBack={() => goBack('/')} />
        <div className="flex flex-col gap-3 px-4">
          <Segmented label="Tema" options={THEMES} value={theme} onChange={setTheme} />
          <Segmented label="Movimiento" options={MOTION} value={motion} onChange={setMotion} />

          <h2 className="mt-3 text-[18px] leading-6 font-bold tracking-tight">Estados</h2>
          <div className="grid grid-cols-2 gap-3">
            {KOALA_STATES.map((s) => (
              <Card key={s} className="flex flex-col items-center px-3 pt-4 pb-3 text-center">
                <Koala key={runs[s]} state={s} size={150} still={still} />
                <p className="mt-2 text-body font-semibold">{STATE_LABELS[s].title}</p>
                <p className="mt-0.5 min-h-10 text-label text-text-2">{STATE_LABELS[s].when}</p>
                <Button variant="secondary" className="mt-2 min-h-11 w-full text-secondary" onClick={() => setRuns((r) => ({ ...r, [s]: r[s] + 1 }))}>
                  Repetir
                </Button>
              </Card>
            ))}
          </div>

          <h2 className="mt-3 text-[18px] leading-6 font-bold tracking-tight">Cambio de estado</h2>
          <Card className="flex flex-col items-center gap-3 p-4">
            <Koala state={live} size={220} still={still} />
            <div className="grid w-full grid-cols-3 gap-2">
              {KOALA_STATES.map((s) => (
                <Button key={s} variant={s === live ? 'primary' : 'secondary'} className="min-h-11 px-2 text-secondary" onClick={() => setLive(s)}>
                  {STATE_LABELS[s].title}
                </Button>
              ))}
            </div>
          </Card>

          <h2 className="mt-3 text-[18px] leading-6 font-bold tracking-tight">Tamaños</h2>
          <Card className="flex items-end justify-around gap-2 p-4">
            {[64, 96, 120].map((px) => (
              <div key={px} className="flex flex-col items-center gap-1">
                <Koala state={live} size={px} still={still} />
                <span className="text-label text-text-2 tabular">{px} px</span>
              </div>
            ))}
          </Card>
        </div>
      </main>
    </div>
  )
}
