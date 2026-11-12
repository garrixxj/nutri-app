import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { RegisterSheet, type RegisterKind } from './app/RegisterSheet.tsx'
import { TAB_PATHS, goBack, navigate, useRoute } from './app/router.ts'
import { TabBar } from './app/TabBar.tsx'
import { db, retryRead } from './db/db.ts'
import { PROFILE_ID, type Meal, type Profile } from './db/types.ts'
import { setPendingPhoto } from './lib/photo-handoff.ts'
import { Analyze } from './screens/Analyze.tsx'
import { EditEntry } from './screens/EditEntry.tsx'
import { Favorites } from './screens/Favorites.tsx'
import { History } from './screens/History.tsx'
import { ManualEntry } from './screens/ManualEntry.tsx'
import { MascotPreview } from './screens/MascotPreview.tsx'
import { Progress } from './screens/Progress.tsx'
import { Settings } from './screens/Settings.tsx'
import { ProfileFlow } from './screens/ProfileFlow.tsx'
import { Today } from './screens/Today.tsx'

const REGISTER_PATHS: Partial<Record<RegisterKind, string>> = {
  photo: '/registrar/foto',
  text: '/registrar/describir',
  manual: '/registrar/manual',
  favorite: '/registrar/favoritos',
}

interface RegisterState {
  open: boolean
  meal?: Meal
  /** YYYY-MM-DD when registering on a past day from Historial. */
  date?: string
}

function registerPath(kind: RegisterKind, { meal, date }: RegisterState): string | null {
  const base = REGISTER_PATHS[kind]
  if (!base) return null
  const q = new URLSearchParams()
  if (meal) q.set('meal', meal)
  if (date) q.set('date', date)
  const query = q.toString()
  return query ? `${base}?${query}` : base
}

export default function App() {
  // undefined while loading, null when there is no profile yet.
  const profile = useLiveQuery(() => retryRead(async () => (await db.profile.get(PROFILE_ID)) ?? null), [])
  const { path } = useRoute()
  if (path === '/mascot-preview') return <MascotPreview />
  if (profile === undefined) return null
  if (profile === null) return <ProfileFlow mode="onboarding" onDone={() => navigate('/', { replace: true })} />
  return <Shell profile={profile} />
}

function Shell({ profile }: { profile: Profile }) {
  const { path, params } = useRoute()
  const [register, setRegister] = useState<RegisterState>({ open: false })
  const openRegister = useCallback((meal?: Meal, date?: string) => setRegister({ open: true, meal, date }), [])
  const closeRegister = useCallback(() => setRegister((r) => ({ ...r, open: false })), [])
  const cameraRef = useRef<HTMLInputElement>(null)

  function onCameraPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingPhoto(file)
    const to = registerPath('photo', register)
    if (to) navigate(to)
  }

  const isTab = (TAB_PATHS as readonly string[]).includes(path)

  let screen
  switch (path) {
    case '/editar':
      screen = <EditEntry id={params.get('id')} />
      break
    case '/registrar/foto':
      screen = <Analyze key="photo" mode="photo" params={params} />
      break
    case '/registrar/describir':
      screen = <Analyze key="text" mode="text" params={params} />
      break
    case '/registrar/favoritos':
      screen = <Favorites params={params} />
      break
    case '/registrar/manual':
      screen = <ManualEntry params={params} />
      break
    case '/historial':
      screen = <History profile={profile} params={params} onRegister={openRegister} />
      break
    case '/progreso':
      screen = <Progress profile={profile} />
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
          // Open the camera inside this tap; iOS blocks it after a navigation.
          if (kind === 'photo') cameraRef.current?.click()
          closeRegister()
          const to = registerPath(kind, register)
          if (to && kind !== 'photo') navigate(to)
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onCameraPhoto}
      />
    </>
  )
}
