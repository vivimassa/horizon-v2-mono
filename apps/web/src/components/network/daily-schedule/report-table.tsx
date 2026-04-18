'use client'

import { useMemo, useRef, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import {
  useDailyScheduleStore,
  COLUMN_DEFS,
  utcMsToHhmm,
  applyOffset,
  getGroupKey,
  type ColumnId,
  type TimeMode,
} from '@/stores/use-daily-schedule-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { formatDate } from '@/lib/date-format'
import type { Flight } from '@skyhub/api'

/* ── Constants ── */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* ── Component ── */

interface ReportTableProps {
  flights: Flight[]
}

export function ReportTable({ flights }: ReportTableProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const {
    timeModes,
    sortSequence,
    columnOrder,
    hiddenColumns,
    compactMode,
    airportMap,
    homeBaseOffset,
    regToTypeMap,
    setColumnOrder,
  } = useDailyScheduleStore()
  const dateFormat = useOperatorStore((s) => s.dateFormat)

  const activeModes = useMemo(() => {
    const order: TimeMode[] = ['utc', 'localBase', 'localStation']
    return order.filter((m) => timeModes.has(m))
  }, [timeModes])

  // Visible columns with flex values
  const visibleCols = useMemo(() => {
    const timeFlex = activeModes.length <= 1 ? 0.9 : activeModes.length === 2 ? 1.6 : 2.2
    return columnOrder
      .filter((id) => !hiddenColumns.has(id))
      .map((id) => {
        const def = COLUMN_DEFS.find((d) => d.id === id)!
        const flex = id === 'std' || id === 'sta' ? timeFlex : def.flex
        return { ...def, flex }
      })
  }, [columnOrder, hiddenColumns, activeModes.length])

  // Drag-and-drop column reorder
  const dragCol = useRef<ColumnId | null>(null)
  const handleDragStart = useCallback((col: ColumnId) => {
    dragCol.current = col
  }, [])
  const handleDrop = useCallback(
    (targetCol: ColumnId) => {
      if (!dragCol.current || dragCol.current === targetCol) return
      const order = [...columnOrder]
      const fromIdx = order.indexOf(dragCol.current)
      const toIdx = order.indexOf(targetCol)
      if (fromIdx < 0 || toIdx < 0) return
      order.splice(fromIdx, 1)
      order.splice(toIdx, 0, dragCol.current)
      setColumnOrder(order)
      dragCol.current = null
    },
    [columnOrder, setColumnOrder],
  )

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const headerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const rowH = compactMode ? 36 : 44

  return (
    <div
      className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-0"
      style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div
        className="flex shrink-0"
        style={{ background: headerBg, borderBottom: `1px solid ${glassBorder}`, height: 36 }}
      >
        {visibleCols.map((col) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => handleDragStart(col.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.id)}
            className="flex items-center justify-center px-3 text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary cursor-grab select-none min-w-0 text-center"
            style={{ flex: col.flex }}
          >
            {(col.id === 'std' || col.id === 'sta') && activeModes.length > 1 ? (
              <TimeSubHeaders label={col.label} modes={activeModes} />
            ) : (
              col.label
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {flights.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[14px] text-hz-text-tertiary">
            No flights match the current filters
          </div>
        )}
        {(() => {
          let groupIdx = 0
          let prevKey = ''
          return flights.map((flight, idx) => {
            const key = getGroupKey(flight, sortSequence)
            const showSep = idx > 0 && key !== prevKey
            if (showSep) groupIdx++
            prevKey = key
            const unassigned = !flight.tail.registration
            const altBg =
              groupIdx % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)') : 'transparent'

            return (
              <div key={flight._id}>
                {showSep && <GroupSeparator flight={flight} sortSequence={sortSequence} isDark={isDark} />}
                <div
                  className="flex items-center transition-colors hover:bg-hz-border/10"
                  style={{
                    height: rowH,
                    background: altBg,
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                    borderLeft: unassigned ? '3px solid rgba(255,136,0,0.5)' : '3px solid transparent',
                  }}
                >
                  {visibleCols.map((col) => (
                    <div key={col.id} className="px-3 min-w-0 truncate text-center" style={{ flex: col.flex }}>
                      <CellContent
                        flight={flight}
                        colId={col.id}
                        activeModes={activeModes}
                        airportMap={airportMap}
                        homeBaseOffset={homeBaseOffset}
                        regToTypeMap={regToTypeMap}
                        isDark={isDark}
                        dateFormat={dateFormat}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function TimeSubHeaders({ label, modes }: { label: string; modes: TimeMode[] }) {
  const modeLabels: Record<TimeMode, string> = { utc: 'UTC', localBase: 'Base', localStation: 'Lcl' }
  return (
    <div className="flex flex-col w-full">
      <span className="text-[13px] leading-tight">{label}</span>
      <div className="flex gap-2">
        {modes.map((m) => (
          <span key={m} className="text-[13px] font-medium normal-case tracking-normal text-hz-text-tertiary">
            {modeLabels[m]}
          </span>
        ))}
      </div>
    </div>
  )
}

function GroupSeparator({ flight, sortSequence, isDark }: { flight: Flight; sortSequence: string; isDark: boolean }) {
  // For date-reg-std, just a blank spacer between registrations
  if (sortSequence === 'date-reg-std') {
    return <div className="h-3" />
  }

  let label: string
  if (sortSequence === 'reg-date-std') {
    label = flight.tail.registration ?? 'Unassigned'
  } else if (sortSequence === 'flt-date') {
    label = flight.flightNumber
  } else {
    const d = new Date(flight.operatingDate + 'T00:00:00Z')
    label = d
      .toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
      .toUpperCase()
  }

  return (
    <div
      className="flex items-center px-3 h-7 text-[13px] font-bold uppercase tracking-wide"
      style={{
        background: isDark ? 'rgba(30,64,175,0.08)' : 'rgba(30,64,175,0.04)',
        color: 'var(--module-accent, #1e40af)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
      }}
    >
      {label}
    </div>
  )
}

function CellContent({
  flight,
  colId,
  activeModes,
  airportMap,
  homeBaseOffset,
  regToTypeMap,
  isDark,
  dateFormat,
}: {
  flight: Flight
  colId: string
  activeModes: TimeMode[]
  airportMap: Record<string, { utcOffset: number; countryId: string | null }>
  homeBaseOffset: number
  regToTypeMap: Record<string, string>
  isDark: boolean
  dateFormat: string
}) {
  switch (colId) {
    case 'date':
      return (
        <span className="text-[13px] font-medium text-hz-text">
          {formatDate(flight.operatingDate, dateFormat as any)}
        </span>
      )
    case 'dow': {
      const d = new Date(flight.operatingDate + 'T00:00:00Z')
      return <span className="text-[13px] text-hz-text-secondary">{DOW[d.getUTCDay()]}</span>
    }
    case 'flt':
      return <span className="text-[13px] font-semibold text-hz-text">{flight.flightNumber}</span>
    case 'dep':
      return (
        <span className="text-[13px] font-semibold" style={{ color: 'var(--module-accent, #1e40af)' }}>
          {flight.dep.iata || flight.dep.icao}
        </span>
      )
    case 'arr':
      return (
        <span className="text-[13px] font-semibold" style={{ color: 'var(--module-accent, #1e40af)' }}>
          {flight.arr.iata || flight.arr.icao}
        </span>
      )
    case 'std':
    case 'sta': {
      const ms = colId === 'std' ? flight.schedule.stdUtc : flight.schedule.staUtc
      if (!ms) return <span className="text-[13px] text-hz-text-tertiary">-</span>
      const utcHhmm = utcMsToHhmm(ms)
      const stationIcao = colId === 'std' ? flight.dep.icao : flight.arr.icao
      const stationOffset = airportMap[stationIcao]?.utcOffset ?? 0
      return (
        <TimeCell
          utcHhmm={utcHhmm}
          activeModes={activeModes}
          homeBaseOffset={homeBaseOffset}
          stationOffset={stationOffset}
        />
      )
    }
    case 'block': {
      if (!flight.schedule.stdUtc || !flight.schedule.staUtc)
        return <span className="text-[13px] text-hz-text-tertiary">-</span>
      const mins = Math.round((flight.schedule.staUtc - flight.schedule.stdUtc) / 60000)
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return (
        <span className="text-[13px] text-hz-text">
          {h}:{String(m).padStart(2, '0')}
        </span>
      )
    }
    case 'acType': {
      const acType = flight.tail.icaoType || (flight.tail.registration ? regToTypeMap[flight.tail.registration] : null)
      return acType ? (
        <span className="text-[13px] font-semibold text-hz-text">{acType}</span>
      ) : (
        <span className="text-[13px] text-hz-text-tertiary">-</span>
      )
    }
    case 'acReg':
      return flight.tail.registration ? (
        <span className="text-[13px] font-medium text-hz-text">{flight.tail.registration}</span>
      ) : (
        <span className="text-[13px] text-hz-text-tertiary italic">Unassigned</span>
      )
    case 'svc':
      return <span className="text-[13px] text-hz-text-secondary">J</span>
    case 'route': {
      const depC = airportMap[flight.dep.icao]?.countryId
      const arrC = airportMap[flight.arr.icao]?.countryId
      const isDom = depC != null && depC === arrC
      return (
        <span
          className="inline-flex items-center h-5 px-2 rounded-md text-[13px] font-semibold"
          style={{
            background: isDom ? 'rgba(0,99,247,0.10)' : 'rgba(124,58,237,0.10)',
            color: isDom ? '#0063F7' : '#7c3aed',
          }}
        >
          {isDom ? 'DOM' : 'INT'}
        </span>
      )
    }
    case 'atd':
    case 'tkof':
    case 'tdown':
    case 'ata': {
      const ms =
        colId === 'atd'
          ? flight.actual?.atdUtc
          : colId === 'tkof'
            ? flight.actual?.offUtc
            : colId === 'tdown'
              ? flight.actual?.onUtc
              : flight.actual?.ataUtc
      if (!ms) return <span className="text-[13px] text-hz-text-tertiary">-</span>
      const utcHhmm = utcMsToHhmm(ms)
      const stationIcao = colId === 'atd' || colId === 'tkof' ? flight.dep.icao : flight.arr.icao
      const stationOffset = airportMap[stationIcao]?.utcOffset ?? 0
      return (
        <TimeCell
          utcHhmm={utcHhmm}
          activeModes={activeModes}
          homeBaseOffset={homeBaseOffset}
          stationOffset={stationOffset}
        />
      )
    }
    case 'paxExp':
    case 'paxAct': {
      const isExp = colId === 'paxExp'
      const p = flight.pax
      const total =
        p &&
        ((isExp ? p.adultExpected : p.adultActual) ?? 0) +
          ((isExp ? p.childExpected : p.childActual) ?? 0) +
          ((isExp ? p.infantExpected : p.infantActual) ?? 0)
      const lopa = flight.lopa?.cabins ?? []
      const lopaStr = lopa.length ? lopa.map((c) => c.seats).join('/') : '—'
      if (!total && total !== 0) {
        return (
          <span className="text-[13px] text-hz-text-tertiary">
            <span className="text-hz-text-tertiary">-</span>
            <span className="ml-1.5 text-[13px] text-hz-text-tertiary">({lopaStr})</span>
          </span>
        )
      }
      return (
        <span className="text-[13px] text-hz-text font-medium">
          {total}
          <span className="ml-1.5 text-hz-text-tertiary font-normal">({lopaStr})</span>
        </span>
      )
    }
    case 'lf': {
      const p = flight.pax
      const act = (p?.adultActual ?? 0) + (p?.childActual ?? 0) + (p?.infantActual ?? 0) || 0
      const seats = flight.lopa?.totalSeats ?? 0
      if (!seats) return <span className="text-[13px] text-hz-text-tertiary">-</span>
      const pct = Math.round((act / seats) * 1000) / 10
      const color = pct >= 85 ? '#06C270' : pct >= 65 ? '#FF8800' : '#FF3B3B'
      return (
        <span className="text-[13px] font-semibold" style={{ color }}>
          {pct}%
        </span>
      )
    }
    case 'fuelInitial':
    case 'fuelUplift':
    case 'fuelBurn':
    case 'fuelPlan': {
      const f = flight.fuel
      const v =
        colId === 'fuelInitial'
          ? f?.initial
          : colId === 'fuelUplift'
            ? f?.uplift
            : colId === 'fuelBurn'
              ? f?.burn
              : f?.flightPlan
      if (v == null) return <span className="text-[13px] text-hz-text-tertiary">-</span>
      return <span className="text-[13px] text-hz-text font-medium">{Math.round(v).toLocaleString()}</span>
    }
    default:
      return null
  }
}

function TimeCell({
  utcHhmm,
  activeModes,
  homeBaseOffset,
  stationOffset,
}: {
  utcHhmm: string
  activeModes: TimeMode[]
  homeBaseOffset: number
  stationOffset: number
}) {
  if (activeModes.length === 1) {
    const mode = activeModes[0]
    const { time, dayShift } = resolveTime(utcHhmm, mode, homeBaseOffset, stationOffset)
    return (
      <span className="text-[13px] font-medium text-hz-text">
        {time}
        {dayShift !== 0 && <sup className="text-[13px] text-hz-text-tertiary ml-0.5">{dayShift > 0 ? '+1' : '-1'}</sup>}
      </span>
    )
  }

  return (
    <span className="text-[13px] font-medium text-hz-text flex gap-2">
      {activeModes.map((mode, i) => {
        const { time, dayShift } = resolveTime(utcHhmm, mode, homeBaseOffset, stationOffset)
        return (
          <span key={mode}>
            {i > 0 && <span className="text-hz-text-tertiary mr-1">/</span>}
            {time}
            {dayShift !== 0 && <sup className="text-[13px] text-hz-text-tertiary">{dayShift > 0 ? '+1' : '-1'}</sup>}
          </span>
        )
      })}
    </span>
  )
}

function resolveTime(utcHhmm: string, mode: TimeMode, homeBaseOffset: number, stationOffset: number) {
  switch (mode) {
    case 'utc':
      return { time: utcHhmm, dayShift: 0 }
    case 'localBase':
      return applyOffset(utcHhmm, homeBaseOffset)
    case 'localStation':
      return applyOffset(utcHhmm, stationOffset)
  }
}
