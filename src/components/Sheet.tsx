import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const EXIT_MS = 250

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Accessible name; also shown as the sheet heading when `showTitle` is set. */
  title: string
  showTitle?: boolean
  children: ReactNode
}

/** iOS-style bottom sheet: slides up, closes on backdrop tap or Escape. */
export function Sheet({ open, onClose, title, showTitle = false, children }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Mount as soon as it opens (render-phase update, no extra effect pass).
  if (open && !mounted) setMounted(true)
  const shown = open && entered

  useEffect(() => {
    if (open) {
      // Wait two frames so the closed position paints before sliding in.
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEntered(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    const t = setTimeout(() => {
      setMounted(false)
      setEntered(false)
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-250 ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 mx-auto max-h-[90dvh] max-w-md overflow-y-auto overscroll-contain rounded-t-card bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] outline-none transition-transform duration-250 ease-out ${shown ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex justify-center pt-2 pb-3" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-text-2/30" />
        </div>
        {showTitle && <h2 className="mb-3 text-title font-bold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
