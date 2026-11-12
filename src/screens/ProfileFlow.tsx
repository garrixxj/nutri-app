import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { saveProfile } from '../db/db.ts'
import { BackupError, parseBackup } from '../db/backup.ts'
import { restoreBackup } from '../db/backup-store.ts'
import type { ActivityLevel, Goal, Profile, Sex, Targets } from '../db/types.ts'
import { ChoiceRow, MacroLabel, NumberRow, RowGroup } from '../components/fields.tsx'
import { BottomBar, Button, Segmented, SectionTitle } from '../components/ui.tsx'
import { formatInt, parseDecimal, toInputString } from '../domain/format.ts'
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS } from '../domain/labels.ts'
import { calculateTargets, macrosForKcal, type BodyData } from '../domain/targets.ts'

type Mode = 'onboarding' | 'edit'

interface TargetStrings {
  kcal: string
  protein: string
  carbs: string
  fat: string
}

const LIMITS = {
  age: [14, 100],
  heightCm: [120, 230],
  weightKg: [35, 250],
} as const

function toTargetStrings(t: Targets): TargetStrings {
  return {
    kcal: String(t.kcal),
    protein: String(t.protein),
    carbs: String(t.carbs),
    fat: String(t.fat),
  }
}

function parseTargets(s: TargetStrings): Targets | null {
  const kcal = parseDecimal(s.kcal)
  const protein = parseDecimal(s.protein)
  const carbs = parseDecimal(s.carbs)
  const fat = parseDecimal(s.fat)
  if (kcal === null || protein === null || carbs === null || fat === null || kcal < 800) return null
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }
}

function sameTargets(a: Targets, b: Targets): boolean {
  return a.kcal === b.kcal && a.protein === b.protein && a.carbs === b.carbs && a.fat === b.fat
}

/**
 * Two steps: body data, then calculated (editable) targets.
 * Used for first-run onboarding and for "Mis datos" in Ajustes.
 */
