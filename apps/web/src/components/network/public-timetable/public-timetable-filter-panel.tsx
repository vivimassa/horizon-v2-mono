'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Filter, Loader2, Search } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { collapseDock } from '@/lib/dock-store'
import { usePublicTimetableStore } from '@/stores/use-public-timetable-store'
import type { AirportRef, CityPairRef } from '@skyhub/api'
import type { DirectionMode } from '@/lib/public-timetable/logic'
import { AirportComboBox, type AirportOption } from './airport-combobox'

interface FilterPanelProps {
  airports: AirportRef[]
  cityPairs: CityPairRef[]
  onGo: () => void
  loading?: boolean
}

const DIRECTION_OPTIONS: { key: DirectionMode; label: string }[] = [
  { key: 'both', label: 'Both' },
  { key: 'outbound', label: 'Outbound' },
  { key: 'return', label: 'Return' },
]

function ddmmyyyyToIso(s: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim())
  if (!m) return ''
  const [, dd, mm, yyyy] = m
  const day = Number(dd)
  const month = Number(mm)
  const year = Number(yyyy)
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${yyyy}-${mm}-${dd}`
}

function isoToDdmmyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

function maskDdmmyyyy(raw: string, prev: string): string {
  let v = raw.replace(/[^\d]/g, '').slice(0, 8)
  if (v.length >= 5) v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`
  else if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`
  // Allow backspace through separators
  if (raw.length < prev.length && prev.endsWith('/')) return prev.slice(0, -1)
  return v
}

export function PublicTimetableFilterPanel({ airports, cityPairs, onGo, loading }: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const {
    dateFrom,
    dateTo,
    from,
    to,
    direction,
    effectiveDate,
    setDateFrom,
    setDateTo,
    setFrom,
    setTo,
    setDirection,
    setEffectiveDate,
    commit,
  } = usePublicTimetableStore()

  const [effInput, setEffInput] = useState(() => isoToDdmmyyyy(effectiveDate))

  useEffect(() => {
    setEffInput(isoToDdmmyyyy(effectiveDate))
  }, [effectiveDate])

  const airportByCode = useMemo(() => {
    const m = new Map<string, AirportRef>()
    for (const a of airports) {
      if (a.iataCode) m.set(a.iataCode.toUpperCase(), a)
      if (a.icaoCode) m.set(a.icaoCode.toUpperCase(), a)
    }
    return m
  }, [airports])

  const fromOptions = useMemo<AirportOption[]>(() => {
    const codes = new Set<string>()
    for (const cp of cityPairs) {
      if (!cp.isActive) continue
      if (cp.station1Iata || cp.station1Icao) codes.add((cp.station1Iata || cp.station1Icao).toUpperCase())
      if (cp.station2Iata || cp.station2Icao) codes.add((cp.station2Iata || cp.station2Icao).toUpperCase())
    }
    return Array.from(codes)
      .map((code) => {
        const a = airportByCode.get(code)
        return {
          code,
          iata: a?.iataCode ?? code,
          icao: a?.icaoCode ?? code,
          name: a?.name ?? '',
          city: a?.city ?? '',
          country: a?.countryName ?? '',
        }
      })
      .sort((a, b) => a.iata.localeCompare(b.iata))
  }, [cityPairs, airportByCode])

  const toOptions = useMemo<AirportOption[]>(() => {
    if (!from) return fromOptions
    const paired = new Set<string>()
    for (const cp of cityPairs) {
      if (!cp.isActive) continue
      const s1 = (cp.station1Iata || cp.station1Icao).toUpperCase()
      const s2 = (cp.station2Iata || cp.station2Icao).toUpperCase()
      if (s1 === from) paired.add(s2)
      else if (s2 === from) paired.add(s1)
    }
    return fromOptions.filter((o) => paired.has(o.code))
  }, [fromOptions, cityPairs, from])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const canGo = Boolean(dateFrom && dateTo && from && to)

  const handleGo = useCallback(() => {
    if (!canGo) return
    collapseDock()
    commit()
    onGo()
    setCollapsed(true)
  }, [canGo, commit, onGo])

  const activeCount = [dateFrom, dateTo, from, to, effectiveDate, direction !== 'both' ? '1' : ''].filter(
    Boolean,
  ).length

  function handleEffectiveChange(raw: string) {
    const masked = maskDdmmyyyy(raw, effInput)
    setEffInput(masked)
    const iso = ddmmyyyyToIso(masked)
    setEffectiveDate(iso)
  }

  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden relative"
      style={{
        width: collapsed ? 44 : 300,
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(20px)',
        boxShadow: isDark ? 'none' : '0 4px 12px -4px rgba(96,97,112,0.08)',
      }}
    >
      <div
        className="absolute inset-0 flex flex-col items-center cursor-pointer hover:bg-hz-border/20 transition-colors"
        onClick={() => collapsed && setCollapsed(false)}
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

      <div
        className="flex flex-col h-full min-w-[300px]"
        style={{
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: 'opacity 200ms ease',
        }}
      >
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          <FilterSection label="Date Range">
            <DateRangePicker from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} inline />
          </FilterSection>

          <FilterSection label="From">
            <AirportComboBox
              options={fromOptions}
              value={from}
              onChange={(code) => {
                setFrom(code)
                if (code && to && code === to) setTo('')
              }}
              placeholder="Type to search origin..."
            />
          </FilterSection>

          <FilterSection label="To">
            <AirportComboBox
              options={toOptions}
              value={to}
              onChange={setTo}
              placeholder={from ? 'Type to search destination...' : 'Select origin first'}
              disabled={!from}
            />
          </FilterSection>

          <FilterSection label="Direction">
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
              {DIRECTION_OPTIONS.map((o) => {
                const active = direction === o.key
                return (
                  <button
                    key={o.key}
                    onClick={() => setDirection(o.key)}
                    className="flex-1 h-8 text-[13px] font-semibold transition-all"
                    style={{
                      background: active ? 'var(--module-accent, #2563eb)' : 'transparent',
                      color: active ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
                    }}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </FilterSection>

          <FilterSection label="Effective Date">
            <input
              type="text"
              inputMode="numeric"
              value={effInput}
              onChange={(e) => handleEffectiveChange(e.target.value)}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-full h-9 px-3 rounded-lg text-[13px] font-medium outline-none text-hz-text placeholder:text-hz-text-tertiary"
              style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
            />
          </FilterSection>
        </div>

        <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
          <button
            onClick={handleGo}
            disabled={loading || !canGo}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Loading...' : 'Go'}
          </button>
          {!canGo && (
            <p className="text-[13px] text-hz-text-secondary mt-1.5 text-center">
              Select period, From &amp; To airport
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary block">{label}</label>
      {children}
    </div>
  )
}
