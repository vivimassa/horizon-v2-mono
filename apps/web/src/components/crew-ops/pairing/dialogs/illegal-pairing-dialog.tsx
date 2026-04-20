'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { LegalityResult } from '../types'

interface IllegalPairingDialogProps {
  /** The computed legality result (must have at least one violation). */
  result: LegalityResult
  /** Workflow status the user was about to create (for the title). */
  workflowLabel: 'Draft' | 'Final'
  onProceed: () => void
  onCancel: () => void
}

/**
 * Red-banner confirmation modal shown when the user tries to create a pairing
 * with FDTL violations. Matches the V1 "Illegal" pattern — loud warning,
 * Proceed / Cancel choice. Proceed creates the pairing anyway (for cases
 * where the operator has manager override).
 */
export function IllegalPairingDialog({ result, workflowLabel, onProceed, onCancel }: IllegalPairingDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Escape closes (Cancel)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const violations = result.checks.filter((c) => c.status === 'violation')
  const warnings = result.checks.filter((c) => c.status === 'warning')

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
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl overflow-hidden"
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
          <AlertTriangle size={22} strokeWidth={2.2} style={{ color: '#FF3B3B', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <h3 className="text-[16px] font-bold tracking-tight mb-1" style={{ color: '#FF3B3B' }}>
              Illegal pairing — {violations.length} violation{violations.length === 1 ? '' : 's'}
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
              The flights you selected break FDTL rules. Creating this pairing as <strong>{workflowLabel}</strong>{' '}
              requires a manager-level override.
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

        {/* Violation list */}
        <div className="px-5 py-4">
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: textMuted }}>
            Failing checks
          </div>
          <ul className="space-y-1.5">
            {violations.map((c, i) => (
              <li key={`v-${i}`} className="flex items-center gap-2 text-[13px]" style={{ color: textPrimary }}>
                <span className="w-1 h-4 rounded-full" style={{ background: '#FF3B3B' }} />
                <span className="font-semibold">{c.label}</span>
                <span className="tabular-nums" style={{ color: textMuted }}>
                  {c.actual} / {c.limit}
                </span>
              </li>
            ))}
            {warnings.length > 0 && (
              <>
                <li className="pt-1 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: textMuted }}>
                  Plus {warnings.length} warning{warnings.length === 1 ? '' : 's'}
                </li>
                {warnings.map((c, i) => (
                  <li key={`w-${i}`} className="flex items-center gap-2 text-[13px]" style={{ color: textSecondary }}>
                    <span className="w-1 h-4 rounded-full" style={{ background: '#FF8800' }} />
                    <span className="font-semibold">{c.label}</span>
                    <span className="tabular-nums" style={{ color: textMuted }}>
                      {c.actual} / {c.limit}
                    </span>
                  </li>
                ))}
              </>
            )}
          </ul>
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
            Cancel
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="h-9 px-4 rounded-lg text-[13px] font-bold transition-all hover:opacity-95 active:scale-[0.98]"
            style={{
              background: '#FF3B3B',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(255,59,59,0.45)',
            }}
          >
            Proceed anyway
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
