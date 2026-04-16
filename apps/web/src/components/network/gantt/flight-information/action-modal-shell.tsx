'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

// Shared modal shell for flight-action dialogs (Divert, Delay, Reschedule, Jumpseater).
// Stacks above the Flight Information dialog (z-[9999]) with its own backdrop.

export interface ActionModalProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  confirmDisabled?: boolean
  saving?: boolean
  destructive?: boolean
  width?: number
  children: ReactNode
  hint?: string
}

export function ActionModalShell({
  open,
  title,
  subtitle,
  onClose,
  onConfirm,
  confirmLabel = 'Apply',
  confirmDisabled,
  saving,
  destructive,
  width = 520,
  children,
  hint,
}: ActionModalProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  if (!open || typeof window === 'undefined') return null

  const bg = isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.99)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const affirmative = destructive ? '#E63535' : '#06C270'

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative flex flex-col overflow-hidden rounded-2xl"
        style={{
          width,
          maxWidth: '92vw',
          maxHeight: '82vh',
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: 'blur(24px)',
          boxShadow: isDark ? '0 16px 64px rgba(0,0,0,0.55)' : '0 16px 64px rgba(96,97,112,0.20)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-[16px] font-bold leading-tight" style={{ color: palette.text }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12px] mt-0.5" style={{ color: palette.textSecondary }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg h-8 w-8 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity shrink-0"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
          >
            <X size={16} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 gap-3" style={{ borderTop: `1px solid ${border}` }}>
          <div className="flex-1 min-w-0">
            {hint && (
              <p className="text-[11px]" style={{ color: palette.textTertiary }}>
                {hint}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-[13px] font-medium transition-opacity"
              style={{
                background: 'transparent',
                border: `1px solid ${border}`,
                color: palette.textSecondary,
              }}
            >
              Cancel
            </button>
            {onConfirm && (
              <button
                onClick={onConfirm}
                disabled={confirmDisabled || saving}
                className="h-9 px-5 rounded-lg text-[13px] font-bold text-white transition-opacity disabled:opacity-40 flex items-center gap-2"
                style={{ background: affirmative }}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                {confirmLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
