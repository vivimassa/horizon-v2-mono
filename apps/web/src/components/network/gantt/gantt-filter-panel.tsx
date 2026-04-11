'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Search, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useScheduleRefStore } from '@/stores/use-schedule-ref-store'
import { useOperatorStore } from '@/stores/use-operator-store'

const SCHEDULE_STATUSES = [
  { key: 'draft', label: 'Draft', color: '#3B82F6' },
  { key: 'active', label: 'Active', color: '#06C270' },
  { key: 'suspended', label: 'Suspended', color: '#FF8800' },
  { key: 'cancelled', label: 'Cancelled', color: '#FF3B3B' },
] as const

export function GanttFilterPanel({ forceCollapsed = false, onGo }: { forceCollapsed?: boolean; onGo?: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [collapsed, setCollapsed] = useState(false)
  const [enabledStatuses, setEnabledStatuses] = useState<Set<string>>(
    new Set(['draft', 'active', 'suspended', 'cancelled']),
  )
  const [enabledTypes, setEnabledTypes] = useState<Set<string> | null>(null)

  const periodFrom = useGanttStore((s) => s.periodFrom)
  const periodTo = useGanttStore((s) => s.periodTo)
  const loading = useGanttStore((s) => s.loading)
  const aircraft = useGanttStore((s) => s.aircraft)
  const colorMode = useGanttStore((s) => s.colorMode)
  const fleetSortOrder = useGanttStore((s) => s.fleetSortOrder)
  const setPeriod = useGanttStore((s) => s.setPeriod)
  const commitPeriod = useGanttStore((s) => s.commitPeriod)
  const setColorMode = useGanttStore((s) => s.setColorMode)
  const setFleetSortOrder = useGanttStore((s) => s.setFleetSortOrder)
  const setAcTypeFilter = useGanttStore((s) => s.setAcTypeFilter)
  const setStatusFilter = useGanttStore((s) => s.setStatusFilter)

  // AC types from ref store — always available, loaded independently of flights
  const refAcTypes = useScheduleRefStore((s) => s.aircraftTypes)
  const loadRefData = useScheduleRefStore((s) => s.loadAll)
  const refLoaded = useScheduleRefStore((s) => s.loaded)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  useEffect(() => {
    if (operatorLoaded && !refLoaded) loadRefData()
  }, [operatorLoaded, refLoaded, loadRefData])
  const acTypeIcaos = refAcTypes.filter((t) => t.isActive).map((t) => t.icaoType)

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const acCountByType = useMemo(() => {
    const map = new Map<string, number>()
    for (const ac of aircraft) {
      const key = ac.aircraftTypeIcao ?? 'Unknown'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [aircraft])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const activeCount = mounted
    ? [periodFrom, periodTo].filter(Boolean).length +
      (enabledTypes !== null ? 1 : 0) +
      (enabledStatuses.size < SCHEDULE_STATUSES.length ? 1 : 0)
    : 0

  return (
    <div
      className="shrink-0 h-full flex flex-col rounded-2xl overflow-hidden"
      style={{
        width: collapsed ? 44 : 300,
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Collapsed view — click anywhere to expand */}
      <div
        className="absolute inset-0 flex flex-col items-center cursor-pointer hover:bg-hz-border/20 transition-colors"
        onClick={() => {
          if (collapsed) setCollapsed(false)
        }}
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      >
        <div className="h-12 w-full flex items-center justify-center">
          <ChevronRight size={16} className="text-hz-text-secondary" />
        </div>
        <div
          className="flex-1 flex items-center justify-center"
          style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
        >
          <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap">
            Filters
          </span>
        </div>
      </div>

      {/* Expanded view */}
      <div
        className="flex flex-col h-full min-w-[300px]"
        style={{
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: 'opacity 200ms ease',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{ minHeight: 48, borderBottom: `1px solid ${sectionBorder}` }}
        >
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-module-accent" />
            <span className="text-[15px] font-bold">Filters</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-module-accent text-white text-[13px] font-bold">
                {activeCount}
              </span>
            )}
          </div>
          <button onClick={() => setCollapsed(true)} className="p-1 rounded-md hover:bg-hz-border/30 transition-colors">
            <ChevronLeft size={16} className="text-hz-text-tertiary" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Period */}
          <FilterSection label="Period">
            <DateRangePicker
              from={periodFrom}
              to={periodTo}
              onChangeFrom={(v) => setPeriod(v, useGanttStore.getState().periodTo)}
              onChangeTo={(v) => setPeriod(useGanttStore.getState().periodFrom, v)}
              inline
            />
          </FilterSection>

          {/* Aircraft Type */}
          <FilterSection label="Aircraft Type">
            <AcTypeDropdown
              types={acTypeIcaos}
              value={enabledTypes}
              onChange={setEnabledTypes}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Schedule Status */}
          <FilterSection label="Schedule Status">
            <StatusDropdown
              value={enabledStatuses}
              onChange={setEnabledStatuses}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Fleet Sort Order */}
          <FilterSection label="Fleet Sort Order">
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
              {(['type', 'registration', 'utilization'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFleetSortOrder(mode)}
                  className={`flex-1 py-2 text-[13px] font-semibold transition-colors duration-150`}
                  style={
                    fleetSortOrder === mode
                      ? {
                          background: isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.10)',
                          color: isDark ? '#5B8DEF' : '#1e40af',
                        }
                      : { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }
                  }
                >
                  {mode === 'type' ? 'Type' : mode === 'registration' ? 'Reg' : 'Util'}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* Color Mode */}
          <FilterSection label="Color Mode">
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
              {(['status', 'ac_type'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setColorMode(mode)}
                  className={`flex-1 py-2 text-[13px] font-semibold transition-colors duration-150`}
                  style={
                    colorMode === mode
                      ? {
                          background: isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.10)',
                          color: isDark ? '#5B8DEF' : '#1e40af',
                        }
                      : { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }
                  }
                >
                  {mode === 'status' ? 'Status' : 'AC Type'}
                </button>
              ))}
            </div>
          </FilterSection>
        </div>

        {/* Go Button */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
          <button
            onClick={() => {
              // Sync filters to store before fetching
              setAcTypeFilter(enabledTypes ? Array.from(enabledTypes) : null)
              const allStatuses = SCHEDULE_STATUSES.map((s) => s.key)
              const allSelected = allStatuses.every((k) => enabledStatuses.has(k))
              setStatusFilter(allSelected ? null : Array.from(enabledStatuses))
              ;(onGo ?? commitPeriod)()
              setCollapsed(true)
            }}
            disabled={loading || !periodFrom || !periodTo}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Loading...' : 'Go'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary block">{label}</label>
      {children}
    </div>
  )
}

