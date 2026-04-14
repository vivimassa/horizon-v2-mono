'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Search, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { collapseDock } from '@/lib/dock-store'
import { useStatusBoardStore } from '@/stores/use-status-board-store'

const HEALTH_OPTIONS = [
  { value: 'serviceable', label: 'Serviceable' },
  { value: 'attention', label: 'Attention' },
  { value: 'critical', label: 'Critical' },
]

const CHECK_WITHIN_OPTIONS = [
  { value: '7', label: 'Within 7 days' },
  { value: '14', label: 'Within 14 days' },
  { value: '30', label: 'Within 30 days' },
  { value: '60', label: 'Within 60 days' },
]

const SORT_OPTIONS = [
  { value: 'registration', label: 'Registration' },
  { value: 'most_urgent', label: 'Most Urgent' },
  { value: 'fh', label: 'Flight Hours' },
  { value: 'cycles', label: 'Cycles' },
  { value: 'next_check_date', label: 'Next Check Date' },
]

export function StatusBoardFilterPanel({
  onGo,
  forceCollapsed = false,
}: {
  onGo?: () => void
  forceCollapsed?: boolean
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [collapsed, setCollapsed] = useState(false)

  const filterOptions = useStatusBoardStore((s) => s.filterOptions)
  const aircraftTypeFilter = useStatusBoardStore((s) => s.aircraftTypeFilter)
  const baseFilter = useStatusBoardStore((s) => s.baseFilter)
  const healthStatusFilter = useStatusBoardStore((s) => s.healthStatusFilter)
  const nextCheckWithin = useStatusBoardStore((s) => s.nextCheckWithin)
  const sortBy = useStatusBoardStore((s) => s.sortBy)
  const loading = useStatusBoardStore((s) => s.loading)
  const setFilter = useStatusBoardStore((s) => s.setFilter)
  const setSortBy = useStatusBoardStore((s) => s.setSortBy)

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const activeCount =
    (aircraftTypeFilter ? 1 : 0) + (baseFilter ? 1 : 0) + (healthStatusFilter ? 1 : 0) + (nextCheckWithin ? 1 : 0)

  return (
    <div
      className="shrink-0 h-full flex flex-col rounded-2xl overflow-hidden relative"
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
          <SectionLabel>Fleet Filters</SectionLabel>

          <FilterSection label="Aircraft Type">
            <SelectDropdown
              value={aircraftTypeFilter}
              onChange={(v) => setFilter('aircraftType', v)}
              placeholder="All Types"
              options={filterOptions.aircraftTypes.map((t) => ({ value: t.id, label: t.icaoType }))}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          <FilterSection label="Base">
            <SelectDropdown
              value={baseFilter}
              onChange={(v) => setFilter('base', v)}
              placeholder="All Bases"
              options={filterOptions.bases.map((b) => ({ value: b, label: b }))}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          <FilterSection label="Health Status">
            <SelectDropdown
              value={healthStatusFilter}
              onChange={(v) => setFilter('healthStatus', v)}
              placeholder="All Statuses"
              options={HEALTH_OPTIONS}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          <SectionLabel>Check Filters</SectionLabel>

          <FilterSection label="Next Check Within">
            <SelectDropdown
              value={nextCheckWithin}
              onChange={(v) => setFilter('nextCheckWithin', v)}
              placeholder="Any"
              options={CHECK_WITHIN_OPTIONS}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          <SectionLabel>Display</SectionLabel>

          <FilterSection label="Sort By">
            <SelectDropdown
              value={sortBy}
              onChange={(v) => setSortBy(v)}
              placeholder="Registration"
              options={SORT_OPTIONS}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>
        </div>

        {/* Go Button */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
          <button
            onClick={() => {
              collapseDock()
              ;(onGo ?? useStatusBoardStore.getState().loadData)()
              setCollapsed(true)
            }}
            disabled={loading}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary pt-1">{children}</div>
}

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
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden py-1 max-h-48 overflow-y-auto"
          style={{
            background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${inputBorder}`,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(96,97,112,0.12)',
          }}
        >
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
