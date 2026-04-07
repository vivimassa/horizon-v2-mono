"use client"

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, Search, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
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
  const [enabledTypes, setEnabledTypes] = useState<Set<string> | null>(null)

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
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const acCountByType = new Map<string, number>()
  for (const ac of aircraft) {
    const key = ac.aircraftTypeIcao ?? 'Unknown'
    acCountByType.set(key, (acCountByType.get(key) ?? 0) + 1)
  }

  const activeCount = [periodFrom, periodTo].filter(Boolean).length
    + (enabledTypes !== null ? 1 : 0)
    + (enabledStatuses.size < 3 ? 1 : 0)

  function toggleStatus(key: string) {
    const next = new Set(enabledStatuses)
    if (next.has(key)) next.delete(key); else next.add(key)
    setEnabledStatuses(next)
  }

  function toggleAcType(icao: string) {
    const all = aircraftTypes.map(t => t.icaoType)
    const current = enabledTypes ?? new Set(all)
    const next = new Set(current)
    if (next.has(icao)) next.delete(icao); else next.add(icao)
    setEnabledTypes(next)
  }

  // ── Collapsed ──
  if (collapsed) {
    return (
      <div
        className="shrink-0 flex flex-col items-center rounded-2xl overflow-hidden"
        style={{ width: 44, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="h-12 w-full flex items-center justify-center hover:bg-hz-border/20 transition-colors"
        >
          <ChevronRight size={16} className="text-hz-text-secondary" />
        </button>
        <div className="flex-1 flex items-center justify-center" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap">
            Filters
          </span>
        </div>
      </div>
    )
  }

  // ── Expanded ──
  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden"
      style={{ width: 300, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
    >
      {/* Header — matches 1.1.1 exactly */}
      <div
        className="flex items-center justify-between px-5 shrink-0"
        style={{ minHeight: 48, borderBottom: `1px solid ${sectionBorder}` }}
      >
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-module-accent" />
          <span className="text-[15px] font-bold">Filters</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-module-accent text-white text-[11px] font-bold">{activeCount}</span>
          )}
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1 rounded-md hover:bg-hz-border/30 transition-colors">
          <ChevronLeft size={16} className="text-hz-text-tertiary" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

        {/* Period — same DateRangePicker as 1.1.1 */}
        <FilterSection label="Period">
          <DateRangePicker
            from={periodFrom}
            to={periodTo}
            onChangeFrom={(v) => setPeriod(v, periodTo)}
            onChangeTo={(v) => setPeriod(periodFrom, v)}
          />
        </FilterSection>

        {/* Aircraft Type */}
        {aircraftTypes.length > 0 && (
          <FilterSection label="Aircraft Type">
            <div className="space-y-0.5">
              {aircraftTypes.map((t, i) => {
                const color = t.color ?? AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length]
                const checked = enabledTypes === null || enabledTypes.has(t.icaoType)
                const count = acCountByType.get(t.icaoType) ?? 0
                return (
                  <label key={t.id} className="flex items-center gap-2 h-8 px-1.5 rounded-lg cursor-pointer hover:bg-hz-border/20 transition-colors duration-150">
                    <input type="checkbox" checked={checked} onChange={() => toggleAcType(t.icaoType)}
                      className="w-3.5 h-3.5 rounded accent-[var(--module-accent)]" />
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}40` }} />
                    <span className="text-[13px] font-mono font-medium flex-1 text-hz-text">{t.icaoType}</span>
                    <span className="text-[11px] font-mono text-hz-text-tertiary">{count}</span>
                  </label>
                )
              })}
            </div>
          </FilterSection>
        )}

        {/* Schedule Status */}
        <FilterSection label="Schedule Status">
          <div className="space-y-0.5">
            {SCHEDULE_STATUSES.map(s => (
              <label key={s.key} className="flex items-center gap-2 h-8 px-1.5 rounded-lg cursor-pointer hover:bg-hz-border/20 transition-colors duration-150">
                <input type="checkbox" checked={enabledStatuses.has(s.key)} onChange={() => toggleStatus(s.key)}
                  className="w-3.5 h-3.5 rounded accent-[var(--module-accent)]" />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}40` }} />
                <span className="text-[13px] font-medium text-hz-text">{s.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Color Mode */}
        <FilterSection label="Color Mode">
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
            {(['status', 'ac_type'] as const).map(mode => (
              <button key={mode} onClick={() => setColorMode(mode)}
                className={`flex-1 py-2 text-[13px] font-semibold transition-colors duration-150 ${colorMode === mode ? 'bg-module-accent text-white' : 'text-hz-text-secondary'}`}
              >{mode === 'status' ? 'Status' : 'AC Type'}</button>
            ))}
          </div>
        </FilterSection>

        {/* Legend */}
        <FilterSection label="Legend">
          <div className="space-y-1.5">
            {STATUS_LEGEND.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                <span className="text-[11px] text-hz-text-secondary">{item.label}</span>
              </div>
            ))}
          </div>
        </FilterSection>
      </div>

      {/* Go Button — pinned at bottom, matches 1.1.1 */}
      <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
        <button
          onClick={() => commitPeriod()}
          disabled={loading || !periodFrom || !periodTo}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Loading...' : 'Go'}
        </button>
      </div>
    </div>
  )
}

/* ── Sub-component matching 1.1.1 pattern ── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary block">{label}</label>
      {children}
    </div>
  )
}
