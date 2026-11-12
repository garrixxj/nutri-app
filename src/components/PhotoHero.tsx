import { IconChevronLeft } from './icons.tsx'
import { CircleButton } from './ui.tsx'

/** Corner brackets that frame the plate, like a viewfinder. */
function Viewfinder() {
  const corner = 'absolute size-9 border-white/90'
  return (
    <div className="pointer-events-none absolute inset-6 top-[calc(env(safe-area-inset-top)+64px)]" aria-hidden="true">
      <span className={`${corner} top-0 left-0 rounded-tl-2xl border-t-[3px] border-l-[3px]`} />
      <span className={`${corner} top-0 right-0 rounded-tr-2xl border-t-[3px] border-r-[3px]`} />
      <span className={`${corner} bottom-6 left-0 rounded-bl-2xl border-b-[3px] border-l-[3px]`} />
      <span className={`${corner} right-0 bottom-6 rounded-br-2xl border-r-[3px] border-b-[3px]`} />
    </div>
  )
}

/**
 * Full-width meal photo at the top of a flow, with a back button over it.
 * A card placed right after it with `-mt-10` overlaps its bottom edge.
 */
export function PhotoHero({
  src,
  alt,
  onBack,
  backLabel = 'Cancelar',
  scanning = false,
}: {
  src: string
  alt: string
  onBack: () => void
  backLabel?: string
  scanning?: boolean
}) {
  return (
    <div className="relative mx-auto h-[min(48dvh,440px)] max-w-md overflow-hidden bg-fill">
      <img src={src} alt={alt} className="size-full object-cover" />
      <Viewfinder />
      <div className="safe-top absolute inset-x-0 top-0 px-4">
        <div className="flex min-h-14 items-center justify-between gap-3 pt-2">
          <CircleButton label={backLabel} onImage onClick={onBack}>
            <IconChevronLeft size={22} strokeWidth={2.2} />
          </CircleButton>
          {scanning && (
            <span className="flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--card)_80%,transparent)] px-3 py-2 text-label font-semibold text-text shadow-card backdrop-blur-md">
              <span className="size-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
              Analizando
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
