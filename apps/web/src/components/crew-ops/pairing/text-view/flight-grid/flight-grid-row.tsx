'use client'

import { memo, type MouseEvent } from 'react'
import type { PairingFlight } from '../../types'
import {
  FLIGHT_GRID_COLUMNS,
  ROW_HEIGHT,
  ROW_NUMBER_WIDTH,
  SELECTION_COLOR,
  cellBorder,
  coveredBg,
  rangeBg,
} from './flight-grid-columns'
import { FlightGridCell } from './flight-grid-cell'
import type { FlightGridColumnKey } from './flight-grid-columns'

interface FlightGridRowProps {
  flight: PairingFlight
  /** Tail-relative sequence index across the whole period (1..N). */
  rotationSeq: number
  rowIdx: number
  /** `std(this) − sta(prev-same-tail)` in minutes, blank when first leg. */
  tatMinutes: number | null
  /** Absolute row-number label (1-based) shown in the gutter. */
  rowNumber: number
  pairingCode: string | null
  isSelected: boolean
  isCovered: boolean
  activeCol: FlightGridColumnKey | null
  activeRowIdx: number | null
  rangeStartRow: number | null
  rangeEndRow: number | null
  highlightedCol: FlightGridColumnKey | null
  isDark: boolean
  onCellMouseDown: (flight: PairingFlight, rowIdx: number, col: FlightGridColumnKey, e: MouseEvent) => void
  onCellMouseEnter: (flight: PairingFlight, rowIdx: number, col: FlightGridColumnKey, e: MouseEvent) => void
  onRowNumberMouseDown: (flight: PairingFlight, rowIdx: number, e: MouseEvent) => void
  onRowNumberMouseEnter: (flight: PairingFlight, rowIdx: number, e: MouseEvent) => void
  onContextMenu: (flight: PairingFlight, e: MouseEvent) => void
}

function FlightGridRowInner(props: FlightGridRowProps) {
  const {
    flight,
    rotationSeq,
    rowIdx,
    tatMinutes,
    rowNumber,
    pairingCode,
    isSelected,
    isCovered,
    activeCol,
    activeRowIdx,
    rangeStartRow,
    rangeEndRow,
    highlightedCol,
    isDark,
    onCellMouseDown,
    onCellMouseEnter,
    onRowNumberMouseDown,
    onRowNumberMouseEnter,
    onContextMenu,
  } = props

  const inRange =
    rangeStartRow != null &&
    rangeEndRow != null &&
    rowIdx >= Math.min(rangeStartRow, rangeEndRow) &&
    rowIdx <= Math.max(rangeStartRow, rangeEndRow)

  const rowBgLayer =
    isSelected && !inRange ? rangeBg(isDark) : isCovered && !isSelected && !inRange ? coveredBg(isDark) : undefined

  return (
    <tr onContextMenu={(e) => onContextMenu(flight, e)} style={{ height: ROW_HEIGHT, background: rowBgLayer }}>
      {/* Row-number gutter — click to select entire row */}
      <td
        onMouseDown={(e) => onRowNumberMouseDown(flight, rowIdx, e)}
        onMouseEnter={(e) => onRowNumberMouseEnter(flight, rowIdx, e)}
        className="select-none"
        style={{
          width: ROW_NUMBER_WIDTH,
          border: cellBorder(isDark),
          background: isSelected ? SELECTION_COLOR : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
          color: isSelected ? '#fff' : isDark ? '#8F90A6' : '#8F90A6',
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          lineHeight: `${ROW_HEIGHT}px`,
        }}
      >
        {rowNumber}
      </td>

      {FLIGHT_GRID_COLUMNS.map((col) => {
        const value = renderValue(col.key, flight, rotationSeq, tatMinutes, pairingCode)
        const isActive = activeRowIdx === rowIdx && activeCol === col.key
        const isColumnHighlighted = highlightedCol === col.key
        const statusColor = col.key === 'status' ? statusColorFor(flight.status, isDark) : undefined
        const accentText =
          (col.key === 'pairingCode' && !!pairingCode) || (col.key === 'tailNumber' && !!flight.tailNumber)
        return (
          <FlightGridCell
            key={col.key}
            column={col}
            value={value}
            isActive={isActive}
            isInRange={inRange}
            isColumnHighlighted={isColumnHighlighted}
            isCovered={isCovered}
            isDark={isDark}
            rowIdx={rowIdx}
            onMouseDown={(r, c, e) => onCellMouseDown(flight, r, c, e)}
            onMouseEnter={(r, c, e) => onCellMouseEnter(flight, r, c, e)}
            statusColor={statusColor}
            accentText={accentText}
          />
        )
      })}
    </tr>
  )
}

export const FlightGridRow = memo(FlightGridRowInner)

function renderValue(
  key: FlightGridColumnKey,
  flight: PairingFlight,
  rotationSeq: number,
  tatMinutes: number | null,
  pairingCode: string | null,
): string {
  switch (key) {
    case 'ac': {
      if (flight.rotationLabel) return flight.rotationLabel
      const type = flight.aircraftType || 'UNK'
      return `${type}-${rotationSeq.toString().padStart(2, '0')}`
    }
    case 'aircraftTypeIcao':
      return flight.aircraftType || '—'
    case 'tailNumber': {
      // Real tail wins whenever it's been assigned (FlightInstance overlay or
      // pattern-level aircraftReg). Without one, synthesize the same rotation
      // label the AC column uses so every row has an identity the planner can
      // reason about — "A320-01", "A321-03", etc.
      const real = flight.tailNumber?.trim()
      if (real) return real
      if (flight.rotationLabel) return flight.rotationLabel
      const type = flight.aircraftType || 'UNK'
      return `${type}-${rotationSeq.toString().padStart(2, '0')}`
    }
    case 'effectiveFrom':
      return formatDMY(flight.effectiveFrom || flight.instanceDate)
    case 'effectiveUntil':
      return formatDMY(flight.effectiveUntil || flight.instanceDate)
    case 'depStation':
      return flight.departureAirport
    case 'arrStation':
      return flight.arrivalAirport
    case 'flightNumber':
      return flight.flightNumber
    case 'stdUtc':
      return flight.stdUtc.slice(11, 16)
    case 'staUtc':
      return flight.staUtc.slice(11, 16)
    case 'departureDayOffset':
      return String(flight.departureDayOffset ?? 1)
    case 'serviceType':
      return flight.serviceType || 'J'
    case 'daysOfWeek':
      return flight.daysOfWeek || '1234567'
    case 'blockMinutes':
      return minutesToHM(flight.blockMinutes)
    case 'tat':
      return tatMinutes == null ? '' : minutesToHM(tatMinutes)
    case 'status':
      return titleCase(flight.status || 'active')
    case 'pairingCode':
      return pairingCode ?? '—'
    default:
      return ''
  }
}

function formatDMY(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

function minutesToHM(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${m.toString().padStart(2, '0')}`
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusColorFor(status: string, isDark: boolean): string {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return '#06C270'
    case 'cancelled':
      return '#FF3B3B'
    case 'suspended':
      return '#FF8800'
    case 'draft':
      return isDark ? '#8F90A6' : '#555770'
    default:
      return isDark ? '#8F90A6' : '#555770'
  }
}
