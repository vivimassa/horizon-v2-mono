"use client"

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Globe, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport, SlotFleetAirportStats, SlotSeriesRef, SlotUtilizationSummary } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { UnifiedSeriesRow } from './components/unified-series-row'

interface FleetOverviewProps {
  airports: SlotCoordinatedAirport[]
  fleetStats: SlotFleetAirportStats[]
  seasonCode: string
  onSelectAirport: (iata: string) => void
  isDark: boolean
  viewMode?: 'grid' | 'list'
  searchQuery?: string
}

// Grid column template — shared by header and rows for perfect alignment
const GRID_COLS = '28px 56px 40px 1fr 70px 70px 70px 70px 70px 160px'

export function FleetOverview({
  airports, fleetStats, seasonCode, onSelectAirport, isDark, viewMode = 'list', searchQuery = '',
}: FleetOverviewProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  const nameMap = useMemo(() => {
    const m = new Map<string, SlotCoordinatedAirport>()
    for (const a of airports) m.set(a.iataCode, a)
    return m
  }, [airports])

  const sorted = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filtered = q
      ? fleetStats.filter(s => {
          const airport = nameMap.get(s.airportIata)
          return s.airportIata.toLowerCase().includes(q)
            || (airport?.name.toLowerCase().includes(q))
        })
      : fleetStats
    return [...filtered].sort((a, b) => a.utilizationPct - b.utilizationPct)
  }, [fleetStats, searchQuery, nameMap])

  // Fleet-wide KPIs
  const totals = useMemo(() => {
    let series = 0, confirmed = 0, atRisk = 0, pending = 0
    for (const s of fleetStats) {
      series += s.totalSeries
      confirmed += s.confirmed
      if (s.utilizationPct < 80 && s.totalDates > 0) atRisk += s.totalSeries
      pending += s.draft + s.submitted
    }
    return { series, confirmed, atRisk, pending, airports: fleetStats.length }
  }, [fleetStats])

  const kpis = [
    { label: 'Airports', value: totals.airports, icon: Globe, color: accent },
    { label: 'Total Series', value: totals.series, icon: TrendingUp, color: accent },
    { label: 'Confirmed', value: totals.confirmed, icon: CheckCircle, color: '#06C270' },
    { label: 'At Risk', value: totals.atRisk, icon: AlertTriangle, color: '#FF3B3B' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Fleet KPI strip */}
      <div className="flex gap-2.5 px-5 pt-4 pb-3 shrink-0">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="flex-1 flex items-center gap-3 rounded-xl px-3.5 py-3"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                border: `1px solid ${glassBorder}`,
              }}>
              <Icon size={16} style={{ color: k.color }} />
              <div>
                <div className="text-[18px] font-bold leading-tight" style={{ color: k.color }}>{k.value}</div>
                <div className="text-[13px] uppercase tracking-wide font-medium" style={{ color: palette.textSecondary }}>{k.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {viewMode === 'list' ? (
        <>
          {/* Column header */}
          <div className="grid items-center px-5 py-2 shrink-0"
            style={{
              gridTemplateColumns: GRID_COLS,
              borderBottom: `1px solid ${glassBorder}`,
            }}>
            <span /> {/* chevron */}
            <ColHeader text="IATA" palette={palette} />
            <ColHeader text="Lvl" palette={palette} />
            <ColHeader text="Airport Name" palette={palette} />
            <ColHeader text="Series" palette={palette} align="center" />
            <ColHeader text="Conf" palette={palette} align="center" />
            <ColHeader text="Offer" palette={palette} align="center" />
            <ColHeader text="Wait" palette={palette} align="center" />
            <ColHeader text="Refuse" palette={palette} align="center" />
            <ColHeader text="Utilization" palette={palette} />
          </div>

          {/* Accordion rows */}
          <div className="flex-1 overflow-auto">
            {sorted.map(stats => {
              const airport = nameMap.get(stats.airportIata)
              if (!airport) return null
              return (
                <AirportAccordionRow
                  key={stats.airportIata}
                  stats={stats}
                  airport={airport}
                  seasonCode={seasonCode}
                  isDark={isDark}
                  palette={palette}
                  glassBorder={glassBorder}
                  accent={accent}
                />
              )
            })}
          </div>
        </>
      ) : (
        /* Card grid view */
        <div className="flex-1 overflow-auto px-5 pb-5 pt-3">
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {sorted.map(stats => {
              const airport = nameMap.get(stats.airportIata)
              if (!airport) return null
              const pct = stats.utilizationPct
              const pctColor = pct < 80 ? '#FF3B3B' : pct < 85 ? '#FF8800' : '#06C270'
              const levelColor = airport.coordinationLevel === 3 ? '#06C270' : '#FF8800'
              const isAtRisk = pct < 80 && stats.totalDates > 0

              return (
                <button
                  key={stats.airportIata}
                  type="button"
                  onClick={() => onSelectAirport(stats.airportIata)}
                  className="group rounded-xl px-4 py-3.5 text-left transition-all duration-150"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                    border: `1px solid ${isAtRisk ? 'rgba(255,59,59,0.15)' : glassBorder}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accentTint(accent, 0.3) }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = isAtRisk ? 'rgba(255,59,59,0.15)' : glassBorder }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: levelColor }} />
                    <span className="text-[15px] font-bold" style={{ color: palette.text }}>{stats.airportIata}</span>
                    <span className="text-[13px] font-semibold px-1 rounded" style={{ background: `${levelColor}15`, color: levelColor }}>
                      L{airport.coordinationLevel}
                    </span>
                    <span className="flex-1" />
                    <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" style={{ color: palette.textTertiary }} />
                  </div>
                  <div className="text-[13px] truncate mb-3" style={{ color: palette.textTertiary }}>{airport.name}</div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pctColor }} />
                    </div>
                    <span className="text-[13px] font-bold" style={{ color: pctColor }}>
                      {stats.totalDates > 0 ? `${pct}%` : '\u2014'}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[13px]">
                    <StatusDot label="Total" value={stats.totalSeries} color={palette.textSecondary} />
                    <StatusDot label="Conf" value={stats.confirmed} color="#06C270" />
                    <StatusDot label="Offer" value={stats.offered} color="#FF8800" />
                    <StatusDot label="Wait" value={stats.waitlisted} color="#7c3aed" />
                    {stats.refused > 0 && <StatusDot label="Ref" value={stats.refused} color="#FF3B3B" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="text-center py-16">
          <Globe size={32} style={{ color: palette.textTertiary, opacity: 0.3 }} className="mx-auto mb-3" />
          <div className="text-[14px]" style={{ color: palette.textSecondary }}>No slot series for {seasonCode}</div>
          <div className="text-[13px] mt-1" style={{ color: palette.textTertiary }}>Select an airport and import from schedule to get started</div>
        </div>
      )}
    </div>
  )
}

/* ── Column Header ── */

function ColHeader({ text, palette, align }: { text: string; palette: { textTertiary: string }; align?: string }) {
  return (
    <span className="text-[13px] font-medium uppercase tracking-wide"
      style={{ color: palette.textTertiary, textAlign: align as any }}>
      {text}
    </span>
  )
}

/* ── Airport Accordion Row ── */

function AirportAccordionRow({ stats, airport, seasonCode, isDark, palette, glassBorder, accent }: {
  stats: SlotFleetAirportStats
  airport: SlotCoordinatedAirport
  seasonCode: string
  isDark: boolean
  palette: { text: string; textSecondary: string; textTertiary: string }
  glassBorder: string
  accent: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [series, setSeries] = useState<SlotSeriesRef[]>([])
  const [utilization, setUtilization] = useState<SlotUtilizationSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  // Lazy load series when expanded
  useEffect(() => {
    if (expanded && !loaded) {
      const opId = getOperatorId()
      Promise.all([
        api.getSlotSeries(opId, stats.airportIata, seasonCode),
        api.getSlotUtilization(opId, stats.airportIata, seasonCode),
      ]).then(([s, u]) => {
        setSeries(s)
        setUtilization(u)
        setLoaded(true)
      })
    }
  }, [expanded, loaded, stats.airportIata, seasonCode])

  const handleDataChanged = useCallback(() => {
    setLoaded(false) // force reload on next expand
  }, [])

  const pct = stats.utilizationPct
  const pctColor = pct < 80 ? '#FF3B3B' : pct < 85 ? '#FF8800' : '#06C270'
  const levelColor = airport.coordinationLevel === 3 ? '#06C270' : '#FF8800'
  const utilMap = new Map(utilization.map(u => [u.seriesId, u]))

  return (
    <div style={{ borderBottom: `1px solid ${glassBorder}` }}>
      {/* Airport row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full grid items-center px-5 py-2.5 text-left transition-colors"
        style={{ gridTemplateColumns: GRID_COLS }}
        onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {/* Chevron */}
        {expanded
          ? <ChevronDown size={14} style={{ color: palette.textSecondary }} />
          : <ChevronRight size={14} style={{ color: palette.textSecondary }} />
        }

        {/* IATA code */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: levelColor }} />
          <span className="text-[14px] font-bold" style={{ color: palette.text }}>{stats.airportIata}</span>
        </div>

        {/* Level badge */}
        <span className="text-[13px] font-semibold px-1 rounded inline-block w-fit" style={{ background: `${levelColor}15`, color: levelColor }}>
          L{airport.coordinationLevel}
        </span>

        {/* Name */}
        <span className="text-[13px] truncate pr-3" style={{ color: palette.textSecondary }}>
          {airport.name}
        </span>

        {/* Series count */}
        <span className="text-[14px] font-semibold text-center" style={{ color: palette.text }}>
          {stats.totalSeries}
        </span>

        {/* Confirmed */}
        <span className="text-[14px] font-semibold text-center" style={{ color: stats.confirmed > 0 ? '#06C270' : palette.textTertiary }}>
          {stats.confirmed}
        </span>

        {/* Offered */}
        <span className="text-[14px] font-semibold text-center" style={{ color: stats.offered > 0 ? '#FF8800' : palette.textTertiary }}>
          {stats.offered}
        </span>

        {/* Waitlisted */}
        <span className="text-[14px] font-semibold text-center" style={{ color: stats.waitlisted > 0 ? '#7c3aed' : palette.textTertiary }}>
          {stats.waitlisted}
        </span>

        {/* Refused */}
        <span className="text-[14px] font-semibold text-center" style={{ color: stats.refused > 0 ? '#FF3B3B' : palette.textTertiary }}>
          {stats.refused}
        </span>

        {/* Utilization bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[5px] rounded-full overflow-hidden"
            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pctColor }} />
          </div>
          <span className="text-[13px] font-bold w-[36px] text-right" style={{ color: pctColor }}>
            {stats.totalDates > 0 ? `${pct}%` : '\u2014'}
          </span>
        </div>
      </button>

      {/* Expanded: series list */}
      {expanded && (
        <div className="pl-10 pr-5 pb-3"
          style={{ background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)' }}>
          {!loaded ? (
            <div className="py-4 text-[13px]" style={{ color: palette.textTertiary }}>Loading series...</div>
          ) : series.length === 0 ? (
            <div className="py-4 text-[13px]" style={{ color: palette.textTertiary }}>No slot series at this airport</div>
          ) : (
            series.map(s => (
              <UnifiedSeriesRow
                key={s._id}
                series={s}
                utilization={utilMap.get(s._id)}
                onDataChanged={handleDataChanged}
                isDark={isDark}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function StatusDot({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span style={{ color }}>{value}</span>
      <span className="opacity-60" style={{ color }}>{label}</span>
    </div>
  )
}
