import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import { RegisterSheet, type RegisterKind } from './app/RegisterSheet.tsx'
import { TAB_PATHS, goBack, navigate, useRoute } from './app/router.ts'
import { TabBar } from './app/TabBar.tsx'
import { db } from './db/db.ts'
import { PROFILE_ID, type Meal, type Profile } from './db/types.ts'
import { ManualEntry } from './screens/ManualEntry.tsx'
import { Placeholder } from './screens/Placeholder.tsx'
import { Settings } from './screens/Settings.tsx'
import { ProfileFlow } from './screens/ProfileFlow.tsx'
import { Today } from './screens/Today.tsx'

const REGISTER_PATHS: Partial<Record<RegisterKind, string>> = {
  manual: '/registrar/manual',
}

export default function App() {
  // undefined while loading, null when there is no profile yet.
  const profile = useLiveQuery(async () => (await db.profile.get(PROFILE_ID)) ?? null, [])
  if (profile === undefined) return null
  if (profile === null) return <ProfileFlow mode="onboarding" onDone={() => navigate('/', { replace: true })} />
  return <Shell profile={profile} />
}

function Shell({ profile }: { profile: Profile }) {
  const { path, params } = useRoute()
  const [register, setRegister] = useState<{ open: boolean; meal?: Meal }>({ open: false })
  const openRegister = useCallback((meal?: Meal) => setRegister({ open: true, meal }), [])
  const closeRegister = useCallback(() => setRegister((r) => ({ ...r, open: false })), [])

  const isTab = (TAB_PATHS as readonly string[]).includes(path)

  let screen
  switch (path) {
    case '/registrar/manual':
      screen = <ManualEntry params={params} />
      break
    case '/historial':
      screen = <Placeholder title="Historial" message="Aquí vas a ver lo que comiste cada día." />
      break
    case '/progreso':
      screen = <Placeholder title="Progreso" message="Peso, gráfico y resumen semanal llegan en la próxima fase." />
      break
    case '/ajustes':
      screen = <Settings profile={profile} />
      break
    case '/ajustes/perfil':
      screen = <ProfileFlow mode="edit" profile={profile} onDone={() => goBack('/ajustes')} />
      break
    default:
      screen = <Today profile={profile} onRegister={openRegister} />
  }

  return (
    <>
      {screen}
      {isTab && <TabBar current={path} onRegister={() => openRegister()} />}
      <RegisterSheet
        open={register.open}
        onClose={closeRegister}
        onPick={(kind) => {
          closeRegister()
          const to = REGISTER_PATHS[kind]
          if (to) navigate(register.meal ? `${to}?meal=${register.meal}` : to)
        }}
      />
    </>
  )
}
