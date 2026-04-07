"use client"

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors, glass } from '@skyhub/ui/theme'
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
  const { theme, moduleTheme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = moduleTheme?.accent ?? colors.defaultAccent

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

  const glassBg = isDark ? glass.panel : 'rgba(255,255,255,0.90)'
  const glassBorder = isDark ? glass.panelBorder : palette.cardBorder

  const acCountByType = new Map<string, number>()
  for (const ac of aircraft) {
    const key = ac.aircraftTypeIcao ?? 'Unknown'
    acCountByType.set(key, (acCountByType.get(key) ?? 0) + 1)
  }

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
        className="shrink-0 flex flex-col items-center rounded-2xl overflow-hidden shadow-sm"
        style={{ width: 44, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="h-12 w-full flex items-center justify-center transition-colors duration-150"
          style={{ color: palette.textSecondary }}
        >
          <ChevronRight size={16} />
        </button>
        <div className="flex-1 flex items-center justify-center" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
          <span className="text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: palette.textTertiary }}>
            Filters
          </span>
        </div>
      </div>
    )
  }

  // ── Expanded ──
  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-200 shadow-sm"
      style={{ width: 300, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-11 shrink-0" style={{ borderBottom: `1px solid ${palette.border}` }}>
        <Filter size={14} className="text-module-accent" />
        <span className="text-[14px] font-bold" style={{ color: palette.text }}>Filters</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">

        {/* Period */}
        <section>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: palette.textTertiary }}>Period</div>
          <div className="space-y-1.5">
            <input
              type="date"
              value={periodFrom}
              onChange={e => setPeriod(e.target.value, periodTo)}
              className="w-full h-10 rounded-lg px-3 text-[13px] font-mono outline-none transition-colors focus:ring-2 focus:ring-module-accent"
              style={{ background: palette.backgroundHover, border: `1px solid ${palette.border}`, color: palette.text }}
            />
            <input
              type="date"
              value={periodTo}
              onChange={e => setPeriod(periodFrom, e.target.value)}
              className="w-full h-10 rounded-lg px-3 text-[13px] font-mono outline-none transition-colors focus:ring-2 focus:ring-module-accent"
              style={{ background: palette.backgroundHover, border: `1px solid ${palette.border}`, color: palette.text }}
            />
          </div>
          <button
            onClick={() => commitPeriod()}
            disabled={loading || !periodFrom || !periodTo}
            className="mt-2 w-full h-10 rounded-lg text-[13px] font-semibold text-white transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-40 bg-module-accent"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? 'Loading…' : 'Go'}
          </button>
        </section>

        {/* Aircraft Type */}
        {aircraftTypes.length > 0 && (
          <section style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 12 }}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: palette.textTertiary }}>Aircraft Type</div>
            <div className="space-y-0.5">
              {aircraftTypes.map((t, i) => {
                const color = t.color ?? AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length]
                const checked = enabledTypes === null || enabledTypes.has(t.icaoType)
                const count = acCountByType.get(t.icaoType) ?? 0
                return (
                  <label key={t.id} className="flex items-center gap-2 h-8 px-1 rounded-md cursor-pointer transition-colors duration-150"
                    style={{ ['--tw-bg-opacity' as string]: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.background = palette.backgroundHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleAcType(t.icaoType)}
                      className="w-3.5 h-3.5 rounded accent-module-accent" />
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}40` }} />
                    <span className="text-[12px] font-mono font-medium flex-1" style={{ color: palette.text }}>{t.icaoType}</span>
                    <span className="text-[11px] font-mono" style={{ color: palette.textTertiary }}>{count}</span>
                  </label>
                )
              })}
            </div>
          </section>
        )}

        {/* Schedule Status */}
        <section style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 12 }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: palette.textTertiary }}>Schedule Status</div>
          <div className="space-y-0.5">
            {SCHEDULE_STATUSES.map(s => (
              <label key={s.key} className="flex items-center gap-2 h-8 px-1 rounded-md cursor-pointer transition-colors duration-150"
                onMouseEnter={e => (e.currentTarget.style.background = palette.backgroundHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <input type="checkbox" checked={enabledStatuses.has(s.key)} onChange={() => toggleStatus(s.key)}
                  className="w-3.5 h-3.5 rounded accent-module-accent" />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}40` }} />
                <span className="text-[12px] font-medium" style={{ color: palette.text }}>{s.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Color Mode */}
        <section style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 12 }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: palette.textTertiary }}>Color Mode</div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${palette.border}` }}>
            {(['status', 'ac_type'] as const).map(mode => (
              <button key={mode} onClick={() => setColorMode(mode)}
                className={`flex-1 h-8 text-[12px] font-semibold transition-colors duration-150 ${colorMode === mode ? 'bg-module-accent text-white' : ''}`}
                style={colorMode !== mode ? { color: palette.textSecondary } : undefined}
              >
                {mode === 'status' ? 'Status' : 'AC Type'}
              </button>
            ))}
          </div>
        </section>

        {/* Legend */}
        <section style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 12 }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: palette.textTertiary }}>Legend</div>
          <div className="space-y-1.5">
            {STATUS_LEGEND.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                <span className="text-[11px]" style={{ color: palette.textSecondary }}>{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Collapse button */}
      <button onClick={() => setCollapsed(true)}
        className="h-10 shrink-0 flex items-center justify-center gap-1.5 transition-colors duration-150"
        style={{ borderTop: `1px solid ${palette.border}`, color: palette.textSecondary }}
      >
        <ChevronLeft size={14} />
        <span className="text-[12px] font-medium">Minimize</span>
      </button>
    </div>
  )
}
