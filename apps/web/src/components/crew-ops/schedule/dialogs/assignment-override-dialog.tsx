'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { AssignmentViolation } from '@/lib/crew-schedule/violations'

/**
 * Modal shown before a rule-violating assignment is persisted. Lists
 * every flagged violation (today just base mismatch; more kinds later)
 * and asks the planner to acknowledge and proceed, or cancel.
 *
 *   • Cancel → abort assignment, no API call.
 *   • Assign anyway → proceed; each violation is passed through in the
 *     POST's `overrides` payload so the server persists an audit row.
 *
 * No reason field today. The future 4.2.1 / 4.3.1 flows can wire one in
 * per violationKind if specific rules need justification.
 */
interface Props {
  violations: AssignmentViolation[]
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AssignmentOverrideDialog({ violations, busy, onCancel, onConfirm }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="rounded-2xl overflow-hidden w-full max-w-md shadow-xl"
        style={{
          background: isDark ? '#191921' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with warning glyph */}
        <div
          className="px-5 pt-5 pb-4 flex gap-3 items-start"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <div
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,136,0,0.15)' }}
          >
            <AlertTriangle size={20} color="#FF8800" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold tracking-wide uppercase" style={{ color: '#FF8800' }}>
              Rule violation
            </div>
            <div className="text-[15px] font-semibold mt-0.5" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
              {violations.length === 1 ? violations[0].title : `${violations.length} violations detected`}
            </div>
          </div>
        </div>

        {/* Violation list */}
        <div className="px-5 py-4 space-y-3">
          {violations.map((v) => (
            <div
              key={v.kind}
              className="p-3 rounded-lg"
              style={{
                background: isDark ? 'rgba(255,136,0,0.08)' : 'rgba(255,136,0,0.06)',
                border: `1px solid ${isDark ? 'rgba(255,136,0,0.18)' : 'rgba(255,136,0,0.22)'}`,
              }}
            >
              {violations.length > 1 && (
                <div className="text-[13px] font-semibold mb-1" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
                  {v.title}
                </div>
              )}
              <div className="text-[13px] leading-relaxed" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
                {v.message}
              </div>
            </div>
          ))}
          <div className="text-[13px] leading-relaxed pt-1" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
            You can assign anyway. The override will be logged for the Schedule Legality Check report.
          </div>
        </div>

        {/* Actions */}
        <div
          className="px-5 py-4 flex justify-end gap-2"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 px-4 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}`,
              color: isDark ? '#FFFFFF' : '#0E0E14',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-10 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: '#FF8800' }}
          >
            {busy ? 'Assigning…' : 'Assign anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