export function ProfileFlow({
  mode,
  profile,
  onDone,
}: {
  mode: Mode
  profile?: Profile
  onDone?: () => void
}) {
  const [step, setStep] = useState<'body' | 'targets'>('body')
  const [sex, setSex] = useState<Sex | null>(profile?.sex ?? null)
  const [age, setAge] = useState(toInputString(profile?.age))
  const [height, setHeight] = useState(toInputString(profile?.heightCm))
  const [weight, setWeight] = useState(toInputString(profile?.weightKg))
  const [activity, setActivity] = useState<ActivityLevel | null>(profile?.activityLevel ?? null)
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'gain_muscle')
  const [error, setError] = useState<string | null>(null)
  const [targets, setTargets] = useState<TargetStrings>({ kcal: '', protein: '', carbs: '', fat: '' })
  const [body, setBody] = useState<BodyData | null>(null)
  const [saving, setSaving] = useState(false)

  const ageN = parseDecimal(age)
  const heightN = parseDecimal(height)
  const weightN = parseDecimal(weight)
  const outOfRange = (v: number | null, [min, max]: readonly [number, number]) => v !== null && (v < min || v > max)

  function continueToTargets() {
    if (!sex || !activity || ageN === null || heightN === null || weightN === null) {
      setError('Completa todos los datos para calcular tus metas.')
      return
    }
    if (outOfRange(ageN, LIMITS.age)) return setError('La edad debe estar entre 14 y 100 años.')
    if (outOfRange(heightN, LIMITS.heightCm)) return setError('La estatura debe estar entre 120 y 230 cm.')
    if (outOfRange(weightN, LIMITS.weightKg)) return setError('El peso debe estar entre 35 y 250 kg.')

    const data: BodyData = {
      sex,
      age: Math.round(ageN),
      heightCm: heightN,
      weightKg: weightN,
      activityLevel: activity,
      goal,
    }
    const unchanged =
      profile &&
      profile.sex === data.sex &&
      profile.age === data.age &&
      profile.heightCm === data.heightCm &&
      profile.weightKg === data.weightKg &&
      profile.activityLevel === data.activityLevel &&
      profile.goal === data.goal
    // Keep hand-edited targets when the body data didn't change.
    setTargets(toTargetStrings(unchanged ? profile.targets : calculateTargets(data)))
    setBody(data)
    setError(null)
    setStep('targets')
    window.scrollTo(0, 0)
  }

  async function finish() {
    if (!body) return
    const parsed = parseTargets(targets)
    if (!parsed) {
      setError('Revisa las metas: deben ser números y las calorías al menos 800.')
      return
    }
    setSaving(true)
    await saveProfile({ ...body, targets: parsed, targetsEdited: !sameTargets(parsed, calculateTargets(body)) })
    setSaving(false)
    onDone?.()
  }

  function onKcalChange(v: string) {
    const kcal = parseDecimal(v)
    if (kcal !== null && body && kcal >= 800) {
      setTargets({ ...toTargetStrings(macrosForKcal(kcal, body.weightKg)), kcal: v })
    } else {
      setTargets((t) => ({ ...t, kcal: v }))
    }
  }

  if (step === 'targets' && body) {
    const parsed = parseTargets(targets)
    const recommended = calculateTargets(body)
    const macroKcal = parsed ? parsed.protein * 4 + parsed.carbs * 4 + parsed.fat * 9 : null
    const mismatch = parsed && macroKcal !== null && Math.abs(macroKcal - parsed.kcal) >= 30

    return (
      <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+104px)]">
        <FlowHeader
          step={2}
          title="Tus metas diarias"
          left={
            <Button variant="plain" className="-ml-2 px-2" onClick={() => setStep('body')}>
              Atrás
            </Button>
          }
        />
        <p className="px-4 text-secondary text-text-2">
          Calculadas con Mifflin-St Jeor según tu actividad y objetivo. Puedes ajustarlas ahora o después en Ajustes.
        </p>

        <SectionTitle>Calorías</SectionTitle>
        <RowGroup>
          <NumberRow label="Meta diaria" value={targets.kcal} onChange={onKcalChange} suffix="kcal" decimals={false} />
        </RowGroup>

        <SectionTitle>Macros</SectionTitle>
        <RowGroup>
          <NumberRow
            label={<MacroLabel color="bg-protein" text="Proteína" />}
            value={targets.protein}
            onChange={(v) => setTargets((t) => ({ ...t, protein: v }))}
            suffix="g"
            decimals={false}
          />
          <NumberRow
            label={<MacroLabel color="bg-carbs" text="Carbohidratos" />}
            value={targets.carbs}
            onChange={(v) => setTargets((t) => ({ ...t, carbs: v }))}
            suffix="g"
            decimals={false}
          />
          <NumberRow
            label={<MacroLabel color="bg-fat" text="Grasa" />}
            value={targets.fat}
            onChange={(v) => setTargets((t) => ({ ...t, fat: v }))}
            suffix="g"
            decimals={false}
          />
        </RowGroup>
        <p className="px-4 pt-2 text-label text-text-2">
          Proteína 2 g por kg, grasa 25% de las calorías y carbohidratos el resto.
        </p>
        {mismatch && macroKcal !== null && (
          <p className="px-4 pt-2 text-label text-carbs">Tus macros suman {formatInt(macroKcal)} kcal.</p>
        )}
        {parsed && !sameTargets(parsed, recommended) && (
          <div className="px-4 pt-3">
            <Button variant="plain" className="-ml-2 px-2" onClick={() => setTargets(toTargetStrings(recommended))}>
              Volver al cálculo recomendado
            </Button>
          </div>
        )}
        {error && <p className="px-4 pt-3 text-secondary text-danger">{error}</p>}

        <BottomBar>
          <Button className="w-full" onClick={finish} disabled={saving}>
            {mode === 'onboarding' ? 'Empezar' : 'Guardar'}
          </Button>
        </BottomBar>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+104px)]">
      <FlowHeader
        step={1}
        title={mode === 'onboarding' ? 'Hola, cuéntame de ti' : 'Mis datos'}
        left={
          mode === 'edit' ? (
            <Button variant="plain" className="-ml-2 px-2" onClick={onDone}>
              Cancelar
            </Button>
          ) : undefined
        }
      />
      <p className="px-4 text-secondary text-text-2">
        Con esto calculo tus calorías y macros diarios. Todo queda guardado solo en este teléfono.
      </p>

      <SectionTitle>Sexo</SectionTitle>
      <div className="px-4">
        <Segmented label="Sexo" options={SEX_OPTIONS} value={sex} onChange={setSex} />
      </div>

      <SectionTitle>Medidas</SectionTitle>
      <RowGroup>
        <NumberRow label="Edad" value={age} onChange={setAge} suffix="años" decimals={false} invalid={outOfRange(ageN, LIMITS.age)} />
        <NumberRow label="Estatura" value={height} onChange={setHeight} suffix="cm" invalid={outOfRange(heightN, LIMITS.heightCm)} />
        <NumberRow label="Peso" value={weight} onChange={setWeight} suffix="kg" invalid={outOfRange(weightN, LIMITS.weightKg)} />
      </RowGroup>

      <SectionTitle>Actividad física</SectionTitle>
      <div role="radiogroup" aria-label="Actividad física">
        <RowGroup>
          {ACTIVITY_OPTIONS.map((o) => (
            <ChoiceRow
              key={o.value}
              label={o.label}
              detail={o.detail}
              selected={activity === o.value}
              onSelect={() => setActivity(o.value)}
            />
          ))}
        </RowGroup>
      </div>

      <SectionTitle>Objetivo</SectionTitle>
      <div role="radiogroup" aria-label="Objetivo">
        <RowGroup>
          {GOAL_OPTIONS.map((o) => (
            <ChoiceRow key={o.value} label={o.label} detail={o.detail} selected={goal === o.value} onSelect={() => setGoal(o.value)} />
          ))}
        </RowGroup>
      </div>

      {error && <p className="px-4 pt-3 text-secondary text-danger">{error}</p>}
      {mode === 'onboarding' && <RestoreLink />}

      <BottomBar>
        <Button className="w-full" onClick={continueToTargets}>
          Continuar
        </Button>
      </BottomBar>
    </main>
  )
}

