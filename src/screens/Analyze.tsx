import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { AiError, aiError, type ModelAttempt } from '../ai/errors.ts'
import { analyzeMeal, type ModelAnalysis } from '../ai/gemini.ts'
import { goBack, navigate } from '../app/router.ts'
import { recordAiUsage } from '../db/ai-usage.ts'
import { db, getSettings } from '../db/db.ts'
import type { Meal } from '../db/types.ts'
import { IconCamera } from '../components/icons.tsx'
import { PhotoHero } from '../components/PhotoHero.tsx'
import { BottomBar, Button, Card, FlowHeader } from '../components/ui.tsx'
import { toISODate } from '../domain/dates.ts'
import { isMeal, mealForHour } from '../domain/meals.ts'
import { newId } from '../lib/id.ts'
import { PhotoError, preparePhoto, type PreparedPhoto } from '../lib/image.ts'
import { clearPendingPhoto, getPendingPhoto } from '../lib/photo-handoff.ts'
import { Review } from './Review.tsx'

type Mode = 'photo' | 'text'
type Phase = 'compose' | 'loading' | 'review' | 'error'

const MAX_TEXT = 500

interface Shot {
  file: File
  prepared: PreparedPhoto | null
  error: string | null
}

export function Analyze({ mode, params }: { mode: Mode; params: URLSearchParams }) {
  const [meal] = useState<Meal>(() => {
    const m = params.get('meal')
    return isMeal(m) ? m : mealForHour(new Date().getHours())
  })
  const [date] = useState(() => {
    const d = params.get('date')
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : toISODate(new Date())
  })

  const [shot, setShot] = useState<Shot | null>(() => {
    const pending = mode === 'photo' ? getPendingPhoto() : null
    return pending ? { file: pending, prepared: null, error: null } : null
  })
  const photo = shot?.prepared ?? null
  const photoError = shot?.error ?? null
  const previewUrl = photo ? `data:image/jpeg;base64,${photo.aiBase64}` : null
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('compose')
  const [result, setResult] = useState<ModelAnalysis | null>(null)
  /** Model being tried, once the first one failed (shown while loading). */
  const [fallbackModel, setFallbackModel] = useState<string | null>(null)
  const [error, setError] = useState<AiError | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const textId = useId()

  // Resize + thumbnail the picked photo; the preview uses the resized JPEG.
  useEffect(() => {
    if (!shot || shot.prepared || shot.error) return
    let alive = true
    const { file } = shot
    const apply = (patch: Partial<Shot>) => setShot((s) => (alive && s?.file === file ? { ...s, ...patch } : s))
    preparePhoto(file)
      .then((prepared) => apply({ prepared }))
      .catch((err) => apply({ error: err instanceof PhotoError ? err.message : 'No pude procesar esa foto.' }))
    return () => {
      alive = false
    }
  }, [shot])

  useEffect(() => () => abortRef.current?.abort(), [])

  function leave() {
    abortRef.current?.abort()
    clearPendingPhoto()
    goBack('/')
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (picked) setShot({ file: picked, prepared: null, error: null })
  }

  async function analyze() {
    const description = text.trim()
    if (mode === 'photo' && !photo) return
    if (mode === 'text' && !description) return

    const controller = new AbortController()
    abortRef.current = controller
    setPhase('loading')
    setError(null)
    setFallbackModel(null)
    try {
      const settings = await getSettings()
      const res = await analyzeMeal(
        {
          apiKey: settings.geminiApiKey,
          models: settings.geminiModels,
          onModel: (model, index) => {
            if (!controller.signal.aborted) setFallbackModel(index > 0 ? model : null)
          },
          imageBase64: photo?.aiBase64,
          text: description || undefined,
          signal: controller.signal,
        },
        () => void recordAiUsage(),
      )
      if (controller.signal.aborted) return
      setResult(res)
      setPhase('review')
    } catch (err) {
      if (controller.signal.aborted) return
      const e = err instanceof AiError ? err : aiError('bad_response')
      if (e.kind === 'cancelled') {
        setPhase('compose')
        return
      }
      setError(e)
      setPhase('error')
    }
  }

  function cancelLoading() {
    abortRef.current?.abort()
    setPhase('compose')
  }

  function goManual() {
    const q = new URLSearchParams({ meal, date })
    const description = text.trim()
    if (description) q.set('name', description.slice(0, 120))
    clearPendingPhoto()
    navigate(`/registrar/manual?${q.toString()}`, { replace: true })
  }

  if (phase === 'review' && result) {
    return (
      <Review
        title="Revisa tu comida"
        initialItems={result.items}
        assumptions={result.assumptions}
        model={result.model}
        photo={previewUrl ?? undefined}
        initialMeal={meal}
        onCancel={leave}
        onSave={async (chosenMeal, items) => {
          await db.entries.add({
            id: newId(),
            date,
            meal: chosenMeal,
            items: items.map((item) => ({ ...item })),
            source: mode === 'photo' ? 'photo' : 'text',
            ...(photo ? { photoThumb: photo.thumbDataUrl } : {}),
            createdAt: Date.now(),
          })
          clearPendingPhoto()
          goBack('/')
        }}
      />
    )
  }

  const title = mode === 'photo' ? 'Foto de tu comida' : 'Describe tu comida'
  const canAnalyze = mode === 'photo' ? photo !== null : text.trim() !== ''
  const showHero = previewUrl !== null && (phase === 'compose' || phase === 'loading')

  return (
    <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+104px)]">
      {showHero ? (
        <PhotoHero src={previewUrl} alt="Foto de tu comida" onBack={leave} scanning={phase === 'loading'} />
      ) : (
        <FlowHeader title={title} onBack={leave} backLabel="Cancelar" />
      )}

      {phase === 'loading' && <LoadingState overlap={showHero} mode={mode} fallbackModel={fallbackModel} onCancel={cancelLoading} />}

      {phase === 'error' && error && (
        <div className="px-4">
          <Card className="p-5">
            <p className="text-body font-semibold">No pude analizar tu comida</p>
            <p className="mt-1 text-secondary text-text-2" role="alert">
              {error.message}
            </p>
            {error.attempts.length > 0 && <AttemptDetails attempts={error.attempts} />}
            <div className="mt-4 flex flex-col gap-2">
              {error.action === 'settings' && <Button onClick={() => navigate('/ajustes', { replace: true })}>Ir a Ajustes</Button>}
              {error.action === 'retry' && <Button onClick={analyze}>Reintentar</Button>}
              <Button variant={error.action === 'none' ? 'primary' : 'secondary'} onClick={goManual}>
                Registrar a mano{text.trim() ? ' con lo que escribí' : ''}
              </Button>
              <Button variant="plain" onClick={() => setPhase('compose')}>
                Volver
              </Button>
            </div>
          </Card>
        </div>
      )}

      {phase === 'compose' && (
        <>
          {mode === 'photo' && (
            <div className="px-4">
              {previewUrl ? null : shot && !photoError ? (
                <div className="flex h-56 animate-pulse items-center justify-center rounded-card bg-fill">
                  <p className="text-secondary text-text-2">Preparando foto…</p>
                </div>
              ) : (
                <Card className="flex flex-col items-center px-4 py-8 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-fill text-text">
                    <IconCamera size={28} />
                  </span>
                  <p className="mt-3 text-body font-semibold">Saca una foto de tu plato</p>
                  <p className="mt-1 text-secondary text-text-2">Que se vea entero y con buena luz.</p>
                </Card>
              )}
              {photoError && (
                <p className="pt-2 text-secondary text-danger" role="alert">
                  {photoError}
                </p>
              )}
              <div className={`flex gap-2 ${previewUrl ? 'mt-4' : 'mt-3'}`}>
                <Button variant="secondary" className="flex-1" onClick={() => cameraRef.current?.click()}>
                  {shot ? 'Tomar otra' : 'Tomar foto'}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => galleryRef.current?.click()}>
                  Elegir de fotos
                </Button>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
              <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
            </div>
          )}

          <div className="px-4 pt-5">
            <label htmlFor={textId} className="block pb-2 text-label font-semibold tracking-wide text-text-2 uppercase">
              {mode === 'photo' ? 'Detalles (opcional)' : '¿Qué comiste?'}
            </label>
            <textarea
              id={textId}
              value={text}
              maxLength={MAX_TEXT}
              onChange={(e) => setText(e.target.value)}
              rows={mode === 'photo' ? 3 : 5}
              placeholder={
                mode === 'photo'
                  ? 'Ej: el pollo era frito y comí la mitad del arroz'
                  : 'Ej: 2 marraquetas con palta y un café con leche'
              }
              className="w-full resize-none rounded-card bg-card p-4 text-body shadow-card outline-none placeholder:text-text-2/70"
            />
            <p className="pt-1 text-label text-text-2">
              {mode === 'photo'
                ? 'Lo que escribas tiene prioridad sobre la foto: cantidades, preparación, marcas.'
                : 'Mientras más detalle (cantidades, preparación), mejor la estimación.'}
            </p>
          </div>

          <BottomBar>
            <Button className="w-full" onClick={analyze} disabled={!canAnalyze}>
              Analizar
            </Button>
          </BottomBar>
        </>
      )}
    </main>
  )
}

