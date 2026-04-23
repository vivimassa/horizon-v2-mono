'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, SlidersHorizontal } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'
import type { SmartFilters } from '@/stores/use-pairing-gantt-store'

const POSITION_CODES = ['CP', 'FO', 'CA', 'FA', 'PU', 'CF', 'SPU']
const FDTL_STATUSES = [
  { value: 'legal' as const, label: 'Legal', color: '#06C270' },
  { value: 'warning' as const, label: 'Warning', color: '#FF8800' },
  { value: 'violation' as const, label: 'Violation', color: '#FF3B3B' },
]

const DEFAULT_FILTERS: SmartFilters = {
  logic: 'AND',
  statuses: [],
  hasDeadhead: null,
  nonBaseToBase: null,
  routeLengthMin: null,
  routeLengthMax: null,
  positionCodes: [],
  dhStation: '',
}

function isActive(f: SmartFilters): boolean {
  return (
    f.statuses.length > 0 ||
    f.hasDeadhead !== null ||
    f.nonBaseToBase !== null ||
    f.routeLengthMin !== null ||
    f.routeLengthMax !== null ||
    f.positionCodes.length > 0 ||
    f.dhStation !== ''
  )
}

interface Props {
  onClose: () => void
}

export function SmartFiltersDialog({ onClose }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const current = usePairingGanttStore((s) => s.smartFilters)
  const setSmartFilters = usePairingGanttStore((s) => s.setSmartFilters)

  const [draft, setDraft] = useState<SmartFilters>(current ?? DEFAULT_FILTERS)

  function toggleStatus(v: SmartFilters['statuses'][number]) {
    setDraft((d) => ({
      ...d,
      statuses: d.statuses.includes(v) ? d.statuses.filter((s) => s !== v) : [...d.statuses, v],
    }))
  }

  function togglePosition(code: string) {
    setDraft((d) => ({
      ...d,
      positionCodes: d.positionCodes.includes(code)
        ? d.positionCodes.filter((c) => c !== code)
        : [...d.positionCodes, code],
    }))
  }

  function handleApply() {
    setSmartFilters(isActive(draft) ? draft : null)
    onClose()
  }

  function handleClear() {
    setSmartFilters(null)
    setDraft(DEFAULT_FILTERS)
    onClose()
  }

  const bg = isDark ? 'rgba(20,20,28,0.98)' : 'rgba(255,255,255,0.99)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const chipBase = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  function Chip({
    label,
    active,
    color,
    onClick,
  }: {
    label: string
    active: boolean
    color?: string
    onClick: () => void
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="px-3 py-1 rounded-full text-[13px] font-medium transition-all"
        style={{
          background: active ? (color ?? 'var(--module-accent)') : chipBase,
          color: active ? '#fff' : palette.textSecondary,
          border: `1px solid ${active ? (color ?? 'var(--module-accent)') : 'transparent'}`,
        }}
      >
        {label}
      </button>
    )
  }

  function TriToggle({
    value,
    onChange,
    labels,
  }: {
    value: boolean | null
    onChange: (v: boolean | null) => void
    labels: [string, string]
  }) {
    return (
      <div className="flex gap-1">
        <Chip label="Any" active={value === null} onClick={() => onChange(null)} />
        <Chip label={labels[0]} active={value === true} onClick={() => onChange(true)} />
        <Chip label={labels[1]} active={value === false} onClick={() => onChange(false)} />
      </div>
    )
  }

  function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-start gap-4 py-3" style={{ borderBottom: `1px solid ${sectionBorder}` }}>
        <span className="text-[13px] font-medium shrink-0 pt-1" style={{ width: 160, color: palette.textSecondary }}>
          {label}
        </span>
        <div className="flex flex-wrap gap-2 flex-1">{children}</div>
      </div>
    )
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10100, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{
          width: 560,
          maxHeight: '80vh',
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.36)',
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${sectionBorder}` }}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} style={{ color: 'var(--module-accent)' }} />
            <span className="text-[15px] font-semibold" style={{ color: palette.text }}>
              Smart Filters
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: palette.textTertiary }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={14} />
          </button>
        </div>

        {/* AND / OR logic */}
        <div
          className="shrink-0 flex items-center gap-3 px-5 py-3"
          style={{ borderBottom: `1px solid ${sectionBorder}` }}
        >
          <span className="text-[13px] font-medium" style={{ color: palette.textSecondary }}>
            Match
          </span>
          {(['AND', 'OR'] as const).map((v) => (
            <Chip
              key={v}
              label={v === 'AND' ? 'All criteria (AND)' : 'Any criterion (OR)'}
              active={draft.logic === v}
              onClick={() => setDraft((d) => ({ ...d, logic: v }))}
            />
          ))}
        </div>

        {/* Filter rows */}
        <div className="flex-1 overflow-y-auto px-5">
          <Row label="FDTL Status">
            {FDTL_STATUSES.map(({ value, label, color }) => (
              <Chip
                key={value}
                label={label}
                active={draft.statuses.includes(value)}
                color={color}
                onClick={() => toggleStatus(value)}
              />
            ))}
          </Row>

          <Row label="Deadhead">
            <TriToggle
              value={draft.hasDeadhead}
              onChange={(v) => setDraft((d) => ({ ...d, hasDeadhead: v }))}
              labels={['Has DH leg', 'No DH leg']}
            />
          </Row>

          <Row label="Base routing">
            <TriToggle
              value={draft.nonBaseToBase}
              onChange={(v) => setDraft((d) => ({ ...d, nonBaseToBase: v }))}
              labels={['Non base-to-base', 'Base-to-base']}
            />
          </Row>

          <Row label="Route length (days)">
            <div className="flex items-center gap-2">
              <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                Min
              </span>
              <input
                type="number"
                min={1}
                max={30}
                placeholder="—"
                value={draft.routeLengthMin ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, routeLengthMin: e.target.value ? Number(e.target.value) : null }))
                }
                className="w-16 text-center text-[13px] rounded-lg px-2 py-1 outline-none"
                style={{ background: inputBg, color: palette.text, border: `1px solid ${border}` }}
              />
              <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                Max
              </span>
              <input
                type="number"
                min={1}
                max={30}
                placeholder="—"
                value={draft.routeLengthMax ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, routeLengthMax: e.target.value ? Number(e.target.value) : null }))
                }
                className="w-16 text-center text-[13px] rounded-lg px-2 py-1 outline-none"
                style={{ background: inputBg, color: palette.text, border: `1px solid ${border}` }}
              />
            </div>
          </Row>

          <Row label="Crew position">
            {POSITION_CODES.map((code) => (
              <Chip
                key={code}
                label={code}
                active={draft.positionCodes.includes(code)}
                onClick={() => togglePosition(code)}
              />
            ))}
          </Row>

          <Row label="DH through station">
            <input
              type="text"
              maxLength={4}
              placeholder="ICAO (e.g. VVTS)"
              value={draft.dhStation}
              onChange={(e) => setDraft((d) => ({ ...d, dhStation: e.target.value.toUpperCase() }))}
              className="text-[13px] rounded-lg px-3 py-1.5 outline-none font-mono uppercase"
              style={{
                background: inputBg,
                color: palette.text,
                border: `1px solid ${draft.dhStation ? 'var(--module-accent)' : border}`,
                width: 160,
              }}
            />
          </Row>
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderTop: `1px solid ${sectionBorder}` }}
        >
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded-xl text-[13px] font-medium transition-colors"
            style={{ color: palette.textSecondary }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold transition-opacity"
            style={{ background: 'var(--module-accent)', color: '#fff' }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
