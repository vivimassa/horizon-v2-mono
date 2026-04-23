'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Copy, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface BulkReplicateConfirmDialogProps {
  queueCount: number
  periodFrom: string
  periodTo: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Non-destructive confirmation before running Bulk Create + Replicate. Focus
 * lands on the confirm button so Enter/Space fires it immediately; Esc or the
 * Cancel button aborts.
 */
export function BulkReplicateConfirmDialog({
  queueCount,
  periodFrom,
  periodTo,
  busy,
  onConfirm,
  onCancel,
}: BulkReplicateConfirmDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const accent = '#7c3aed'

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      style={{ background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl overflow-hidden"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(96,97,112,0.25)',
        }}
      >
        <div
          className="flex items-start gap-3 px-5 py-4"
          style={{
            background: `${accent}14`,
            borderLeft: `4px solid ${accent}`,
            borderBottom: `1px solid ${panelBorder}`,
          }}
        >
          <Copy size={22} strokeWidth={2.2} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <h3 className="text-[16px] font-bold tracking-tight mb-1" style={{ color: textPrimary }}>
              Bulk Create and Replicate?
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
              About to commit{' '}
              <strong style={{ color: textPrimary }}>
                {queueCount} queued pairing{queueCount === 1 ? '' : 's'}
              </strong>{' '}
              and replicate each across{' '}
              <strong style={{ color: textPrimary }}>
                {periodFrom} → {periodTo}
              </strong>
              . Dates with missing flights or schedule mismatches (flight no., dep/arr, std/sta) will be skipped.
              Proceed?
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 rounded-md transition-colors hover:bg-black/10 disabled:opacity-50"
            style={{ color: textMuted }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-4"
          style={{
            borderTop: `1px solid ${panelBorder}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
              color: textPrimary,
              border: `1px solid ${panelBorder}`,
            }}
          >
            No, Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[13px] font-bold transition-all hover:opacity-95 active:scale-[0.98] inline-flex items-center gap-1.5 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              background: accent,
              color: '#fff',
              boxShadow: `0 4px 14px ${accent}55`,
            }}
          >
            <Copy size={13} strokeWidth={2.4} />
            {busy ? 'Working…' : 'Yes, Proceed'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
