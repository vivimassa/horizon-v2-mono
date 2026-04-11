'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Search, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useScheduleRefStore } from '@/stores/use-schedule-ref-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport } from '@skyhub/api'
import { getCurrentSeason } from './slot-types'
import type { SlotStatus } from './slot-types'

const SEASONS = ['S25', 'W25', 'S26', 'W26', 'S27', 'W27']

const SLOT_STATUSES: { key: SlotStatus; label: string; color: string }[] = [
  { key: 'confirmed', label: 'Confirmed', color: '#06C270' },
  { key: 'offered', label: 'Offered', color: '#FF8800' },
  { key: 'waitlisted', label: 'Waitlisted', color: '#7c3aed' },
  { key: 'refused', label: 'Refused', color: '#FF3B3B' },
  { key: 'submitted', label: 'Submitted', color: '#0063F7' },
  { key: 'draft', label: 'Draft', color: '#8F90A6' },
  { key: 'historic', label: 'Historic', color: '#00CFDE' },
]

const RISK_LEVELS = ['all', 'safe', 'close', 'at_risk'] as const

/** Season start/end defaults */
function seasonDates(code: string): { from: string; to: string } {
  const yr = 2000 + parseInt(code.slice(1), 10)
  if (code[0] === 'S') return { from: `${yr}-03-29`, to: `${yr}-10-24` }
  return { from: `${yr}-10-25`, to: `${yr + 1}-03-28` }
}

export interface SlotFilterState {
  periodFrom: string
  periodTo: string
  seasonCode: string
  airports: string[] | null
  acTypes: string[] | null
  statuses: string[] | null
  riskLevel: string
}

interface SlotFilterPanelProps {
  forceCollapsed?: boolean
  loading?: boolean
  onGo: (filters: SlotFilterState) => void
}

export function SlotFilterPanel({ forceCollapsed = false, loading = false, onGo }: SlotFilterPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [collapsed, setCollapsed] = useState(false)
  const defaultSeason = getCurrentSeason()
  const defaultDates = seasonDates(defaultSeason)

  const [seasonCode, setSeasonCode] = useState(defaultSeason)
  const [periodFrom, setPeriodFrom] = useState(defaultDates.from)
  const [periodTo, setPeriodTo] = useState(defaultDates.to)
  const [selectedAirports, setSelectedAirports] = useState<Set<string> | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(SLOT_STATUSES.map((s) => s.key)))
  const [riskLevel, setRiskLevel] = useState<string>('all')

  // Load airport list
  const [airports, setAirports] = useState<SlotCoordinatedAirport[]>([])
  useEffect(() => {
    api.getSlotAirports().then(setAirports)
  }, [])

  // AC types from ref store
  const refAcTypes = useScheduleRefStore((s) => s.aircraftTypes)
  const loadRefData = useScheduleRefStore((s) => s.loadAll)
  const refLoaded = useScheduleRefStore((s) => s.loaded)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  useEffect(() => {
    if (operatorLoaded && !refLoaded) loadRefData()
  }, [operatorLoaded, refLoaded, loadRefData])
  const acTypeIcaos = refAcTypes.filter((t) => t.isActive).map((t) => t.icaoType)

  // Auto-update period when season changes
  useEffect(() => {
    const dates = seasonDates(seasonCode)
    setPeriodFrom(dates.from)
    setPeriodTo(dates.to)
  }, [seasonCode])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const activeCount = mounted
    ? [periodFrom, periodTo].filter(Boolean).length +
      (selectedAirports !== null ? 1 : 0) +
      (selectedTypes !== null ? 1 : 0) +
      (selectedStatuses.size < SLOT_STATUSES.length ? 1 : 0) +
      (riskLevel !== 'all' ? 1 : 0)
    : 0

  function handleGo() {
    onGo({
      periodFrom,
      periodTo,
      seasonCode,
      airports: selectedAirports ? [...selectedAirports] : null,
      acTypes: selectedTypes ? [...selectedTypes] : null,
      statuses: selectedStatuses.size < SLOT_STATUSES.length ? [...selectedStatuses] : null,
      riskLevel,
    })
    setCollapsed(true)
  }

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
          {/* Season */}
          <FilterSection label="Season">
            <div className="relative">
              <select
                value={seasonCode}
                onChange={(e) => setSeasonCode(e.target.value)}
                className="w-full h-9 pl-3 pr-8 rounded-xl text-[13px] font-medium appearance-none cursor-pointer outline-none"
                style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
              >
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s[0] === 'S' ? `Summer 20${s.slice(1)}` : `Winter 20${s.slice(1)}`}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-hz-text-tertiary"
              />
            </div>
          </FilterSection>

          {/* Period */}
          <FilterSection label="Period">
            <DateRangePicker
              from={periodFrom}
              to={periodTo}
              onChangeFrom={setPeriodFrom}
              onChangeTo={setPeriodTo}
              inline
            />
          </FilterSection>

          {/* Airport */}
          <FilterSection label="Airport">
            <MultiDropdown
              items={airports.map((a) => ({ key: a.iataCode, label: a.iataCode, sublabel: `L${a.coordinationLevel}` }))}
              value={selectedAirports}
              onChange={setSelectedAirports}
              allLabel="All Airports"
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Aircraft Type */}
          <FilterSection label="Aircraft Type">
            <MultiDropdown
              items={acTypeIcaos.map((t) => ({ key: t, label: t }))}
              value={selectedTypes}
              onChange={setSelectedTypes}
              allLabel="All Types"
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Slot Status */}
          <FilterSection label="Slot Status">
            <MultiDropdown
              items={SLOT_STATUSES.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
              value={selectedStatuses.size === SLOT_STATUSES.length ? null : selectedStatuses}
              onChange={(v) => setSelectedStatuses(v === null ? new Set(SLOT_STATUSES.map((s) => s.key)) : v)}
              allLabel="All Statuses"
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Risk Level */}
          <FilterSection label="Risk Level">
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
              {RISK_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setRiskLevel(level)}
                  className="flex-1 py-2 text-[13px] font-semibold transition-colors duration-150"
                  style={
                    riskLevel === level
                      ? {
                          background: isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.10)',
                          color: isDark ? '#5B8DEF' : '#1e40af',
                        }
                      : { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }
                  }
                >
                  {level === 'all' ? 'All' : level === 'safe' ? 'Safe' : level === 'close' ? 'Close' : 'Risk'}
                </button>
              ))}
            </div>
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

function MultiDropdown({
  items,
  value,
  onChange,
  allLabel,
  isDark,
  inputBg,
  inputBorder,
}: {
  items: { key: string; label: string; sublabel?: string; color?: string }[]
  value: Set<string> | null
  onChange: (v: Set<string> | null) => void
  allLabel: string
  isDark: boolean
  inputBg: string
  inputBorder: string
}) {
  const [open, setOpen] = useState(false)
  const allSelected = value === null || items.every((i) => value.has(i.key))

  const label = allSelected
    ? allLabel
    : items
        .filter((i) => value?.has(i.key))
        .map((i) => i.label)
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
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden py-1 max-h-[200px] overflow-y-auto"
          style={{
            background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${inputBorder}`,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(96,97,112,0.12)',
          }}
        >
          {items.map((item) => {
            const checked = value === null || value.has(item.key)
            const accentColor = item.color || 'var(--module-accent, #1e40af)'
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
                <span className="text-[13px] font-medium text-hz-text">{item.label}</span>
                {item.sublabel && <span className="text-[13px] text-hz-text-tertiary ml-auto">{item.sublabel}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
