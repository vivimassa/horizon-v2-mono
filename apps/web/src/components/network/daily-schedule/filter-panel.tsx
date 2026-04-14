'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Search, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Dropdown } from '@/components/ui/dropdown'
import { collapseDock } from '@/lib/dock-store'
import { useScheduleRefStore } from '@/stores/use-schedule-ref-store'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { useDailyScheduleStore, type TimeMode, type SortSequence } from '@/stores/use-daily-schedule-store'
import { api } from '@skyhub/api'
import type { AircraftRegistrationRef } from '@skyhub/api'

/* ── Constants ── */

const FLIGHT_STATUSES = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'crewed', label: 'Crewed' },
  { key: 'departed', label: 'Departed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const SORT_OPTIONS = [
  { value: 'date-std', label: 'Date → STD' },
  { value: 'date-reg-std', label: 'Date → Reg → STD' },
  { value: 'reg-date-std', label: 'Reg → Date → STD' },
  { value: 'flt-date', label: 'Flt# → Date' },
]

const TIME_MODES: { key: TimeMode; label: string }[] = [
  { key: 'utc', label: 'UTC' },
  { key: 'localBase', label: 'Base' },
  { key: 'localStation', label: 'Station' },
]

/* ── Component ── */

interface FilterPanelProps {
  onGo: (dateFrom: string, dateTo: string) => void
  loading?: boolean
}

