'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { LegalityCheck, LegalityResult } from '../types'

/** Produce a friendly "headline" reason for a violating check — short, with
 *  the exact numbers so the user can act without digging into the legality
 *  reference. Falls back to the raw label when the check isn't one of the
 *  well-known FDTL categories. */
function violationHeadline(c: LegalityCheck): string {
  const label = c.label.toLowerCase()
  if (label.includes('fdp') || label.includes('flight duty period')) return 'FDP exceeded'
  if (label.includes('rest')) return 'Insufficient rest period'
  if (label.includes('sector')) return 'Too many operating sectors'
  if (label.includes('block')) return 'Block time exceeded'
  if (label.includes('return') || label.includes('base')) return "Doesn't return to base"
  if (label.includes('duty')) return 'Duty time exceeded'
  return c.label
}

/** Plain-English second line that spells out the numbers. */
function violationReason(c: LegalityCheck): string {
  const label = c.label.toLowerCase()
  if (label.includes('rest')) {
    return `Minimum required ${c.limit} · attempting ${c.actual}.`
  }
  if (label.includes('return') || label.includes('base')) {
    return `Chain returns to ${c.actual}, but base is ${c.limit}.`
  }
  return `Maximum allowable ${c.limit} · attempting ${c.actual}.`
}

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

        {/* Violation list — one card per failing check with a friendly
            headline and the exact numbers, so the planner sees "FDP exceeded
            — max 10:00, attempting 10:25" rather than needing to interpret
            a raw actual/limit pair. */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: textMuted }}>
              Reason{violations.length === 1 ? '' : 's'}
            </div>
            <ul className="space-y-2">
              {violations.map((c, i) => (
                <li
                  key={`v-${i}`}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                  style={{
                    background: 'rgba(255,59,59,0.08)',
                    border: '1px solid rgba(255,59,59,0.25)',
                  }}
                >
                  <span className="mt-1 w-1 h-4 rounded-full shrink-0" style={{ background: '#FF3B3B' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold" style={{ color: '#FF3B3B' }}>
                        {violationHeadline(c)}
                      </span>
                      <span
                        className="inline-flex items-center px-1.5 h-[18px] rounded text-[10px] font-semibold tracking-[0.06em] uppercase"
                        style={{
                          background: 'rgba(255,59,59,0.15)',
                          color: '#FF3B3B',
                          border: '1px solid rgba(255,59,59,0.35)',
                        }}
                      >
                        {c.label}
                      </span>
                    </div>
                    <div className="text-[12px] tabular-nums" style={{ color: textSecondary }}>
                      {violationReason(c)}
                    </div>
                    {c.fdtlRef && (
                      <div className="text-[10px] italic mt-1" style={{ color: textMuted }}>
                        Ref: {c.fdtlRef}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {warnings.length > 0 && (
            <div>
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: textMuted }}>
                Plus {warnings.length} warning{warnings.length === 1 ? '' : 's'}
              </div>
              <ul className="space-y-1.5">
                {warnings.map((c, i) => (
                  <li key={`w-${i}`} className="flex items-center gap-2 text-[13px]" style={{ color: textSecondary }}>
                    <span className="w-1 h-4 rounded-full shrink-0" style={{ background: '#FF8800' }} />
                    <span className="font-semibold" style={{ color: textPrimary }}>
                      {c.label}
                    </span>
                    <span className="tabular-nums" style={{ color: textMuted }}>
                      {c.actual} / {c.limit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            className="h-9 px-4 rounded-lg text-[13px] font-bold transition-all hover:opacity-95 active:scale-[0.98] inline-flex items-center gap-1.5"
            style={{
              background: '#FF3B3B',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(255,59,59,0.45)',
            }}
          >
            <AlertTriangle size={13} strokeWidth={2.4} />
            Confirm override
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
