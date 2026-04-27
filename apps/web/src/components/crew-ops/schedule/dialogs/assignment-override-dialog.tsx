'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { AssignmentViolation } from '@/lib/crew-schedule/violations'
import { DialogHeroBand } from './dialog-shell'
import { OverrideHero } from './dialog-heroes'

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
  onConfirm: (ack: { reason: string; commanderDiscretion: boolean }) => void
}

export function AssignmentOverrideDialog({ violations, busy, onCancel, onConfirm }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // FDTL-kind violations (rest / cumulative / augmented) map onto
  // commander-discretion audit trail. Other kinds (base_mismatch, etc.)
  // just need a plain reason.
  const hasFdtl = useMemo(() => violations.some((v) => v.kind.startsWith('fdtl_')), [violations])
  const [reason, setReason] = useState('')
  const [commanderDiscretion, setCommanderDiscretion] = useState(hasFdtl)
  const reasonTooShort = reason.trim().length < 3
  const confirmRef = useRef<HTMLButtonElement>(null)
  const canConfirm = !busy && !(hasFdtl && reasonTooShort)

  useEffect(() => {
    // Focus the primary CTA. For FDTL violations the reason textarea
    // is required, so we leave focus on the textarea instead; other
    // overridable kinds (base mismatch, etc.) — focus Confirm so the
    // planner can Enter-to-proceed.
    if (!hasFdtl) confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        onCancel()
        return
      }
      // Enter confirms when allowed — but not while typing in the
      // textarea (Enter there should add a newline).
      if (e.key === 'Enter' && canConfirm) {
        const active = document.activeElement as HTMLElement | null
        if (active?.tagName === 'TEXTAREA') return
        e.preventDefault()
        onConfirm({ reason: reason.trim(), commanderDiscretion })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel, onConfirm, hasFdtl, canConfirm, reason, commanderDiscretion])

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
        <DialogHeroBand
          eyebrow="Rule violation"
          title={violations.length === 1 ? violations[0].title : `${violations.length} violations detected`}
          subtitle="Override is logged for the Schedule Legality Check report."
          svg={<OverrideHero />}
          onClose={busy ? () => undefined : onCancel}
          isDark={isDark}
        />

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

          {/* Reason + commander-discretion capture */}
          <div className="pt-1">
            <label
              className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}
            >
              Reason {hasFdtl ? '(required)' : '(optional)'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Commander discretion — 45-min op delay, rest reduced from 12:00 to 11:15"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)'}`,
                color: isDark ? '#FFFFFF' : '#0E0E14',
                resize: 'vertical',
              }}
            />
            {hasFdtl && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={commanderDiscretion}
                  onChange={(e) => setCommanderDiscretion(e.target.checked)}
                  className="rounded"
                />
                <span className="text-[13px]" style={{ color: isDark ? '#E5E7EB' : '#0E0E14' }}>
                  Commander-discretion override (counts toward CMD_DISC usage cap)
                </span>
              </label>
            )}
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
            ref={confirmRef}
            type="button"
            autoFocus={!hasFdtl}
            onClick={() => onConfirm({ reason: reason.trim(), commanderDiscretion })}
            disabled={busy || (hasFdtl && reasonTooShort)}
            className="h-10 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
            style={{ background: '#FF8800' }}
          >
            {busy ? 'Assigning…' : 'Assign anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
