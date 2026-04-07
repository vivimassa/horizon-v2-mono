"use client"

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'
import { AC_TYPE_COLOR_PALETTE } from '@/lib/gantt/colors'

const STATUS_LEGEND = [
  { label: 'Published / Assigned', color: 'rgba(16,185,129,0.8)' },
  { label: 'Published / Unassigned', color: 'rgba(245,158,11,0.8)' },
  { label: 'Draft / Assigned', color: 'rgba(59,130,246,0.8)' },
  { label: 'Draft / Unassigned', color: 'rgba(100,116,139,0.7)' },
] as const

const SCHEDULE_STATUSES = [
  { key: 'active', label: 'Published', color: '#06C270' },
  { key: 'finalized', label: 'Finalized', color: '#0d9488' },
  { key: 'draft', label: 'Draft', color: '#3B82F6' },
] as const

export function GanttFilterPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [collapsed, setCollapsed] = useState(false)
  const [enabledStatuses, setEnabledStatuses] = useState<Set<string>>(new Set(['active', 'finalized', 'draft']))
  const [enabledTypes, setEnabledTypes] = useState<Set<string> | null>(null) // null = all enabled

  const periodFrom = useGanttStore(s => s.periodFrom)
  const periodTo = useGanttStore(s => s.periodTo)
  const loading = useGanttStore(s => s.loading)
  const aircraftTypes = useGanttStore(s => s.aircraftTypes)
  const aircraft = useGanttStore(s => s.aircraft)
  const colorMode = useGanttStore(s => s.colorMode)
  const setPeriod = useGanttStore(s => s.setPeriod)
  const commitPeriod = useGanttStore(s => s.commitPeriod)
  const setColorMode = useGanttStore(s => s.setColorMode)

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#E4E1EA' : '#1f2937'
  const textSecondary = isDark ? '#8C90A2' : '#6b7280'

  const sectionLabel = 'text-[10px] font-semibold uppercase tracking-widest mb-2'

  // Count aircraft per type
  const acCountByType = new Map<string, number>()
  for (const ac of aircraft) {
    const key = ac.aircraftTypeIcao ?? 'Unknown'
    acCountByType.set(key, (acCountByType.get(key) ?? 0) + 1)
  }

  function toggleStatus(key: string) {
    const next = new Set(enabledStatuses)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setEnabledStatuses(next)
  }

  function toggleAcType(icao: string) {
    const all = aircraftTypes.map(t => t.icaoType)
    const current = enabledTypes ?? new Set(all)
    const next = new Set(current)
    if (next.has(icao)) next.delete(icao)
    else next.add(icao)
    setEnabledTypes(next)
  }

  // ── Collapsed ──
  if (collapsed) {
    return (
      <div
        className="shrink-0 flex flex-col items-center rounded-2xl overflow-hidden"
        style={{ width: 44, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(20px)' }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="h-12 w-full flex items-center justify-center hover:bg-white/5 transition-colors duration-150"
        >
          <ChevronRight size={16} style={{ color: textSecondary }} />
        </button>
        <div className="flex-1 flex items-center justify-center" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
          <span className="text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: textSecondary }}>
            Filters
          </span>
        </div>
      </div>
    )
  }

  // ── Expanded ──
  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-200"
      style={{ width: 300, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-11 shrink-0" style={{ borderBottom: `1px solid ${sectionBorder}` }}>
        <Filter size={14} color="#0061FF" />
        <span className="text-[14px] font-bold" style={{ color: textPrimary }}>Filters</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">

        {/* Period */}
        <section>
          <div className={sectionLabel} style={{ color: textSecondary }}>Period</div>
          <div className="space-y-1.5">
            <input
              type="date"
              value={periodFrom}
              onChange={e => setPeriod(e.target.value, periodTo)}
              className="w-full h-8 rounded-md px-2 text-[12px] font-mono outline-none transition-colors"
              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary }}
            />
            <input
              type="date"
              value={periodTo}
              onChange={e => setPeriod(periodFrom, e.target.value)}
              className="w-full h-8 rounded-md px-2 text-[12px] font-mono outline-none transition-colors"
              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary }}
            />
          </div>
          <button
            onClick={() => commitPeriod()}
            disabled={loading || !periodFrom || !periodTo}
            className="mt-2 w-full h-9 rounded-lg text-[13px] font-semibold text-white transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#0061FF' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? 'Loading…' : 'Go'}
          </button>
        </section>

        {/* Aircraft Type */}
        {aircraftTypes.length > 0 && (
          <section style={{ borderTop: `1px solid ${sectionBorder}`, paddingTop: 12 }}>
            <div className={sectionLabel} style={{ color: textSecondary }}>Aircraft Type</div>
            <div className="space-y-1">
              {aircraftTypes.map((t, i) => {
                const color = t.color ?? AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length]
                const checked = enabledTypes === null || enabledTypes.has(t.icaoType)
                const count = acCountByType.get(t.icaoType) ?? 0
                return (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 h-7 px-1 rounded cursor-pointer hover:bg-white/5 transition-colors duration-150"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAcType(t.icaoType)}
                      className="accent-[#0061FF] w-3.5 h-3.5"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}40` }}
                    />
                    <span className="text-[11px] font-mono font-medium flex-1" style={{ color: textPrimary }}>
                      {t.icaoType}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: textSecondary }}>{count}</span>
                  </label>
                )
              })}
            </div>
          </section>
        )}

        {/* Schedule Status */}
        <section style={{ borderTop: `1px solid ${sectionBorder}`, paddingTop: 12 }}>
          <div className={sectionLabel} style={{ color: textSecondary }}>Schedule Status</div>
          <div className="space-y-1">
            {SCHEDULE_STATUSES.map(s => {
              const checked = enabledStatuses.has(s.key)
              return (
                <label
                  key={s.key}
                  className="flex items-center gap-2 h-7 px-1 rounded cursor-pointer hover:bg-white/5 transition-colors duration-150"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStatus(s.key)}
                    className="accent-[#0061FF] w-3.5 h-3.5"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: s.color, boxShadow: `0 0 6px ${s.color}40` }}
                  />
                  <span className="text-[11px] font-medium" style={{ color: textPrimary }}>{s.label}</span>
                </label>
              )
            })}
          </div>
        </section>

        {/* Color Mode */}
        <section style={{ borderTop: `1px solid ${sectionBorder}`, paddingTop: 12 }}>
          <div className={sectionLabel} style={{ color: textSecondary }}>Color Mode</div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
            {(['status', 'ac_type'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setColorMode(mode)}
                className="flex-1 h-7 text-[11px] font-semibold transition-colors duration-150"
                style={{
                  background: colorMode === mode ? '#0061FF' : 'transparent',
                  color: colorMode === mode ? '#fff' : textSecondary,
                }}
              >
                {mode === 'status' ? 'Status' : 'AC Type'}
              </button>
            ))}
          </div>
        </section>

        {/* Legend */}
        <section style={{ borderTop: `1px solid ${sectionBorder}`, paddingTop: 12 }}>
          <div className={sectionLabel} style={{ color: textSecondary }}>Legend</div>
          <div className="space-y-1.5">
            {STATUS_LEGEND.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
                />
                <span className="text-[10px]" style={{ color: textSecondary }}>{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(true)}
        className="h-9 shrink-0 flex items-center justify-center gap-1.5 hover:bg-white/5 transition-colors duration-150"
        style={{ borderTop: `1px solid ${sectionBorder}` }}
      >
        <ChevronLeft size={14} style={{ color: textSecondary }} />
        <span className="text-[11px] font-medium" style={{ color: textSecondary }}>Minimize</span>
      </button>
    </div>
  )
}
