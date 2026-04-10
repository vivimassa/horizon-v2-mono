"use client"

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport, SlotSeriesRef, SlotPortfolioStats, SlotUtilizationSummary } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import type { SlotStatus } from './slot-types'
import { STATUS_CHIP_CLASSES } from './slot-types'
import { PortfolioKpiRow } from './components/portfolio-kpi-row'
import { UnifiedSeriesRow } from './components/unified-series-row'

interface AirportSlotViewProps {
  airport: SlotCoordinatedAirport
  seasonCode: string
  refreshKey: number
  onDataChanged: () => void
  onBack: () => void
  isDark: boolean
}

type FilterStatus = 'all' | SlotStatus

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'offered', label: 'Offered' },
  { key: 'waitlisted', label: 'Waitlisted' },
  { key: 'refused', label: 'Refused' },
  { key: 'draft', label: 'Draft' },
]

export function AirportSlotView({
  airport, seasonCode, refreshKey, onDataChanged, onBack, isDark,
}: AirportSlotViewProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  const [series, setSeries] = useState<SlotSeriesRef[]>([])
  const [stats, setStats] = useState<SlotPortfolioStats>({ totalSeries: 0, confirmed: 0, offered: 0, waitlisted: 0, refused: 0, atRisk80: 0 })
  const [utilization, setUtilization] = useState<SlotUtilizationSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const opId = getOperatorId()
      const [s, st, u] = await Promise.all([
        api.getSlotSeries(opId, airport.iataCode, seasonCode),
        api.getSlotStats(opId, airport.iataCode, seasonCode),
        api.getSlotUtilization(opId, airport.iataCode, seasonCode),
      ])
      setSeries(s)
      setStats(st)
      setUtilization(u)
    } finally {
      setLoading(false)
    }
  }, [airport.iataCode, seasonCode])

  useEffect(() => { loadData() }, [loadData, refreshKey])

  const handleChanged = useCallback(() => {
    loadData()
    onDataChanged()
  }, [loadData, onDataChanged])

  // Merge utilization into series
  const utilMap = new Map(utilization.map(u => [u.seriesId, u]))

  // Filter + sort: at-risk first
  const filtered = series
    .filter(s => filter === 'all' || s.status === filter)
    .sort((a, b) => {
      const ua = utilMap.get(a._id)?.utilizationPct ?? 100
      const ub = utilMap.get(b._id)?.utilizationPct ?? 100
      return ua - ub
    })

  const levelColor = airport.coordinationLevel === 3 ? '#7c3aed' : '#FF8800'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        <div className="flex items-center gap-3 mb-1">
          <button type="button" onClick={onBack}
            className="p-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            <ArrowLeft size={16} style={{ color: palette.textSecondary }} />
          </button>
          <span className="text-[20px] font-bold" style={{ color: palette.text }}>
            {airport.iataCode}
          </span>
          <span className="text-[14px] font-medium" style={{ color: palette.text }}>
            {airport.name}
          </span>
          <span className="text-[13px] font-semibold px-2 py-0.5 rounded-lg"
            style={{ background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}20` }}>
            Level {airport.coordinationLevel}
          </span>
          <span className="text-[13px] font-medium px-2 py-0.5 rounded-lg"
            style={{ background: accentTint(accent, isDark ? 0.12 : 0.08), color: accent }}>
            {seasonCode}
          </span>

          <div className="flex-1" />
        </div>

        <div className="text-[13px] ml-11" style={{ color: palette.textSecondary }}>
          {airport.coordinatorName && <>Coordinator: {airport.coordinatorName}</>}
          {stats.totalSeries > 0 && <> &middot; {stats.totalSeries} series</>}
          {airport.slotsPerHourDay && <> &middot; {airport.slotsPerHourDay} slots/hr (day)</>}
        </div>
      </div>

      {/* KPI row */}
      <PortfolioKpiRow stats={stats} isDark={isDark} />

      {/* Action bar */}
      <div className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        {/* Status filters */}
        <div className="flex gap-1">
          {FILTERS.map(f => {
            const isActive = filter === f.key
            const chip = f.key !== 'all' ? STATUS_CHIP_CLASSES[f.key] : null
            return (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                className="h-7 px-2.5 rounded-lg text-[13px] font-medium transition-colors"
                style={{
                  background: isActive ? (chip?.bg || accentTint(accent, 0.12)) : 'transparent',
                  color: isActive ? (chip?.text || accent) : palette.textSecondary,
                  border: isActive ? `1px solid ${chip?.border || accentTint(accent, 0.2)}` : '1px solid transparent',
                }}>
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Unified series list */}
      <div className="flex-1 overflow-auto px-5 py-3">
        {filtered.map(s => (
          <UnifiedSeriesRow
            key={s._id}
            series={s}
            utilization={utilMap.get(s._id)}
            onDataChanged={handleChanged}
            isDark={isDark}
          />
        ))}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="text-[14px]" style={{ color: palette.textSecondary }}>
              {series.length === 0 ? 'No slot series yet' : 'No series match this filter'}
            </div>
            <div className="text-[13px] mt-1" style={{ color: palette.textTertiary }}>
              {series.length === 0 && 'Use "Import from Schedule" or "New Request" to get started'}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