function StatusDropdown({
  value,
  onChange,
  isDark,
  inputBg,
  inputBorder,
}: {
  value: Set<string>
  onChange: (v: Set<string>) => void
  isDark: boolean
  inputBg: string
  inputBorder: string
}) {
  const [open, setOpen] = useState(false)
  const allKeys = SCHEDULE_STATUSES.map((s) => s.key)
  const allSelected = allKeys.every((k) => value.has(k))

  const label = allSelected
    ? 'All Statuses'
    : SCHEDULE_STATUSES.filter((s) => value.has(s.key))
        .map((s) => s.label)
        .join(', ') || 'None'

  function toggle(key: string) {
    const next = new Set(value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(next)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-xl text-[13px] font-medium transition-colors"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      >
        <span className="truncate text-hz-text">{label}</span>
        <ChevronDown
          size={14}
          className={`text-hz-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden py-1"
          style={{
            background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${inputBorder}`,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(96,97,112,0.12)',
          }}
        >
          {SCHEDULE_STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className="w-full flex items-center gap-2.5 h-8 px-3 hover:bg-hz-border/20 transition-colors"
            >
              <span
                className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                style={{
                  borderColor: value.has(s.key) ? s.color : isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)',
                  background: value.has(s.key) ? s.color : 'transparent',
                }}
              >
                {value.has(s.key) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5l2.5 2.5L8 3"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="text-[13px] font-medium text-hz-text">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AcTypeDropdown({
  types,
  value,
  onChange,
  isDark,
  inputBg,
  inputBorder,
}: {
  types: string[]
  value: Set<string> | null
  onChange: (v: Set<string> | null) => void
  isDark: boolean
  inputBg: string
  inputBorder: string
}) {
  const [open, setOpen] = useState(false)
  const allSelected = value === null || types.every((t) => value.has(t))

  const label = allSelected ? 'All Types' : types.filter((t) => value?.has(t)).join(', ') || 'None'

  function toggle(icao: string) {
    const all = new Set(types)
    if (value === null) {
      all.delete(icao)
      onChange(all)
    } else {
      const next = new Set(value)
      if (next.has(icao)) next.delete(icao)
      else next.add(icao)
      if (types.every((t) => next.has(t))) onChange(null)
      else onChange(next)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-xl text-[13px] font-medium transition-colors"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      >
        <span className="truncate text-hz-text">{label}</span>
        <ChevronDown
          size={14}
          className={`text-hz-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden py-1"
          style={{
            background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${inputBorder}`,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(96,97,112,0.12)',
          }}
        >
          {types.map((icao) => {
            const checked = value === null || value.has(icao)
            const accentColor = 'var(--module-accent, #1e40af)'
            return (
              <button
                key={icao}
                onClick={() => toggle(icao)}
                className="w-full flex items-center gap-2.5 h-8 px-3 hover:bg-hz-border/20 transition-colors"
              >
                <span
                  className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                  style={{
                    borderColor: checked ? accentColor : isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)',
                    background: checked ? accentColor : 'transparent',
                  }}
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5l2.5 2.5L8 3"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-[13px] font-medium text-hz-text">{icao}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