function FlowHeader({ step, title, left }: { step: 1 | 2; title: string; left?: ReactNode }) {
  return (
    <header className="safe-top px-4">
      <div className="flex min-h-11 items-center justify-between pt-2">
        <div>{left}</div>
        <span className="rounded-full bg-fill px-3 py-1 text-label font-semibold text-text-2">Paso {step} de 2</span>
      </div>
      <h1 className="pt-2 pb-2 text-[28px] leading-9 font-bold tracking-tight">{title}</h1>
    </header>
  )
}

function RestoreLink() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      await restoreBackup(backup)
      if (!backup.profile) {
        setMessage({ text: `Restauré ${backup.entries.length} comidas. El respaldo no traía tus datos: complétalos arriba.`, error: false })
      }
      // With a profile, the app leaves onboarding on its own.
    } catch (err) {
      setMessage({
        text: err instanceof BackupError ? err.message : 'No pude leer el respaldo. Inténtalo de nuevo.',
        error: true,
      })
    }
  }

  return (
    <div className="px-4 pt-8 text-center">
      <p className="text-secondary text-text-2">¿Cambiaste de teléfono?</p>
      <Button variant="plain" onClick={() => inputRef.current?.click()}>
        Restaurar un respaldo
      </Button>
      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      {message && (
        <p className={`pt-1 text-secondary ${message.error ? 'text-danger' : 'text-text-2'}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  )
}
