'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface DeletePairingDialogProps {
  pairingCode: string
  /** Optional extra detail line (e.g. "3 legs · SGN–HAN–SGN"). */
  detail?: string
  /**
   * When > 1, the title/body switches to a bulk-delete wording. Drives a
   * progress line in the header showing how many instances of the same
   * pairingCode will be removed.
   */
  instanceCount?: number
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * SkyHub-branded destructive confirmation for pairing deletion. Replaces the
 * native `window.confirm()` which renders the browser's OS-styled dialog and
 * breaks visual continuity. Matches `IllegalPairingDialog` layout — red
 * accent banner + Cancel/Delete button pair.
 */
export function DeletePairingDialog({
  pairingCode,
  detail,
  instanceCount,
  busy,
  onConfirm,
  onCancel,
}: DeletePairingDialogProps) {
  const bulk = (instanceCount ?? 1) > 1
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
      if (e.key === 'Enter' && !busy) onConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel, onConfirm])

  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      style={{ background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="w-full max-w-[460px] rounded-2xl overflow-hidden"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(96,97,112,0.25)',
        }}
      >
        {/* Red banner */}
        <div
          className="flex items-start gap-3 px-5 py-4"
          style={{
            background: 'rgba(255,59,59,0.12)',
            borderLeft: '4px solid #FF3B3B',
            borderBottom: `1px solid ${panelBorder}`,
          }}
        >
          <Trash2 size={22} strokeWidth={2.2} style={{ color: '#FF3B3B', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <h3 className="text-[16px] font-bold tracking-tight mb-1" style={{ color: '#FF3B3B' }}>
              {bulk ? `Delete all ${instanceCount} instances of ${pairingCode}?` : `Delete pairing ${pairingCode}?`}
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
              {bulk
                ? `This action cannot be undone. All ${instanceCount} pairings and their legs will be permanently removed.`
                : 'This action cannot be undone. The pairing and all its legs will be permanently removed.'}
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

        {detail && (
          <div className="px-5 py-3.5">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                border: `1px solid ${panelBorder}`,
              }}
            >
              <span className="w-1 h-4 rounded-full shrink-0" style={{ background: '#FF3B3B' }} />
              <span className="text-[13px] font-semibold" style={{ color: textPrimary }}>
                {pairingCode}
              </span>
              <span className="text-[12px] tabular-nums" style={{ color: textMuted }}>
                {detail}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
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
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[13px] font-bold transition-all hover:opacity-95 active:scale-[0.98] inline-flex items-center gap-1.5 disabled:opacity-60"
            style={{
              background: '#FF3B3B',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(255,59,59,0.45)',
            }}
          >
            <Trash2 size={13} strokeWidth={2.4} />
            {busy ? 'Deleting…' : bulk ? `Yes, Delete ${instanceCount}` : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
