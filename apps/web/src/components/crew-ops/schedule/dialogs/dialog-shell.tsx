'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface Props {
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  /** Max-width of the modal card in px. Default 480 (SwapOverlay convention). */
  width?: number
  /** Hide the body scroll area — some dialogs (picker) manage their own. */
  bodyPadding?: boolean
}

/**
 * Shared dialog shell used by the Phase 2 activity/assignment dialogs.
 *
 *   • Fixed dark backdrop at 50% opacity — click outside closes.
 *   • Esc closes.
 *   • Centered card, theme-aware background + border.
 *   • Title bar with close X; footer slot for action buttons.
 *
 * Matches the SwapOverlay / CapacityErrorDialog patterns so the three
 * new dialogs feel consistent with what's already in the module.
 */
export function DialogShell({ title, onClose, footer, children, width = 480, bodyPadding = true }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{
          width,
          maxWidth: '92vw',
          background: isDark ? 'rgba(25,25,33,0.98)' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(96,97,112,0.18)',
          color: isDark ? '#FFFFFF' : '#0E0E14',
        }}
      >
        <div
          className="flex items-center justify-between px-5 h-12 shrink-0"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto ${bodyPadding ? 'px-5 py-4' : ''}`}>{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
            style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Secondary (outline) button styled for dialog footers. */
export function DialogCancelButton({
  onClick,
  disabled,
  label = 'Cancel',
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-9 px-4 rounded-lg text-[13px] font-medium hover:bg-white/10 disabled:opacity-50"
    >
      {label}
    </button>
  )
}

/** Primary (accent) button styled for dialog footers. */
export function DialogPrimaryButton({
  onClick,
  disabled,
  loading,
  label,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
      style={{ backgroundColor: 'var(--module-accent)' }}
    >
      {loading ? 'Working…' : label}
    </button>
  )
}