/** "Ver detalle técnico": HTTP status and Google's message for each model tried. Never the key. */
function AttemptDetails({ attempts }: { attempts: readonly ModelAttempt[] }) {
  return (
    <details className="mt-3 rounded-inner bg-fill px-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-secondary font-medium text-accent">Ver detalle técnico</summary>
      <ul className="flex flex-col gap-3 pb-4">
        {attempts.map((a, i) => (
          <li key={i} className="text-label">
            <p className="font-semibold text-text break-all">{a.model}</p>
            <p className="text-text-2 break-words">
              {a.status === 'timeout' ? 'Sin respuesta' : a.status === 'network' ? 'Sin conexión' : `HTTP ${a.status}`}
              {a.message ? `: ${a.message}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </details>
  )
}

function LoadingState({
  overlap,
  mode,
  fallbackModel,
  onCancel,
}: {
  overlap: boolean
  mode: Mode
  fallbackModel: string | null
  onCancel: () => void
}) {
  return (
    <div className="px-4" aria-live="polite">
      <section className={`relative z-10 rounded-card bg-card p-5 shadow-card ${overlap ? '-mt-10' : 'mt-2'}`}>
        <p className="text-body font-semibold">{mode === 'photo' ? 'Analizando tu plato…' : 'Analizando tu comida…'}</p>
        <p className="text-secondary text-text-2">
          {fallbackModel ? `El modelo anterior no respondió; probando con ${fallbackModel}…` : 'Suele tardar unos segundos.'}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-15 animate-pulse rounded-inner bg-fill" />
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2.5" aria-hidden="true">
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-fill" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-fill" />
        </div>
      </section>
      <Button variant="plain" className="mt-3 w-full" onClick={onCancel}>
        Cancelar análisis
      </Button>
    </div>
  )
}
