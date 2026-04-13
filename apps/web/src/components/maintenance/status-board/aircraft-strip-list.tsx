'use client'

import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useStatusBoardStore } from '@/stores/use-status-board-store'
import { AircraftStripRow } from './aircraft-strip-row'

const COLUMNS = [
  { label: 'Aircraft', width: 130, sortKey: 'registration' },
  { label: 'Status', width: 200, sortKey: null },
  { label: "Today's Rotation", width: null, sortKey: null }, // flex-1
  { label: 'Delays', width: 90, sortKey: null },
  { label: 'Urgent Check', width: 140, sortKey: 'most_urgent' },
  { label: 'Next Event', width: 120, sortKey: 'next_check_date' },
  { label: 'FH / Cycles', width: 100, sortKey: 'fh' },
] as const

export function AircraftStripList() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const filteredAircraft = useStatusBoardStore((s) => s.filteredAircraft)
  const sortBy = useStatusBoardStore((s) => s.sortBy)
  const setSortBy = useStatusBoardStore((s) => s.setSortBy)
  const expandedAircraftId = useStatusBoardStore((s) => s.expandedAircraftId)

  const headerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const headerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column Headers */}
      <div
        className="shrink-0 flex items-center"
        style={{ height: 32, background: headerBg, borderBottom: `1px solid ${headerBorder}` }}
      >
        {COLUMNS.map((col, i) => {
          const isActive = col.sortKey && sortBy === col.sortKey
          const isFlex = col.width === null

          return (
            <div
              key={i}
              className={`flex items-center gap-1 px-3 ${isFlex ? 'flex-1 min-w-0' : 'shrink-0'} ${col.sortKey ? 'cursor-pointer select-none' : ''}`}
              style={{ width: isFlex ? undefined : col.width }}
              onClick={col.sortKey ? () => setSortBy(col.sortKey!) : undefined}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: isActive ? (isDark ? '#5B8DEF' : '#1e40af') : palette.textTertiary }}
              >
                {col.label}
              </span>
              {col.sortKey && isActive && <ChevronDown size={10} style={{ color: isDark ? '#5B8DEF' : '#1e40af' }} />}
            </div>
          )
        })}
      </div>

      {/* Scrollable aircraft list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredAircraft.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-[14px]" style={{ color: palette.textTertiary }}>
              No aircraft match the current filters
            </span>
          </div>
        ) : (
          filteredAircraft.map((row) => (
            <AircraftStripRow key={row.id} row={row} isExpanded={expandedAircraftId === row.id} />
          ))
        )}
      </div>
    </div>
  )
}
