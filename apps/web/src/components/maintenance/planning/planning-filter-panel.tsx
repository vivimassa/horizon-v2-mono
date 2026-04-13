'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Search, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useMaintenancePlanningStore } from '@/stores/use-maintenance-planning-store'

const EVENT_STATUSES = [
  { key: 'proposed', label: 'Auto-proposed', color: '#3B82F6' },
  { key: 'planned', label: 'Planned', color: '#FF8800' },
  { key: 'confirmed', label: 'Confirmed', color: '#06C270' },
  { key: 'in_progress', label: 'In Progress', color: '#0063F7' },
  { key: 'completed', label: 'Completed', color: '#8F90A6' },
] as const

export function PlanningFilterPanel({ forceCollapsed = false, onGo }: { forceCollapsed?: boolean; onGo?: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [collapsed, setCollapsed] = useState(false)

  const periodFrom = useMaintenancePlanningStore((s) => s.periodFrom)
  const periodTo = useMaintenancePlanningStore((s) => s.periodTo)
  const aircraftTypeFilter = useMaintenancePlanningStore((s) => s.aircraftTypeFilter)
  const baseFilter = useMaintenancePlanningStore((s) => s.baseFilter)
  const checkTypeFilter = useMaintenancePlanningStore((s) => s.checkTypeFilter)
  const statusFilter = useMaintenancePlanningStore((s) => s.statusFilter)
  const filterOptions = useMaintenancePlanningStore((s) => s.filterOptions)
  const loading = useMaintenancePlanningStore((s) => s.loading)
  const setPeriod = useMaintenancePlanningStore((s) => s.setPeriod)
  const setFilter = useMaintenancePlanningStore((s) => s.setFilter)
  const commitPeriod = useMaintenancePlanningStore((s) => s.commitPeriod)

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  // Active filter count for badge
  const activeCount =
    (periodFrom ? 1 : 0) +
    (periodTo ? 1 : 0) +
    (aircraftTypeFilter ? 1 : 0) +
    (baseFilter ? 1 : 0) +
    (checkTypeFilter ? 1 : 0) +
    (statusFilter ? 1 : 0)

  const handleGo = useCallback(() => {
    ;(onGo ?? commitPeriod)()
    setCollapsed(true)
  }, [onGo, commitPeriod])

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
      {/* Collapsed view */}
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
            <span className="text-[15px] font-bold text-hz-text">Filters</span>
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
          {/* Period — DateRangePicker with inline calendar */}
          <FilterSection label="Period">
            <DateRangePicker
              from={periodFrom}
              to={periodTo}
              onChangeFrom={(v) => setPeriod(v, useMaintenancePlanningStore.getState().periodTo)}
              onChangeTo={(v) => setPeriod(useMaintenancePlanningStore.getState().periodFrom, v)}
              inline
            />
          </FilterSection>

          {/* Aircraft Type */}
          <FilterSection label="Aircraft Type">
            <SelectDropdown
              value={aircraftTypeFilter}
              onChange={(v) => setFilter('aircraftType', v)}
              placeholder="All Types"
              options={filterOptions.aircraftTypes.map((t) => ({ value: t.id, label: `${t.icaoType} — ${t.name}` }))}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Base */}
          <FilterSection label="Base">
            <SelectDropdown
              value={baseFilter}
              onChange={(v) => setFilter('base', v)}
              placeholder="All Bases"
              options={filterOptions.bases.map((b) => ({ value: b.icao, label: b.icao }))}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Check Type */}
          <FilterSection label="Check Type">
            <SelectDropdown
              value={checkTypeFilter}
              onChange={(v) => setFilter('checkType', v)}
              placeholder="All Checks"
              options={filterOptions.checkTypes.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Event Status */}
          <FilterSection label="Event Status">
            <SelectDropdown
              value={statusFilter}
              onChange={(v) => setFilter('status', v)}
              placeholder="All Statuses"
              options={EVENT_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>
        </div>

        {/* Go Button */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
          <button
            onClick={handleGo}
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

function SelectDropdown({
  value,
  onChange,
  placeholder,
  options,
  isDark,
  inputBg,
  inputBorder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
  isDark: boolean
  inputBg: string
  inputBorder: string
}) {
  const [open, setOpen] = useState(false)
  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-xl text-[13px] font-medium transition-colors"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      >
        <span className={`truncate ${value ? 'text-hz-text' : 'text-hz-text-tertiary'}`}>{selectedLabel}</span>
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
          {/* "All" option */}
          <button
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className="w-full flex items-center h-8 px-3 hover:bg-hz-border/20 transition-colors"
          >
            <span className={`text-[13px] font-medium ${!value ? 'text-module-accent' : 'text-hz-text'}`}>
              {placeholder}
            </span>
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className="w-full flex items-center h-8 px-3 hover:bg-hz-border/20 transition-colors"
            >
              <span className={`text-[13px] font-medium ${value === o.value ? 'text-module-accent' : 'text-hz-text'}`}>
                {o.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
