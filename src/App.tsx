import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import { RegisterSheet, type RegisterKind } from './app/RegisterSheet.tsx'
import { TAB_PATHS, navigate, useRoute } from './app/router.ts'
import { TabBar } from './app/TabBar.tsx'
import { db } from './db/db.ts'
import { PROFILE_ID } from './db/types.ts'
import { Placeholder } from './screens/Placeholder.tsx'
import { ProfileFlow } from './screens/ProfileFlow.tsx'

const REGISTER_PATHS: Partial<Record<RegisterKind, string>> = {
  manual: '/registrar/manual',
}

export default function App() {
  // undefined while loading, null when there is no profile yet.
  const profile = useLiveQuery(async () => (await db.profile.get(PROFILE_ID)) ?? null, [])
  if (profile === undefined) return null
  if (profile === null) return <ProfileFlow mode="onboarding" onDone={() => navigate('/', { replace: true })} />
  return <Shell />
}

function Shell() {
  const { path } = useRoute()
  const [registerOpen, setRegisterOpen] = useState(false)
  const closeRegister = useCallback(() => setRegisterOpen(false), [])

  const isTab = (TAB_PATHS as readonly string[]).includes(path)

  let screen
  switch (path) {
    case '/historial':
      screen = <Placeholder title="Historial" message="Aquí vas a ver lo que comiste cada día." />
      break
    case '/progreso':
      screen = <Placeholder title="Progreso" message="Peso, gráfico y resumen semanal llegan en la próxima fase." />
      break
    case '/ajustes':
      screen = <Placeholder title="Ajustes" message="API key, metas y respaldo." />
      break
    default:
      screen = <Placeholder title="Hoy" message="Tu resumen del día." />
  }

  return (
    <>
      {screen}
      {isTab && <TabBar current={path} onRegister={() => setRegisterOpen(true)} />}
      <RegisterSheet
        open={registerOpen}
        onClose={closeRegister}
        onPick={(kind) => {
          setRegisterOpen(false)
          const to = REGISTER_PATHS[kind]
          if (to) navigate(to)
        }}
      />
    </>
  )
}
