'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, AlertTriangle, Clock } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import type { SlotCoordinatedAirport, SlotFleetAirportStats } from '@skyhub/api'

interface AirportListPanelProps {
  airports: SlotCoordinatedAirport[]
  fleetStats: SlotFleetAirportStats[]
  selectedIata: string | null
  onSelect: (iata: string | null) => void
  seasonCode: string
  onSeasonChange: (code: string) => void
  isDark: boolean
}

const SEASONS = ['S25', 'W25', 'S26', 'W26', 'S27', 'W27']

/** Compute days until Historics Baseline Date */
function getHBDInfo(seasonCode: string): { date: string; daysLeft: number } {
  const type = seasonCode[0] // S or W
  const yearNum = 2000 + parseInt(seasonCode.slice(1), 10)
  // Summer HBD = Jan 31 of same year, Winter HBD = Aug 31 of first year
  const hbd =
    type === 'S'
      ? new Date(yearNum, 0, 31) // Jan 31
      : new Date(yearNum, 7, 31) // Aug 31
  const now = new Date()
  const diff = Math.ceil((hbd.getTime() - now.getTime()) / 86400000)
  const label = hbd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return { date: label, daysLeft: diff }
}

export function AirportListPanel({
  airports,
  fleetStats,
  selectedIata,
  onSelect,
  seasonCode,
  onSeasonChange,
  isDark,
}: AirportListPanelProps) {
  const [search, setSearch] = useState('')
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent

  const statsMap = useMemo(() => {
    const m = new Map<string, SlotFleetAirportStats>()
    for (const s of fleetStats) m.set(s.airportIata, s)
    return m
  }, [fleetStats])

  // Sort airports: at-risk first, then by utilization ascending
  const sorted = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = airports.filter(
      (a) => !q || a.iataCode.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
    )
    return [...filtered].sort((a, b) => {
      const sa = statsMap.get(a.iataCode)
      const sb = statsMap.get(b.iataCode)
      const ua = sa?.utilizationPct ?? 100
      const ub = sb?.utilizationPct ?? 100
      return ua - ub // worst first
    })
  }, [airports, search, statsMap])

  const hbd = getHBDInfo(seasonCode)
  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const hbdUrgent = hbd.daysLeft <= 30 && hbd.daysLeft > 0

  return (
    <div
      className="shrink-0 w-[300px] rounded-2xl flex flex-col overflow-hidden"
      style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
    >
      {/* Season selector + HBD countdown */}
      <div className="px-4 pt-4 pb-2 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
          <span className="text-[14px] font-semibold flex-1" style={{ color: palette.text }}>
            Slot Manager
          </span>
          {/* Fleet overview button */}
          {selectedIata && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-[13px] font-medium px-2 py-1 rounded-lg transition-colors hover:opacity-80"
              style={{ background: accentTint(accent, isDark ? 0.12 : 0.08), color: accent }}
            >
              Fleet View
            </button>
          )}
        </div>

        {/* Season dropdown */}
        <div className="relative">
          <select
            value={seasonCode}
            onChange={(e) => onSeasonChange(e.target.value)}
            className="w-full h-9 pl-3 pr-8 rounded-xl text-[13px] font-medium appearance-none cursor-pointer outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${glassBorder}`,
              color: palette.text,
            }}
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s[0] === 'S' ? `Summer 20${s.slice(1)}` : `Winter 20${s.slice(1)}`}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: palette.textSecondary }}
          />
        </div>

        {/* HBD countdown */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: hbdUrgent
              ? isDark
                ? 'rgba(255,136,0,0.1)'
                : 'rgba(255,136,0,0.06)'
              : isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.02)',
            border: `1px solid ${hbdUrgent ? 'rgba(255,136,0,0.2)' : glassBorder}`,
          }}
        >
          {hbdUrgent ? (
            <AlertTriangle size={13} style={{ color: '#FF8800' }} />
          ) : (
            <Clock size={13} style={{ color: palette.textTertiary }} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] uppercase tracking-wide font-medium" style={{ color: palette.textTertiary }}>
              Historics Baseline
            </div>
            <div className="text-[13px] font-medium" style={{ color: hbdUrgent ? '#FF8800' : palette.textSecondary }}>
              {hbd.date}{' '}
              {hbd.daysLeft > 0
                ? `\u2014 ${hbd.daysLeft}d left`
                : hbd.daysLeft === 0
                  ? '\u2014 TODAY'
                  : '\u2014 passed'}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2"
            size={14}
            style={{ color: palette.textTertiary }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search airports..."
            className="w-full pl-9 pr-3 h-9 rounded-xl text-[13px] outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${glassBorder}`,
              color: palette.text,
            }}
          />
        </div>
      </div>

      {/* Airport list with health bars */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sorted.map((a) => {
          const isSelected = selectedIata === a.iataCode
          const stats = statsMap.get(a.iataCode)
          const pct = stats?.utilizationPct ?? 0
          const hasSeries = (stats?.totalSeries ?? 0) > 0
          const levelColor = a.coordinationLevel === 3 ? '#06C270' : '#FF8800'
          const pctColor = pct < 80 ? '#FF3B3B' : pct < 85 ? '#FF8800' : '#06C270'

          return (
            <button
              key={a.iataCode}
              type="button"
              onClick={() => onSelect(a.iataCode)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 text-left mb-0.5"
              style={{
                background: isSelected ? accentTint(accent, isDark ? 0.15 : 0.1) : 'transparent',
                border: isSelected ? `1px solid ${accentTint(accent, isDark ? 0.3 : 0.2)}` : '1px solid transparent',
              }}
            >
              {/* Health dot */}
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: levelColor }} />

              {/* IATA + name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold" style={{ color: palette.text }}>
                    {a.iataCode}
                  </span>
                  <span
                    className="text-[13px] font-semibold px-1 py-0.5 rounded"
                    style={{ background: `${levelColor}15`, color: levelColor }}
                  >
                    L{a.coordinationLevel}
                  </span>
                </div>
                <div className="text-[13px] truncate" style={{ color: palette.textSecondary }}>
                  {a.name}
                </div>
                {/* Mini utilization bar */}
                {hasSeries && (
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="flex-1 h-[3px] rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, background: pctColor }}
                      />
                    </div>
                    <span className="text-[13px] font-semibold shrink-0" style={{ color: pctColor }}>
                      {pct}%
                    </span>
                  </div>
                )}
              </div>

              {/* Series count */}
              {hasSeries && (
                <span className="text-[13px] shrink-0" style={{ color: palette.textTertiary }}>
                  {stats!.totalSeries}
                </span>
              )}
            </button>
          )
        })}

        {sorted.length === 0 && (
          <div className="text-center text-[13px] py-8" style={{ color: palette.textTertiary }}>
            {search ? 'No matches' : 'No coordinated airports'}
          </div>
        )}
      </div>
    </div>
  )
}