export function FilterPanel({ onGo, loading }: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Store
  const store = useDailyScheduleStore()
  const {
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    timeFrom,
    timeTo,
    setTimeRange,
    acTypes,
    setAcTypes,
    acRegs,
    setAcRegs,
    domInt,
    setDomInt,
    statuses,
    setStatuses,
    showCancelled,
    setShowCancelled,
    timeModes,
    toggleTimeMode,
    sortSequence,
    setSortSequence,
  } = store

  // Load airports + registrations
  const [registrations, setRegistrations] = useState<AircraftRegistrationRef[]>([])
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  useEffect(() => {
    if (!operatorLoaded) return
    api.getAircraftRegistrations(getOperatorId()).then(setRegistrations)
  }, [operatorLoaded])

  // AC types from ref store
  const refAcTypes = useScheduleRefStore((s) => s.aircraftTypes)
  const acTypeItems = refAcTypes.filter((t) => t.isActive).map((t) => ({ key: t.icaoType, label: t.icaoType }))

  const regItems = registrations
    .filter((r) => r.status === 'active')
    .map((r) => ({ key: r.registration, label: r.registration }))

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const periodMissing = !dateFrom || !dateTo

  const handleGo = useCallback(() => {
    if (periodMissing) return
    collapseDock()
    onGo(dateFrom, dateTo)
    setCollapsed(true)
  }, [periodMissing, dateFrom, dateTo, onGo])

  const activeCount =
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (acTypes !== null ? 1 : 0) +
    (acRegs !== null ? 1 : 0) +
    (domInt !== 'all' ? 1 : 0) +
    (statuses !== null ? 1 : 0) +
    (timeFrom ? 1 : 0) +
    (timeTo ? 1 : 0)

  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden relative"
      style={{
        width: collapsed ? 44 : 300,
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(20px)',
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
            <DateRangePicker from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} inline />
          </FilterSection>

          {/* Time Range */}
          <FilterSection label="Time Range (UTC)">
            <div className="flex items-center gap-2">
              <TimeInput
                value={timeFrom}
                onChange={(v) => setTimeRange(v, timeTo)}
                placeholder="From"
                isDark={isDark}
                inputBg={inputBg}
                inputBorder={inputBorder}
              />
              <span className="text-[13px] text-hz-text-tertiary">-</span>
              <TimeInput
                value={timeTo}
                onChange={(v) => setTimeRange(timeFrom, v)}
                placeholder="To"
                isDark={isDark}
                inputBg={inputBg}
                inputBorder={inputBorder}
              />
            </div>
          </FilterSection>

          {/* AC Type */}
          <FilterSection label="Aircraft Type">
            <MultiDropdown
              items={acTypeItems}
              value={acTypes}
              onChange={setAcTypes}
              allLabel="All Types"
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* AC Reg */}
          <FilterSection label="Aircraft Registration">
            <MultiDropdown
              items={regItems}
              value={acRegs}
              onChange={setAcRegs}
              allLabel="All Registrations"
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* DOM/INT */}
          <FilterSection label="Route Type">
            <SegmentedToggle
              options={[
                { key: 'all', label: 'All' },
                { key: 'dom', label: 'DOM' },
                { key: 'int', label: 'INT' },
              ]}
              value={domInt}
              onChange={(v) => setDomInt(v as 'all' | 'dom' | 'int')}
              isDark={isDark}
            />
          </FilterSection>

          {/* Status */}
          <FilterSection label="Status">
            <MultiDropdown
              items={FLIGHT_STATUSES}
              value={statuses}
              onChange={setStatuses}
              allLabel="All Statuses"
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Show Cancelled */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-hz-text">Show Cancelled</span>
            <button
              onClick={() => setShowCancelled(!showCancelled)}
              className="w-9 h-5 rounded-full transition-colors relative"
              style={{
                background: showCancelled
                  ? 'var(--module-accent, #1e40af)'
                  : isDark
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(0,0,0,0.15)',
              }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ left: showCancelled ? 18 : 2 }}
              />
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${sectionBorder}` }} />

          {/* Times In */}
          <FilterSection label="Display Times In">
            <div className="flex gap-1.5">
              {TIME_MODES.map((m) => {
                const active = timeModes.has(m.key)
                return (
                  <button
                    key={m.key}
                    onClick={() => toggleTimeMode(m.key)}
                    className="flex-1 h-8 rounded-lg text-[13px] font-semibold transition-all"
                    style={{
                      background: active
                        ? 'var(--module-accent, #1e40af)'
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                      color: active ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                      border: `1px solid ${active ? 'transparent' : inputBorder}`,
                    }}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </FilterSection>

          {/* Sort */}
          <FilterSection label="Sort Sequence">
            <Dropdown
              value={sortSequence}
              options={SORT_OPTIONS}
              onChange={(v) => setSortSequence(v as SortSequence)}
              placeholder="Date → STD"
            />
          </FilterSection>
        </div>

        {/* Go Button */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
          <button
            onClick={handleGo}
            disabled={loading || periodMissing}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Loading...' : 'Go'}
          </button>
          {periodMissing && (
            <p className="text-[13px] text-hz-text-secondary mt-1.5 text-center">Select the period to continue</p>
          )}
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

function TimeInput({
  value,
  onChange,
  placeholder,
  isDark,
  inputBg,
  inputBorder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  isDark: boolean
  inputBg: string
  inputBorder: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        let v = e.target.value.replace(/[^0-9:]/g, '')
        if (v.length === 2 && !v.includes(':')) v += ':'
        if (v.length > 5) v = v.slice(0, 5)
        onChange(v)
      }}
      placeholder={placeholder}
      maxLength={5}
      className="w-full h-9 px-3 rounded-xl text-[13px] font-medium outline-none text-hz-text placeholder:text-hz-text-tertiary text-center"
      style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
    />
  )
}

function SegmentedToggle({
  options,
  value,
  onChange,
  isDark,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
  isDark: boolean
}) {
  return (
    <div
      className="flex rounded-xl overflow-hidden"
      style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}` }}
    >
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="flex-1 h-8 text-[13px] font-semibold transition-all"
          style={{
            background: value === o.key ? 'var(--module-accent, #1e40af)' : 'transparent',
            color: value === o.key ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function MultiDropdown({
  items,
  value,
  onChange,
  allLabel,
  isDark,
  inputBg,
  inputBorder,
}: {
  items: { key: string; label: string }[]
  value: Set<string> | null
  onChange: (v: Set<string> | null) => void
  allLabel: string
  isDark: boolean
  inputBg: string
  inputBorder: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const allSelected = value === null || items.every((i) => value.has(i.key))

  const displayLabel = allSelected
    ? allLabel
    : items
        .filter((i) => value?.has(i.key))
        .map((i) => i.key)
        .join(', ') || 'None'

  function toggle(key: string) {
    const all = new Set(items.map((i) => i.key))
    if (value === null) {
      all.delete(key)
      onChange(all)
    } else {
      const next = new Set(value)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      if (items.every((i) => next.has(i.key))) onChange(null)
      else onChange(next)
    }
  }

  const filtered = search
    ? items.filter(
        (i) =>
          i.key.toLowerCase().includes(search.toLowerCase()) || i.label.toLowerCase().includes(search.toLowerCase()),
      )
    : items

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-xl text-[13px] font-medium transition-colors"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      >
        <span className="truncate text-hz-text">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`text-hz-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden"
          style={{
            background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${inputBorder}`,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(96,97,112,0.12)',
          }}
        >
          <div className="px-2 pt-2 pb-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full h-7 px-2 rounded-lg text-[13px] outline-none text-hz-text placeholder:text-hz-text-tertiary"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${inputBorder}`,
              }}
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1">
            {filtered.map((item) => {
              const checked = value === null || value.has(item.key)
              const accentColor = 'var(--module-accent, #1e40af)'
              return (
                <button
                  key={item.key}
                  onClick={() => toggle(item.key)}
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
                  <span className="text-[13px] font-medium text-hz-text truncate">{item.label}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <div className="px-3 py-2 text-[13px] text-hz-text-tertiary">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}
