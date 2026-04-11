'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plane, Download, FileText, Upload } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport, SlotSeriesRef, SlotPortfolioStats } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { PortfolioTab } from './portfolio-tab'
import { UtilizationTab } from './utilization-tab'
import { MessagesTab } from './messages-tab'
import { CalendarTab } from './calendar-tab'
import { SlotRequestDialog } from './slot-request-dialog'
import { ImportMessageDialog } from './import-message-dialog'
import { GenerateSCRDialog } from './generate-scr-dialog'

type TabKey = 'portfolio' | 'utilization' | 'messages' | 'calendar'

interface SlotDetailPanelProps {
  airport: SlotCoordinatedAirport | null
  seasonCode: string
  refreshKey: number
  onDataChanged: () => void
  isDark: boolean
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'portfolio', label: 'Slot Portfolio' },
  { key: 'utilization', label: 'Utilization' },
  { key: 'messages', label: 'Messages' },
  { key: 'calendar', label: 'Calendar' },
]

export function SlotDetailPanel({ airport, seasonCode, refreshKey, onDataChanged, isDark }: SlotDetailPanelProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const [tab, setTab] = useState<TabKey>('portfolio')
  const [series, setSeries] = useState<SlotSeriesRef[]>([])
  const [stats, setStats] = useState<SlotPortfolioStats>({
    totalSeries: 0,
    confirmed: 0,
    offered: 0,
    waitlisted: 0,
    refused: 0,
    atRisk80: 0,
  })
  const [loading, setLoading] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [scrOpen, setScrOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!airport) return
    setLoading(true)
    try {
      const opId = getOperatorId()
      const [seriesData, statsData] = await Promise.all([
        api.getSlotSeries(opId, airport.iataCode, seasonCode),
        api.getSlotStats(opId, airport.iataCode, seasonCode),
      ])
      setSeries(seriesData)
      setStats(statsData)
    } finally {
      setLoading(false)
    }
  }, [airport, seasonCode])

  useEffect(() => {
    loadData()
  }, [loadData, refreshKey])

  const handleChanged = useCallback(() => {
    loadData()
    onDataChanged()
  }, [loadData, onDataChanged])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const btnStyle = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${glassBorder}`,
    color: palette.text,
  }

  // Empty state
  if (!airport) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Plane size={40} style={{ color: palette.textTertiary, opacity: 0.3 }} className="mx-auto mb-3" />
          <div className="text-[14px]" style={{ color: palette.textSecondary }}>
            Select an airport to view slot portfolio
          </div>
        </div>
      </div>
    )
  }

  const levelColor = airport.coordinationLevel === 3 ? '#7c3aed' : '#FF8800'

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0"
        style={{ borderBottom: `1px solid ${glassBorder}` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[18px] font-mono font-bold" style={{ color: palette.text }}>
            {airport.iataCode}
          </span>
          <div>
            <div className="text-[14px] font-medium flex items-center gap-2" style={{ color: palette.text }}>
              {airport.name}
              <span
                className="text-[13px] font-semibold px-2 py-0.5 rounded-lg"
                style={{ background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}20` }}
              >
                Level {airport.coordinationLevel}
              </span>
              <span
                className="text-[13px] font-mono font-medium px-2 py-0.5 rounded-lg"
                style={{
                  background: accentTint(accent, isDark ? 0.12 : 0.08),
                  color: accent,
                  border: `1px solid ${accentTint(accent, 0.15)}`,
                }}
              >
                {seasonCode}
              </span>
            </div>
            <div className="text-[13px] mt-0.5" style={{ color: palette.textSecondary }}>
              {airport.coordinatorName && <>Coordinator: {airport.coordinatorName}</>}
              {stats.totalSeries > 0 && <> &middot; {stats.totalSeries} slot series</>}
              {airport.slotsPerHourDay && <> &middot; {airport.slotsPerHourDay} slots/hr</>}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 hover:opacity-80"
            style={btnStyle}
          >
            <Download size={14} /> Import SAL
          </button>
          <button
            type="button"
            onClick={() => setScrOpen(true)}
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 hover:opacity-80"
            style={btnStyle}
          >
            <FileText size={14} /> Generate SCR
          </button>
          <button
            type="button"
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 hover:opacity-80"
            style={btnStyle}
          >
            <Upload size={14} /> Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-5 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-[13px] font-medium transition-colors duration-150 relative"
            style={{
              color: tab === t.key ? accent : palette.textSecondary,
              borderBottom: tab === t.key ? `2px solid ${accent}` : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'portfolio' && (
        <PortfolioTab
          series={series}
          stats={stats}
          airport={airport}
          seasonCode={seasonCode}
          loading={loading}
          onNewRequest={() => setRequestOpen(true)}
          onDataChanged={handleChanged}
          isDark={isDark}
        />
      )}
      {tab === 'utilization' && (
        <UtilizationTab airport={airport} seasonCode={seasonCode} onDataChanged={handleChanged} isDark={isDark} />
      )}
      {tab === 'messages' && (
        <MessagesTab
          airport={airport}
          seasonCode={seasonCode}
          onImport={() => setImportOpen(true)}
          onDataChanged={handleChanged}
          isDark={isDark}
        />
      )}
      {tab === 'calendar' && (
        <CalendarTab
          airport={airport}
          seasonCode={seasonCode}
          onNavigateToUtilization={() => setTab('utilization')}
          isDark={isDark}
        />
      )}

      {/* Dialogs */}
      {requestOpen && (
        <SlotRequestDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          airportIata={airport.iataCode}
          seasonCode={seasonCode}
          onCreated={handleChanged}
          isDark={isDark}
        />
      )}
      {importOpen && (
        <ImportMessageDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          airportIata={airport.iataCode}
          seasonCode={seasonCode}
          onImported={handleChanged}
          isDark={isDark}
        />
      )}
      {scrOpen && (
        <GenerateSCRDialog
          open={scrOpen}
          onOpenChange={setScrOpen}
          series={series}
          airportIata={airport.iataCode}
          seasonCode={seasonCode}
          onGenerated={handleChanged}
          isDark={isDark}
        />
      )}
    </div>
  )
}
