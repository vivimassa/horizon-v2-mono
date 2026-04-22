'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CalendarDays, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface OversizedPairingDialogProps {
  /** How many unique operating dates the selection covers. */
  spanDays: number
  /** Total flight instances selected. */
  flightCount: number
  /** Maximum allowed pairing length before this dialog fires. */
  maxDays: number
  onProceed: () => void
  onCancel: () => void
}

/**
 * Guard dialog shown when the user's grid selection spans more operating days
 * than a sane pairing should ever cover. Prevents the "selected the whole
 * month by accident → created a 120-leg duty trip" catastrophe.
 *
 * The intended path once Replicate ships (step 3) is "Use Replicate" — until
 * then we offer a cancel + force-proceed escape hatch. The force path exists
 * because some cargo/charter ops genuinely have multi-week pairings and we
 * don't want to block them hard.
 */
export function OversizedPairingDialog({
  spanDays,
  flightCount,
  maxDays,
  onProceed,
  onCancel,
}: OversizedPairingDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      style={{
        background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="w-full max-w-[540px] rounded-2xl overflow-hidden"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(96,97,112,0.25)',
        }}
      >
        {/* Orange warning banner */}
        <div
          className="flex items-start gap-3 px-5 py-4"
          style={{
            background: 'rgba(255,136,0,0.14)',
            borderLeft: '4px solid #FF8800',
            borderBottom: `1px solid ${panelBorder}`,
          }}
        >
          <AlertTriangle size={22} strokeWidth={2.2} style={{ color: '#FF8800', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <h3 className="text-[16px] font-bold tracking-tight mb-1" style={{ color: '#E67A00' }}>
              Unusually long selection — {spanDays} days
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
              Your selection would create a single pairing spanning <strong>{spanDays} operating days</strong>. A real
              duty trip almost never exceeds <strong>{maxDays} days</strong>, so this is usually a sign you meant to
              replicate a short pattern across the period rather than build one giant pairing.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md transition-colors hover:bg-black/10"
            style={{ color: textMuted }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Stats */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <StatBox
              icon={<CalendarDays size={14} strokeWidth={2} />}
              label="Operating days covered"
              value={`${spanDays} / max ${maxDays}`}
              tone="warn"
              isDark={isDark}
            />
            <StatBox
              icon={<AlertTriangle size={14} strokeWidth={2} />}
              label="Flight instances selected"
              value={String(flightCount)}
              tone="neutral"
              isDark={isDark}
            />
          </div>

          <div
            className="mt-4 px-3 py-2.5 rounded-lg text-[12px] leading-relaxed"
            style={{
              background: isDark ? 'rgba(124,58,237,0.10)' : 'rgba(124,58,237,0.06)',
              border: `1px solid ${isDark ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.20)'}`,
              color: textSecondary,
            }}
          >
            <strong style={{ color: '#7c3aed' }}>Tip:</strong> a pairing-replicate workflow is coming next — you'll be
            able to build one legal pairing for a single day and then spread it across matching days in the period. For
            now, select a smaller window (ideally one duty trip) and create day-by-day.
          </div>
        </div>

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
            className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
              color: textPrimary,
              border: `1px solid ${panelBorder}`,
            }}
          >
            Cancel — adjust selection
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="h-9 px-4 rounded-lg text-[13px] font-bold transition-all hover:opacity-95 active:scale-[0.98]"
            style={{
              background: '#FF8800',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(255,136,0,0.40)',
            }}
            title={`Create as one ${spanDays}-day pairing (will still run FDTL check afterwards)`}
          >
            Create anyway
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function StatBox({
  icon,
  label,
  value,
  tone,
  isDark,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'warn' | 'neutral'
  isDark: boolean
}) {
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const valueColor = tone === 'warn' ? '#FF8800' : isDark ? '#F5F2FD' : '#1C1C28'
  return (
    <div
      className="px-3 py-2.5 rounded-lg"
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'}`,
      }}
    >
      <div
        className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.10em] uppercase mb-1"
        style={{ color: textMuted }}
      >
        {icon}
        {label}
      </div>
      <div className="text-[16px] font-bold tabular-nums" style={{ color: valueColor }}>
        {value}
      </div>
      <div className="text-[11px]" style={{ color: textSecondary }} />
    </div>
  )
}

export const MAX_PAIRING_DAYS = 7
