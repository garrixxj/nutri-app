import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { AiError, aiError } from '../ai/errors.ts'
import { analyzeMeal, type AnalysisResult } from '../ai/gemini.ts'
import { goBack, navigate } from '../app/router.ts'
import { recordAiUsage } from '../db/ai-usage.ts'
import { db, getSettings } from '../db/db.ts'
import type { Meal } from '../db/types.ts'
import { IconCamera } from '../components/icons.tsx'
import { BottomBar, Button, Card } from '../components/ui.tsx'
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
  const [result, setResult] = useState<AnalysisResult | null>(null)
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
    try {
      const settings = await getSettings()
      const res = await analyzeMeal(
        {
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
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
        thumb={photo?.thumbDataUrl}
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

  return (
    <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+104px)]">
      <header className="safe-top px-4">
        <div className="flex min-h-11 items-center pt-2">
          <Button variant="plain" className="-ml-2 px-2" onClick={leave}>
            Cancelar
          </Button>
        </div>
        <h1 className="pt-2 pb-3 text-title font-bold tracking-tight">{title}</h1>
      </header>

      {phase === 'loading' && <LoadingState thumb={photo?.thumbDataUrl} mode={mode} onCancel={cancelLoading} />}

      {phase === 'error' && error && (
        <div className="px-4">
          <Card className="p-5">
            <p className="text-body font-semibold">No pude analizar tu comida</p>
            <p className="mt-1 text-secondary text-text-2" role="alert">
              {error.message}
            </p>
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
              {previewUrl ? (
                <div className="overflow-hidden rounded-card bg-card shadow-card">
                  <img src={previewUrl} alt="Foto de tu comida" className="max-h-[45dvh] w-full object-cover" />
                </div>
              ) : shot && !photoError ? (
                <div className="flex h-56 animate-pulse items-center justify-center rounded-card bg-text-2/12">
                  <p className="text-secondary text-text-2">Preparando foto…</p>
                </div>
              ) : (
                <Card className="flex flex-col items-center px-4 py-8 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-accent/14 text-accent">
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
              <div className="mt-3 flex gap-2">
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

function LoadingState({ thumb, mode, onCancel }: { thumb?: string; mode: Mode; onCancel: () => void }) {
  return (
    <div className="px-4" aria-live="polite">
      <div className="flex items-center gap-4">
        {thumb ? (
          <img src={thumb} alt="" width={72} height={72} className="size-18 shrink-0 rounded-button object-cover" />
        ) : (
          <div className="size-18 shrink-0 animate-pulse rounded-button bg-text-2/15" />
        )}
        <div className="flex-1">
          <p className="text-body font-semibold">{mode === 'photo' ? 'Analizando tu plato…' : 'Analizando tu comida…'}</p>
          <p className="text-secondary text-text-2">Suele tardar unos segundos.</p>
        </div>
      </div>
      <ul className="mt-5 flex flex-col gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-card bg-card p-4 shadow-card">
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-text-2/15" />
            <div className="mt-3 flex justify-between">
              <div className="h-8 w-20 animate-pulse rounded-button bg-text-2/12" />
              <div className="h-4 w-24 animate-pulse self-center rounded-full bg-text-2/12" />
            </div>
          </li>
        ))}
      </ul>
      <Button variant="plain" className="mt-3 w-full" onClick={onCancel}>
        Cancelar análisis
      </Button>
    </div>
  )
}
