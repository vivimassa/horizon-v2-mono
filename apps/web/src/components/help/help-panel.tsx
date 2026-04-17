'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X } from 'lucide-react'

interface HelpPanelProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  code?: string
  children?: React.ReactNode
  closeOnBackdrop?: boolean
}

export function HelpPanel({ open, onClose, title, subtitle, code, children, closeOnBackdrop = true }: HelpPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      closeBtnRef.current?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!mounted) return null

  const heading = title ?? 'Help'

  return createPortal(
    <div aria-hidden={!open} className={['fixed inset-0 z-[9999]', 'pointer-events-none'].join(' ')}>
      {/* Backdrop */}
      <div
        onClick={closeOnBackdrop ? onClose : undefined}
        className={[
          'absolute inset-0 bg-black/30 backdrop-blur-[2px]',
          'transition-opacity duration-200 ease-out',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0',
        ].join(' ')}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        tabIndex={-1}
        className={[
          'absolute top-0 right-0 bottom-0',
          'w-full sm:w-[480px] max-w-full',
          'flex flex-col',
          'bg-hz-card backdrop-blur-xl',
          'border-l border-hz-border',
          'shadow-[-16px_0_48px_rgba(0,0,0,0.25)]',
          'transition-transform duration-[280ms] ease-out',
          open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <header className="shrink-0 px-5 py-4 border-b border-hz-border flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold text-hz-text leading-tight truncate">{heading}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-hz-text-secondary leading-snug line-clamp-2">{subtitle}</p>
            )}
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close help"
            className={[
              'shrink-0 h-8 w-8 rounded-lg',
              'flex items-center justify-center',
              'text-hz-text-secondary hover:text-hz-text',
              'hover:bg-black/5 dark:hover:bg-white/5',
              'transition-colors cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-module-accent focus:ring-offset-0',
            ].join(' ')}
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children ?? <HelpEmptyState code={code} />}</div>

        {/* Footer */}
        <footer className="shrink-0 px-5 py-3 border-t border-hz-border flex items-center justify-between text-[13px] text-hz-text-secondary">
          <span>
            Press{' '}
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-hz-border bg-black/5 dark:bg-white/5 font-mono text-[13px] font-medium">
              F1
            </kbd>{' '}
            to toggle
          </span>
          <span>
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-hz-border bg-black/5 dark:bg-white/5 font-mono text-[13px] font-medium">
              Esc
            </kbd>{' '}
            to close
          </span>
        </footer>
      </aside>
    </div>,
    document.body,
  )
}

function HelpEmptyState({ code }: { code?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="h-12 w-12 rounded-2xl bg-module-bg-subtle flex items-center justify-center mb-4">
        <HelpCircle className="h-6 w-6 text-module-accent" strokeWidth={2} />
      </div>
      <h3 className="text-[15px] font-semibold text-hz-text mb-1">No help written yet</h3>
      <p className="text-[13px] text-hz-text-secondary max-w-[320px] leading-relaxed">
        {code
          ? `Help content for module ${code} hasn't been added yet. This page will fill in as we author guides together.`
          : `Help content will appear here once authored for this page.`}
      </p>
    </div>
  )
}
