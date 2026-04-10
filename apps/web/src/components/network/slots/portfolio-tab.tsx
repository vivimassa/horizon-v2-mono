"use client"

import { useState, useMemo } from 'react'
import { Plus, CalendarSync, Loader2, ArrowUpDown } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport, SlotSeriesRef, SlotPortfolioStats } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import type { SlotStatus } from './slot-types'
import { STATUS_CHIP_CLASSES } from './slot-types'
import { PortfolioKpiRow } from './components/portfolio-kpi-row'
import { SeriesTableRow } from './components/series-table-row'
import { SlotDetailDialog } from './slot-detail-dialog'

interface PortfolioTabProps {
  series: SlotSeriesRef[]
  stats: SlotPortfolioStats
  airport: SlotCoordinatedAirport
  seasonCode: string
  loading: boolean
  onNewRequest: () => void
  onDataChanged: () => void
  isDark: boolean
}

type FilterStatus = 'all' | SlotStatus

const FILTER_OPTIONS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'offered', label: 'Offered' },
  { key: 'waitlisted', label: 'Waitlisted' },
  { key: 'refused', label: 'Refused' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'historic', label: 'Historic' },
]

const COLUMNS = [
  { key: 'expand', label: '', sortable: false },
  { key: 'arrivalFlightNumber', label: 'Arr Flight', sortable: true },
  { key: 'departureFlightNumber', label: 'Dep Flight', sortable: true },
  { key: 'arrivalOriginIata', label: 'Origin', sortable: true },
  { key: 'departureDestIata', label: 'Dest', sortable: true },
  { key: 'requestedArrivalTime', label: 'Arr Time', sortable: true },
  { key: 'requestedDepartureTime', label: 'Dep Time', sortable: true },
  { key: 'periodStart', label: 'Period', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'priorityCategory', label: 'Priority', sortable: true },
  { key: 'actions', label: '', sortable: false },
]

export function PortfolioTab({
  series, stats, airport, seasonCode, loading, onNewRequest, onDataChanged, isDark,
}: PortfolioTabProps) {
  const palette = isDark ? colors.dark : colors.light
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortCol, setSortCol] = useState('arrivalFlightNumber')
  const [sortAsc, setSortAsc] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleImportFromSchedule() {
    setImporting(true)
    try {
      const result = await api.importSlotsFromSchedule(getOperatorId(), airport.iataCode, seasonCode)
      onDataChanged()
    } finally {
      setImporting(false)
    }
  }

  const filtered = useMemo(() => {
    let result = series
    if (filterStatus !== 'all') {
      result = result.filter(s => s.status === filterStatus)
    }
    return [...result].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortCol]
      const bVal = (b as Record<string, unknown>)[sortCol]
      const cmp = String(aVal || '').localeCompare(String(bVal || ''))
      return sortAsc ? cmp : -cmp
    })
  }, [series, filterStatus, sortCol, sortAsc])

  function handleSort(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <PortfolioKpiRow stats={stats} isDark={isDark} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${glassBorder}` }}>
        <button type="button" onClick={onNewRequest}
          className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
          style={{ background: MODULE_THEMES.network.accent, color: '#fff' }}>
          <Plus size={14} /> New slot request
        </button>
        <button type="button" onClick={handleImportFromSchedule} disabled={importing}
          className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${glassBorder}`, color: palette.text }}>
          {importing ? <Loader2 size={14} className="animate-spin" /> : <CalendarSync size={14} />}
          Import from schedule
        </button>

        <div className="flex-1" />

        {/* Status filter pills */}
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(f => {
            const isActive = filterStatus === f.key
            const chip = f.key !== 'all' ? STATUS_CHIP_CLASSES[f.key] : null
            return (
              <button key={f.key} type="button" onClick={() => setFilterStatus(f.key)}
                className="h-7 px-2.5 rounded-lg text-[13px] font-medium transition-colors"
                style={{
                  background: isActive ? (chip?.bg || accentTint(MODULE_THEMES.network.accent, 0.12)) : 'transparent',
                  color: isActive ? (chip?.text || MODULE_THEMES.network.accent) : palette.textSecondary,
                  border: isActive ? `1px solid ${chip?.border || accentTint(MODULE_THEMES.network.accent, 0.2)}` : '1px solid transparent',
                }}>
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `1px solid ${glassBorder}` }}>
              {COLUMNS.map(col => (
                <th key={col.key}
                  className="px-3 py-2 text-left text-[13px] font-medium uppercase tracking-wide whitespace-nowrap"
                  style={{ color: palette.textTertiary, cursor: col.sortable ? 'pointer' : 'default' }}
                  onClick={() => col.sortable && handleSort(col.key)}>
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortCol === col.key && <ArrowUpDown size={10} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <SeriesTableRow key={s._id} series={s} onViewDetail={setDetailId} isDark={isDark} />
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-[13px]" style={{ color: palette.textTertiary }}>
            {series.length === 0 ? 'No slot series yet' : 'No series match this filter'}
          </div>
        )}
      </div>

      {detailId && (
        <SlotDetailDialog
          open={!!detailId} onOpenChange={() => setDetailId(null)}
          seriesId={detailId} onDataChanged={onDataChanged} isDark={isDark}
        />
      )}
    </div>
  )
}
