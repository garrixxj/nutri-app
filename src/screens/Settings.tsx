import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { navigate } from '../app/router.ts'
import { usageToday } from '../db/ai-usage.ts'
import { db, getSettings, saveProfile, updateSettings } from '../db/db.ts'
import { BackupError, parseBackup, type ParsedBackup } from '../db/backup.ts'
import { buildBackup, markBackupExported, restoreBackup } from '../db/backup-store.ts'
import { DEFAULT_GEMINI_MODEL, type Profile, type Settings as SettingsData, type Targets } from '../db/types.ts'
import { MacroLabel, NumberRow, RowGroup } from '../components/fields.tsx'
import { IconChevronRight } from '../components/icons.tsx'
import { Button, ScreenHeader, SectionTitle, TabScreen } from '../components/ui.tsx'
import { formatDateTime, relativeDay, toISODate } from '../domain/dates.ts'
import { formatInt, formatDecimal, parseDecimal } from '../domain/format.ts'
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS } from '../domain/labels.ts'
import { calculateTargets } from '../domain/targets.ts'
import { WATER_ML_PER_KG, waterGoalMl } from '../domain/water.ts'
import { shareOrDownloadBackup } from '../lib/backup-file.ts'
import { useToday } from '../lib/useToday.ts'

export function Settings({ profile }: { profile: Profile }) {
  const settings = useLiveQuery(() => getSettings(), [])
  const targetsKey = JSON.stringify(profile.targets)

  return (
    <TabScreen>
      <ScreenHeader title="Ajustes" />
      {settings && <AiSection key={`${settings.geminiApiKey}|${settings.geminiModel}`} settings={settings} />}
      <TargetsSection key={targetsKey} profile={profile} />
      <WaterGoalSection key={`water-${waterGoalMl(profile)}`} profile={profile} />
      <ProfileSection profile={profile} />
      <BackupSection lastBackupAt={settings?.lastBackupAt} />
      <StorageSection />
      <p className="px-4 pt-8 text-center text-label text-text-2">Nutri · versión del {formatDateTime(__BUILD_TIME__)}</p>
    </TabScreen>
  )
}

function Footnote({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'error' }) {
  const color = tone === 'error' ? 'text-danger' : tone === 'ok' ? 'text-accent' : 'text-text-2'
  return (
    <p className={`px-4 pt-2 text-label ${color}`} role={tone === 'muted' ? undefined : 'status'}>
      {children}
    </p>
  )
}

/* ─────────────── IA ─────────────── */

