"use client"

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport, SlotUtilizationSummary, SlotSeriesRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { UtilizationRiskSummary } from './components/utilization-risk-summary'
import { UtilizationSeriesRow } from './components/utilization-series-row'

interface UtilizationTabProps {
  airport: SlotCoordinatedAirport
  seasonCode: string
  onDataChanged: () => void
  isDark: boolean
}

export function UtilizationTab({ airport, seasonCode, onDataChanged, isDark }: UtilizationTabProps) {
  const palette = isDark ? colors.dark : colors.light
  const [utilization, setUtilization] = useState<SlotUtilizationSummary[]>([])
  const [seriesList, setSeriesList] = useState<SlotSeriesRef[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const opId = getOperatorId()
      const [util, series] = await Promise.all([
        api.getSlotUtilization(opId, airport.iataCode, seasonCode),
        api.getSlotSeries(opId, airport.iataCode, seasonCode),
      ])
      setUtilization(util)
      setSeriesList(series)
    } finally {
      setLoading(false)
    }
  }, [airport.iataCode, seasonCode])

  useEffect(() => { loadData() }, [loadData])

  async function handleSync() {
    setSyncing(true)
    try {
      await api.syncSlotDates(getOperatorId(), airport.iataCode, seasonCode)
      await loadData()
      onDataChanged()
    } finally {
      setSyncing(false)
    }
  }

  const atRisk = utilization.filter(u => u.isAtRisk).length
  const close = utilization.filter(u => u.isClose).length
  const safe = utilization.length - atRisk - close
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  // Build lookup for series metadata
  const seriesMap = new Map(seriesList.map(s => [s._id, s]))

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        <button type="button" onClick={handleSync} disabled={syncing}
          className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${glassBorder}`, color: palette.text }}>
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sync from flight instances
        </button>
        <span className="text-[13px]" style={{ color: palette.textSecondary }}>
          {utilization.length} series tracked
        </span>
      </div>

      {/* Risk summary */}
      <UtilizationRiskSummary atRisk={atRisk} close={close} safe={safe} isDark={isDark} />

      {/* Series list */}
      <div className="flex-1 overflow-auto px-5 pb-4">
        {utilization.map(u => {
          const series = seriesMap.get(u.seriesId)
          if (!series) return null
          return (
            <UtilizationSeriesRow key={u.seriesId} utilization={u} series={series} isDark={isDark} />
          )
        })}

        {utilization.length === 0 && !loading && (
          <div className="text-center py-12 text-[13px]" style={{ color: palette.textTertiary }}>
            No utilization data available
          </div>
        )}
      </div>
    </div>
  )
}
