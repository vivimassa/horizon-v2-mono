'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, X } from 'lucide-react'
import type { DisruptionIssueRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useEffectiveCategoryLabel, useEffectiveResolutionTypes } from '@/stores/use-disruption-store'

interface Props {
  issue: DisruptionIssueRef
  onClose: () => void
  onConfirm: (resolutionType: string, notes: string | undefined) => void | Promise<void>
}

export function ResolveDialog({ issue, onClose, onConfirm }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const allResolutionTypes = useEffectiveResolutionTypes()
  const RESOLUTION_OPTIONS = useMemo(() => allResolutionTypes.filter((r) => r.enabled), [allResolutionTypes])
  const categoryLabel = useEffectiveCategoryLabel(issue.category)
  const [resolutionType, setResolutionType] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  const submit = async () => {
    if (!resolutionType) return
    setSubmitting(true)
    try {
      await onConfirm(resolutionType, notes.trim() || undefined)
    } finally {
      setSubmitting(false)
    }
  }

  const panelBg = isDark ? 'rgba(25,25,33,0.96)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const rowBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const accentSelected = isDark ? 'rgba(6,194,112,0.16)' : 'rgba(6,194,112,0.10)'
  const rowHover = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9998, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Mark disruption resolved"
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.40)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${panelBorder}` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 28, height: 28, background: 'rgba(6,194,112,0.15)' }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#06C270' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-hz-text">Mark resolved</div>
              <div className="text-[13px] text-hz-text-secondary truncate">
                {issue.flightNumber ?? 'Unknown'} · {categoryLabel}
                {issue.forDate ? ` · ${issue.forDate}` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg transition-opacity hover:opacity-80"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-hz-text-tertiary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-[3px] h-[14px] rounded-full bg-module-accent" />
              <span className="text-[13px] font-bold uppercase tracking-wider text-hz-text-secondary">
                Resolution type
              </span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RESOLUTION_OPTIONS.map((opt) => {
                const isSelected = resolutionType === opt.key
                return (
                  <li key={opt.key}>
                    <button
                      type="button"
                      onClick={() => setResolutionType(opt.key)}
                      className="w-full text-left rounded-xl px-3 py-2.5 transition-colors"
                      style={{
                        background: isSelected ? accentSelected : inputBg,
                        border: `1px solid ${isSelected ? '#06C270' : rowBorder}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = rowHover
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = inputBg
                      }}
                    >
                      <div className="text-[14px] font-semibold text-hz-text leading-tight">{opt.label}</div>
                      <div className="text-[13px] text-hz-text-secondary mt-0.5 leading-snug">{opt.hint}</div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="px-5 pb-4 flex flex-col gap-2">
            <label className="text-[13px] font-medium text-hz-text-secondary">
              Notes <span className="text-hz-text-tertiary">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything that helps the next OCC shift understand what happened…"
              className="w-full rounded-lg px-3 py-2 text-[13px] text-hz-text outline-none resize-y"
              style={{
                background: inputBg,
                border: `1px solid ${panelBorder}`,
                minHeight: 72,
              }}
            />
          </div>
        </div>

        <div
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: `1px solid ${panelBorder}` }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-[13px] font-semibold text-hz-text-secondary transition-opacity hover:opacity-80"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!resolutionType || submitting}
            onClick={submit}
            className="px-4 h-9 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{
              background: '#06C270',
              color: '#fff',
              opacity: resolutionType && !submitting ? 1 : 0.5,
              cursor: resolutionType && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Resolving…' : 'Mark resolved'}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