function AiSection({ settings }: { settings: SettingsData }) {
  const [apiKey, setApiKey] = useState(settings.geminiApiKey)
  const [model, setModel] = useState(settings.geminiModel)
  const [showKey, setShowKey] = useState(false)
  const keyId = useId()
  const modelId = useId()

  const dirty = apiKey.trim() !== settings.geminiApiKey || (model.trim() || DEFAULT_GEMINI_MODEL) !== settings.geminiModel

  async function save() {
    await updateSettings({ geminiApiKey: apiKey.trim(), geminiModel: model.trim() || DEFAULT_GEMINI_MODEL })
  }

  return (
    <>
      <SectionTitle>Inteligencia artificial</SectionTitle>
      <RowGroup>
        <div className="flex min-h-12 items-center gap-2 pl-4">
          <label htmlFor={keyId} className="shrink-0 text-body">
            API key
          </label>
          <input
            id={keyId}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Pega tu key de Gemini"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2 text-right text-body outline-none placeholder:text-text-2/60"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="min-h-11 shrink-0 px-3 text-secondary font-medium text-accent"
          >
            {showKey ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <div className="flex min-h-12 items-center justify-between px-4">
          <span className="text-body">Análisis con IA hoy</span>
          <span className="text-body font-semibold tabular">{formatInt(usageToday(settings))}</span>
        </div>
        <div className="flex min-h-12 items-center gap-2 px-4">
          <label htmlFor={modelId} className="shrink-0 text-body">
            Modelo
          </label>
          <input
            id={modelId}
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_GEMINI_MODEL}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2 text-right text-body outline-none placeholder:text-text-2/60"
          />
        </div>
      </RowGroup>
      <Footnote>
        El contador se reinicia junto con la cuota gratis de Google (medianoche en California, entre las 3 y las 5 de la
        mañana en Chile). Tu límite diario aparece en Google AI Studio.
      </Footnote>
      <Footnote>
        La key se guarda solo en este teléfono y nunca va en el respaldo. Créala gratis en{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-medium text-accent">
          Google AI Studio
        </a>
        .
      </Footnote>
      <div className="flex gap-2 px-4 pt-3">
        <Button className="flex-1" disabled={!dirty} onClick={save}>
          {dirty || !settings.geminiApiKey ? 'Guardar' : 'Guardado'}
        </Button>
        {model.trim() !== DEFAULT_GEMINI_MODEL && (
          <Button variant="secondary" onClick={() => setModel(DEFAULT_GEMINI_MODEL)}>
            Modelo por defecto
          </Button>
        )}
      </div>
    </>
  )
}

/* ─────────────── Metas ─────────────── */

type TargetKey = keyof Targets

const TARGET_ROWS: { key: TargetKey; label: ReactNode; suffix: string }[] = [
  { key: 'kcal', label: 'Calorías', suffix: 'kcal' },
  { key: 'protein', label: <MacroLabel color="bg-protein" text="Proteína" />, suffix: 'g' },
  { key: 'carbs', label: <MacroLabel color="bg-carbs" text="Carbohidratos" />, suffix: 'g' },
  { key: 'fat', label: <MacroLabel color="bg-fat" text="Grasa" />, suffix: 'g' },
]

function TargetsSection({ profile }: { profile: Profile }) {
  const [values, setValues] = useState<Record<TargetKey, string>>({
    kcal: String(profile.targets.kcal),
    protein: String(profile.targets.protein),
    carbs: String(profile.targets.carbs),
    fat: String(profile.targets.fat),
  })
  const [error, setError] = useState<string | null>(null)

  const recommended = calculateTargets(profile)
  const parsed = parseTargetValues(values)
  const dirty = parsed === null || TARGET_ROWS.some(({ key }) => parsed[key] !== profile.targets[key])
  const differsFromRecommended = TARGET_ROWS.some(({ key }) => profile.targets[key] !== recommended[key])

  async function save(next: Targets) {
    const same = TARGET_ROWS.every(({ key }) => next[key] === recommended[key])
    await saveProfile({ ...profile, targets: next, targetsEdited: !same })
  }

  function onSave() {
    if (!parsed) {
      setError('Revisa las metas: deben ser números y las calorías al menos 800.')
      return
    }
    setError(null)
    void save(parsed)
  }

  return (
    <>
      <SectionTitle>Metas diarias</SectionTitle>
      <RowGroup>
        {TARGET_ROWS.map(({ key, label, suffix }) => (
          <NumberRow
            key={key}
            label={label}
            value={values[key]}
            onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
            suffix={suffix}
            decimals={false}
          />
        ))}
      </RowGroup>
      {error && <Footnote tone="error">{error}</Footnote>}
      {(dirty || differsFromRecommended) && (
        <div className="flex gap-2 px-4 pt-3">
          {dirty && (
            <Button className="flex-1" onClick={onSave}>
              Guardar metas
            </Button>
          )}
          {!dirty && differsFromRecommended && (
            <Button variant="secondary" className="flex-1" onClick={() => void save(recommended)}>
              Usar recomendadas ({formatInt(recommended.kcal)} kcal)
            </Button>
          )}
        </div>
      )}
    </>
  )
}

function parseTargetValues(v: Record<TargetKey, string>): Targets | null {
  const out: Partial<Targets> = {}
  for (const { key } of TARGET_ROWS) {
    const n = parseDecimal(v[key])
    if (n === null) return null
    out[key] = Math.round(n)
  }
  const t = out as Targets
  return t.kcal >= 800 ? t : null
}

function WaterGoalSection({ profile }: { profile: Profile }) {
  const current = waterGoalMl(profile)
  const [value, setValue] = useState(String(current))
  const [error, setError] = useState<string | null>(null)
  const parsed = parseDecimal(value)
  const dirty = parsed === null || Math.round(parsed) !== current

  function onSave() {
    if (parsed === null || parsed < 500 || parsed > 10_000) {
      setError('La meta de agua debe estar entre 500 y 10.000 ml.')
      return
    }
    setError(null)
    void saveProfile({ ...profile, waterGoalMl: Math.round(parsed) })
  }

  return (
    <>
      <div className="pt-3">
        <RowGroup>
          <NumberRow
            label={<MacroLabel color="bg-water" text="Agua" />}
            value={value}
            onChange={setValue}
            suffix="ml"
            decimals={false}
          />
        </RowGroup>
      </div>
      {error && <Footnote tone="error">{error}</Footnote>}
      {!error && profile.waterGoalMl === undefined && !dirty && (
        <Footnote>Calculada con {WATER_ML_PER_KG} ml por kg de peso. Cámbiala si quieres.</Footnote>
      )}
      {dirty && (
        <div className="px-4 pt-3">
          <Button className="w-full" onClick={onSave}>
            Guardar meta de agua
          </Button>
        </div>
      )}
    </>
  )
}

/* ─────────────── Mis datos ─────────────── */

function ProfileSection({ profile }: { profile: Profile }) {
  const sex = SEX_OPTIONS.find((o) => o.value === profile.sex)?.label
  const activity = ACTIVITY_OPTIONS.find((o) => o.value === profile.activityLevel)?.label
  const goal = GOAL_OPTIONS.find((o) => o.value === profile.goal)?.label
  return (
    <>
      <SectionTitle>Mis datos</SectionTitle>
      <RowGroup>
        <button
          type="button"
          onClick={() => navigate('/ajustes/perfil')}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-text-2/8"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-body">
              {sex} · {profile.age} años · {formatDecimal(profile.heightCm)} cm · {formatDecimal(profile.weightKg)} kg
            </span>
            <span className="block text-secondary text-text-2">
              {activity} · {goal}
            </span>
          </span>
          <IconChevronRight size={20} className="shrink-0 text-text-2" />
        </button>
      </RowGroup>
      <Footnote>Si cambias tus datos, recalculo las metas.</Footnote>
    </>
  )
}

/* ─────────────── Respaldo ─────────────── */

function BackupSection({ lastBackupAt }: { lastBackupAt: number | undefined }) {
  const today = useToday()
  const entryCount = useLiveQuery(() => db.entries.count(), []) ?? 0
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)

  async function onExport() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await shareOrDownloadBackup(await buildBackup())
      if (result !== 'cancelled') {
        await markBackupExported()
        setMessage({ text: 'Respaldo listo. Guárdalo en Archivos o en iCloud Drive.', tone: 'ok' })
      }
    } catch {
      setMessage({ text: 'No pude crear el respaldo. Inténtalo de nuevo.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMessage(null)
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      setMessage({
        text: err instanceof BackupError ? err.message : 'No pude leer el archivo.',
        tone: 'error',
      })
    }
  }

  async function confirmRestore() {
    if (!pending) return
    setBusy(true)
    try {
      await restoreBackup(pending)
      setMessage({ text: `Listo: restauré ${pending.entries.length} comidas.`, tone: 'ok' })
      setPending(null)
    } catch {
      setMessage({ text: 'No pude restaurar el respaldo. Tus datos no cambiaron.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const last = lastBackupAt ? relativeDay(toISODate(new Date(lastBackupAt)), today) : null

  return (
    <>
      <SectionTitle>Respaldo</SectionTitle>
      <div className="flex gap-2 px-4">
        <Button variant="secondary" className="flex-1" onClick={onExport} disabled={busy}>
          Exportar
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
          Importar
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      </div>
      <Footnote>
        {last ? `Último respaldo: ${last}.` : 'Aún no has hecho un respaldo.'} Tienes {formatInt(entryCount)}{' '}
        {entryCount === 1 ? 'comida registrada' : 'comidas registradas'}.
      </Footnote>

      {pending && (
        <div className="mx-4 mt-3 rounded-card bg-card p-4 shadow-card" role="alertdialog" aria-label="Confirmar restauración">
          <p className="text-body font-semibold">¿Reemplazar tus datos?</p>
          <p className="mt-1 text-secondary text-text-2">
            Se borran tus {formatInt(entryCount)} comidas actuales y quedan las {formatInt(pending.entries.length)} del respaldo
            {pending.exportedAt ? ` (${formatDateTime(pending.exportedAt)})` : ''}.
            {!pending.profile && ' El respaldo no trae tus datos personales, así que tendrás que completarlos de nuevo.'}
            {pending.fromVersion < 2 && ' Es un respaldo antiguo: no trae favoritos, agua ni peso, así que esos quedarán vacíos.'} Tu
            API key no cambia.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="danger" className="flex-1" onClick={confirmRestore} disabled={busy}>
              Reemplazar
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {message && <Footnote tone={message.tone}>{message.text}</Footnote>}
    </>
  )
}

/* ─────────────── Almacenamiento ─────────────── */

function StorageSection() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    navigator.storage
      ?.persisted?.()
      .then((p) => alive && setPersisted(p))
      .catch(() => alive && setPersisted(false))
    return () => {
      alive = false
    }
  }, [])

  if (persisted === null) return null
  return (
    <>
      <SectionTitle>Almacenamiento</SectionTitle>
      <RowGroup>
        <div className="flex min-h-12 items-center justify-between px-4">
          <span className="text-body">Protección contra borrado</span>
          <span className={`text-body font-medium ${persisted ? 'text-accent' : 'text-text-2'}`}>
            {persisted ? 'Activa' : 'No garantizada'}
          </span>
        </div>
      </RowGroup>
      {!persisted && <Footnote>Safari podría borrar datos si falta espacio. Exporta un respaldo de vez en cuando.</Footnote>}
    </>
  )
}
