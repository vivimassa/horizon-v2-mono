'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'
import { useFlightGridSelection } from '@/stores/use-flight-grid-selection'
import type { PairingFlight } from '../../types'
import { FLIGHT_GRID_COLUMNS, HEADER_HEIGHT, ROW_HEIGHT, type FlightGridColumnKey } from './flight-grid-columns'
import { FlightGridHeader } from './flight-grid-header'
import { FlightGridRow } from './flight-grid-row'
import { FlightGridContextMenu } from './flight-grid-context-menu'

interface FlightGridProps {
  /** Called when the user picks "Create Pairing" from the menu or hits Enter. */
  onCreatePairing: (flightIds: string[]) => void
  /** Called when the user right-clicks a PAIRING cell and picks Inspect. */
  onInspectPairing: (pairingId: string) => void
  /** Called when the user right-clicks a PAIRING cell and picks Delete. */
  onDeletePairing: (pairingId: string) => void
  /** Called when the user picks "Layover at {ARR}" on a single-flight selection.
   *  Parent captures `x`, `y` from the originating right-click so the chip can
   *  anchor in-place of the menu. */
  onStartLayover?: (flightId: string, station: string, x: number, y: number) => void
  /** False while a dialog is open or a save is in flight — suppresses the
   *  Enter keyboard shortcut so the user can't double-fire. */
  canCreate?: boolean
}

/**
 * Virtualized read-only grid for the Flight Pool (4.1.5.1).
 * Mirrors 1.1.1 Scheduling XL's table look: fixed layout, sticky header,
 * JetBrains Mono cells, Excel-style selection. No editing.
 */
export function FlightGrid({
  onCreatePairing,
  onInspectPairing,
  onDeletePairing,
  onStartLayover,
  canCreate = true,
}: FlightGridProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const flights = usePairingStore((s) => s.flights)
  const pairings = usePairingStore((s) => s.pairings)
  const filters = usePairingStore((s) => s.filters)
  const layoverMode = usePairingStore((s) => s.layoverMode)
  const clearLayover = usePairingStore((s) => s.clearLayover)

  const selectedRowIds = useFlightGridSelection((s) => s.selectedRowIds)
  const activeCell = useFlightGridSelection((s) => s.activeCell)
  const rangeAnchor = useFlightGridSelection((s) => s.rangeAnchor)
  const rangeCurrent = useFlightGridSelection((s) => s.rangeCurrent)
  const highlightedCol = useFlightGridSelection((s) => s.highlightedCol)
  const selectRow = useFlightGridSelection((s) => s.selectRow)
  const toggleRow = useFlightGridSelection((s) => s.toggleRow)
  const beginRange = useFlightGridSelection((s) => s.beginRange)
  const extendRange = useFlightGridSelection((s) => s.extendRange)
  const endRange = useFlightGridSelection((s) => s.endRange)
  const focusCell = useFlightGridSelection((s) => s.focusCell)
  const selectColumn = useFlightGridSelection((s) => s.selectColumn)
  const selectAllAction = useFlightGridSelection((s) => s.selectAll)
  const clearAll = useFlightGridSelection((s) => s.clearAll)
  const setSelectedRows = useFlightGridSelection((s) => s.setSelectedRows)
  const pruneTo = useFlightGridSelection((s) => s.pruneTo)

  // Row order, per product rule: DATE → AC (rotation label, natural sort so
  // A320-01 < A320-02 < A320-10) → STD. All instances of a single rotation
  // thus cluster together on their operating day in time order.
  const orderedRows = useMemo(() => {
    const passesFilter = (f: PairingFlight) => {
      if (filters.aircraftTypes && !filters.aircraftTypes.includes(f.aircraftType)) return false
      if (
        filters.baseAirports &&
        !filters.baseAirports.includes(f.departureAirport) &&
        !filters.baseAirports.includes(f.arrivalAirport)
      )
        return false
      return true
    }
    const filtered = flights.filter(passesFilter)
    return [...filtered].sort((a, b) => {
      // 1. Operating date
      const d = a.instanceDate.localeCompare(b.instanceDate)
      if (d !== 0) return d
      // 2. AC label (rotationLabel, with type-only fallback) — natural sort
      const acA = a.rotationLabel ?? a.aircraftType ?? ''
      const acB = b.rotationLabel ?? b.aircraftType ?? ''
      const ac = acA.localeCompare(acB, undefined, { numeric: true })
      if (ac !== 0) return ac
      // 3. STD
      return a.stdUtc.localeCompare(b.stdUtc)
    })
  }, [flights, filters])

  // Rotation sequence counter per tail (or per AC type if no tail).
  const rotationSeqByRow = useMemo(() => {
    const byKey = new Map<string, number>()
    const seqs = new Map<string, number>()
    for (const r of orderedRows) {
      const key = r.tailNumber ?? `type:${r.aircraftType}`
      const n = (byKey.get(key) ?? 0) + 1
      byKey.set(key, n)
      seqs.set(r.id, n)
    }
    return seqs
  }, [orderedRows])

  // Turnaround time — std(current) − sta(previous same-tail) in minutes.
  const tatByRow = useMemo(() => {
    const out = new Map<string, number | null>()
    const prevByTail = new Map<string, PairingFlight>()
    for (const f of orderedRows) {
      const tailKey = f.tailNumber ?? `type:${f.aircraftType}`
      const prev = prevByTail.get(tailKey)
      if (!prev) {
        out.set(f.id, null)
      } else {
        const diff = Math.round((new Date(f.stdUtc).getTime() - new Date(prev.staUtc).getTime()) / 60000)
        out.set(f.id, diff > 0 ? diff : null)
      }
      prevByTail.set(tailKey, f)
    }
    return out
  }, [orderedRows])

  // Covered-by-pairing lookup + pairing code per row.
  const pairingCodeById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of pairings) for (const fid of p.flightIds) m.set(fid, p.pairingCode)
    return m
  }, [pairings])

  // Interleave flight rows with blank separator rows between rotation cycles.
  // The separator is a real <tr> with its own virtualized slot, giving a
  // clean visual row-break like Scheduling XL's cycle boundaries.
  type GridItem = { kind: 'flight'; flightIdx: number; flight: PairingFlight } | { kind: 'separator'; key: string }
  const SEPARATOR_HEIGHT = 14
  const items = useMemo<GridItem[]>(() => {
    const out: GridItem[] = []
    for (let i = 0; i < orderedRows.length; i += 1) {
      const cur = orderedRows[i]
      out.push({ kind: 'flight', flightIdx: i, flight: cur })
      const nxt = orderedRows[i + 1]
      if (nxt) {
        const curKey = `${cur.instanceDate}|${cur.rotationLabel ?? cur.aircraftType}`
        const nxtKey = `${nxt.instanceDate}|${nxt.rotationLabel ?? nxt.aircraftType}`
        if (curKey !== nxtKey) out.push({ kind: 'separator', key: `sep-${i}` })
      }
    }
    return out
  }, [orderedRows])

  // Prune stale selections after pool reloads.
  useEffect(() => {
    pruneTo(new Set(orderedRows.map((r) => r.id)))
  }, [orderedRows, pruneTo])

  // ── Virtualization ──
  const scrollParent = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParent.current,
    estimateSize: (index) => (items[index]?.kind === 'separator' ? SEPARATOR_HEIGHT : ROW_HEIGHT),
    overscan: 12,
  })

  // ── Drag state (mousedown → mouseenter → global mouseup) ──
  const draggingRef = useRef(false)
  useEffect(() => {
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
        endRange()
      }
    }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [endRange])

  // Recompute selected rows whenever the drag range updates — include every row
  // index from anchor to current.
  useEffect(() => {
    if (!rangeAnchor || !rangeCurrent) return
    const start = Math.min(rangeAnchor.rowIdx, rangeCurrent.rowIdx)
    const end = Math.max(rangeAnchor.rowIdx, rangeCurrent.rowIdx)
    const ids: string[] = []
    for (let i = start; i <= end; i += 1) {
      const row = orderedRows[i]
      if (row) ids.push(row.id)
    }
    setSelectedRows(ids)
  }, [rangeAnchor, rangeCurrent, orderedRows, setSelectedRows])

  // ── Cell / row mouse handlers ──
  const handleCellMouseDown = useCallback(
    (flight: PairingFlight, rowIdx: number, col: FlightGridColumnKey, e: ReactMouseEvent) => {
      if (e.button !== 0) return // only left-click starts drag; right-click handled by onContextMenu
      e.preventDefault()
      const additive = e.metaKey || e.ctrlKey
      if (e.shiftKey && activeCell) {
        // Extend from existing anchor
        beginRange({ rowIdx: activeCell.rowIdx, col: activeCell.col }, flight.id, true)
        extendRange({ rowIdx, col }, flight.id)
        draggingRef.current = true
        return
      }
      if (additive) {
        toggleRow(flight.id, rowIdx)
        focusCell({ rowIdx, col }, true)
        return
      }
      // Plain click starts a drag range; becomes a single-row pick on mouseup.
      beginRange({ rowIdx, col }, flight.id, false)
      draggingRef.current = true
    },
    [activeCell, beginRange, extendRange, toggleRow, focusCell],
  )

  const handleCellMouseEnter = useCallback(
    (flight: PairingFlight, rowIdx: number, col: FlightGridColumnKey) => {
      if (!draggingRef.current) return
      extendRange({ rowIdx, col }, flight.id)
    },
    [extendRange],
  )

  const handleRowNumberMouseDown = useCallback(
    (flight: PairingFlight, rowIdx: number, e: ReactMouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      const additive = e.metaKey || e.ctrlKey
      if (e.shiftKey && activeCell) {
        beginRange({ rowIdx: activeCell.rowIdx, col: activeCell.col }, flight.id, true)
        extendRange({ rowIdx, col: 'ac' }, flight.id)
        draggingRef.current = true
        return
      }
      if (additive) {
        toggleRow(flight.id, rowIdx)
        return
      }
      selectRow(flight.id, rowIdx, false)
    },
    [activeCell, beginRange, extendRange, toggleRow, selectRow],
  )

  const handleRowNumberMouseEnter = useCallback(
    (flight: PairingFlight, rowIdx: number) => {
      if (!draggingRef.current) return
      extendRange({ rowIdx, col: 'ac' }, flight.id)
    },
    [extendRange],
  )

  const handleSelectAll = useCallback(() => {
    if (selectedRowIds.size === orderedRows.length && orderedRows.length > 0) {
      clearAll()
    } else {
      selectAllAction(orderedRows.map((r) => r.id))
    }
  }, [selectedRowIds.size, orderedRows, clearAll, selectAllAction])

  const handleSelectColumn = useCallback(
    (col: FlightGridColumnKey) => {
      selectColumn(col)
    },
    [selectColumn],
  )

  // Derive the selection-as-ordered-list early so the Enter handler below can
  // hand it straight to the create callbacks. Must match what the right-click
  // menu passes so the guards (oversized + legality) fire identically.
  const selectedFlightIds = useMemo(() => {
    return orderedRows.filter((r) => selectedRowIds.has(r.id)).map((r) => r.id)
  }, [orderedRows, selectedRowIds])

  // ── Keyboard shortcuts ──
  //   Ctrl/Cmd + A         → select all visible rows
  //   Escape               → clear selection
  //   Enter                → Create Pairing (uses current selection)
  //
  // Suppressed while typing in an input, and while `canCreate` is false
  // (which the parent sets when a dialog is open or a save is mid-flight).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAllAction(orderedRows.map((r) => r.id))
        return
      }
      if (e.key === 'Escape') {
        clearAll()
        return
      }
      if (e.key === 'Enter') {
        if (!canCreate) return
        if (selectedFlightIds.length === 0) return
        e.preventDefault()
        onCreatePairing(selectedFlightIds)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [orderedRows, selectAllAction, clearAll, canCreate, selectedFlightIds, onCreatePairing])

  // ── Context menu ──
  type MenuCtx =
    | { kind: 'create' }
    | { kind: 'pairing'; pairingId: string; pairingCode: string }
    | { kind: 'layover-continue'; clickedFlight: PairingFlight; targetDate: string }
  const [menu, setMenu] = useState<{ x: number; y: number; ctx: MenuCtx } | null>(null)

  const handleContextMenu = useCallback(
    (flight: PairingFlight, e: ReactMouseEvent) => {
      e.preventDefault()
      const target = e.target as HTMLElement
      const td = target.closest('td') as HTMLTableCellElement | null
      const colKey = td?.dataset.colKey
      // Right-click on PAIRING cell with a value → pairing-context menu.
      if (colKey === 'pairingCode' && flight.pairingId) {
        const code = pairingCodeById.get(flight.id)
        if (code) {
          setMenu({
            x: e.clientX,
            y: e.clientY,
            ctx: { kind: 'pairing', pairingId: flight.pairingId, pairingCode: code },
          })
          return
        }
      }
      // Layover mode active AND the right-clicked row isn't the anchor flight
      // itself → offer "Add return on {targetDate}". Parent's swap-effect
      // handles replacing the click with the correct-date replica.
      if (layoverMode && flight.id !== layoverMode.afterFlightId) {
        const anchor = flights.find((f) => f.id === layoverMode.afterFlightId)
        if (anchor) {
          const targetDate = addDaysIsoLocal(anchor.staUtc.slice(0, 10), layoverMode.days)
          setMenu({
            x: e.clientX,
            y: e.clientY,
            ctx: { kind: 'layover-continue', clickedFlight: flight, targetDate },
          })
          return
        }
      }
      // Anywhere else → existing create menu based on the current selection.
      setMenu({ x: e.clientX, y: e.clientY, ctx: { kind: 'create' } })
    },
    [pairingCodeById, layoverMode, flights],
  )

  return (
    <div
      ref={scrollParent}
      className="flex-1 min-h-0 overflow-auto"
      style={{ cursor: draggingRef.current ? 'cell' : undefined }}
    >
      <table
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'separate',
          borderSpacing: 0,
        }}
      >
        <FlightGridHeader
          isDark={isDark}
          highlightedCol={highlightedCol}
          allSelected={selectedRowIds.size > 0 && selectedRowIds.size === orderedRows.length}
          someSelected={selectedRowIds.size > 0}
          onSelectAll={handleSelectAll}
          onSelectColumn={(col) => handleSelectColumn(col)}
        />
        <tbody>
          {/* Top spacer */}
          {rowVirtualizer.getVirtualItems()[0] && (
            <tr>
              <td
                colSpan={FLIGHT_GRID_COLUMNS.length + 1}
                style={{
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  height: rowVirtualizer.getVirtualItems()[0].start,
                }}
              />
            </tr>
          )}
          {rowVirtualizer.getVirtualItems().map((vItem) => {
            const item = items[vItem.index]
            if (!item) return null
            if (item.kind === 'separator') {
              // Blank spacer row — renders as empty space, not interactive.
              return (
                <tr key={item.key} aria-hidden="true" style={{ height: SEPARATOR_HEIGHT }}>
                  <td
                    colSpan={FLIGHT_GRID_COLUMNS.length + 1}
                    style={{ border: 'none', padding: 0, background: 'transparent' }}
                  />
                </tr>
              )
            }
            const { flight, flightIdx } = item
            const code = pairingCodeById.get(flight.id) ?? null
            return (
              <FlightGridRow
                key={flight.id}
                flight={flight}
                rotationSeq={rotationSeqByRow.get(flight.id) ?? 0}
                rowIdx={flightIdx}
                tatMinutes={tatByRow.get(flight.id) ?? null}
                rowNumber={flightIdx + 1}
                pairingCode={code}
                isSelected={selectedRowIds.has(flight.id)}
                isCovered={!!code}
                activeCol={activeCell?.col ?? null}
                activeRowIdx={activeCell?.rowIdx ?? null}
                rangeStartRow={rangeAnchor?.rowIdx ?? null}
                rangeEndRow={rangeCurrent?.rowIdx ?? null}
                highlightedCol={highlightedCol}
                isDark={isDark}
                onCellMouseDown={handleCellMouseDown}
                onCellMouseEnter={handleCellMouseEnter}
                onRowNumberMouseDown={handleRowNumberMouseDown}
                onRowNumberMouseEnter={handleRowNumberMouseEnter}
                onContextMenu={handleContextMenu}
              />
            )
          })}
          {/* Bottom spacer */}
          {(() => {
            const virts = rowVirtualizer.getVirtualItems()
            if (virts.length === 0) return null
            const last = virts[virts.length - 1]
            const bottom = rowVirtualizer.getTotalSize() - (last.start + last.size)
            if (bottom <= 0) return null
            return (
              <tr>
                <td
                  colSpan={FLIGHT_GRID_COLUMNS.length + 1}
                  style={{ padding: 0, margin: 0, border: 'none', height: bottom }}
                />
              </tr>
            )
          })()}
        </tbody>
      </table>

      {menu &&
        menu.ctx.kind === 'create' &&
        (() => {
          // When the user has exactly one flight selected we surface its ARR
          // station so the context menu can offer "Layover at {ARR}". Beyond
          // one selection the action doesn't make sense (you layover after the
          // last leg of a chain, not mid-selection of many).
          const singleSelectionArr =
            selectedFlightIds.length === 1
              ? (orderedRows.find((r) => r.id === selectedFlightIds[0])?.arrivalAirport ?? null)
              : null
          return (
            <FlightGridContextMenu
              x={menu.x}
              y={menu.y}
              variant="create"
              selectionCount={selectedFlightIds.length}
              singleSelectionArr={singleSelectionArr}
              onClose={() => setMenu(null)}
              onCreatePairing={() => onCreatePairing(selectedFlightIds)}
              onClearSelection={() => clearAll()}
              onStartLayover={
                onStartLayover && singleSelectionArr
                  ? (station) => {
                      onStartLayover(selectedFlightIds[0], station, menu.x, menu.y)
                      setMenu(null)
                    }
                  : undefined
              }
            />
          )
        })()}
      {menu && menu.ctx.kind === 'pairing' && (
        <FlightGridContextMenu
          x={menu.x}
          y={menu.y}
          variant="pairing"
          pairingCode={menu.ctx.pairingCode}
          onClose={() => setMenu(null)}
          onInspect={() => onInspectPairing((menu.ctx as { pairingId: string }).pairingId)}
          onDelete={() => onDeletePairing((menu.ctx as { pairingId: string }).pairingId)}
        />
      )}
      {menu &&
        menu.ctx.kind === 'layover-continue' &&
        (() => {
          const { clickedFlight, targetDate } = menu.ctx
          return (
            <FlightGridContextMenu
              x={menu.x}
              y={menu.y}
              variant="layover-continue"
              flightNumber={clickedFlight.flightNumber}
              targetDate={targetDate}
              onClose={() => setMenu(null)}
              onCancelLayover={() => clearLayover()}
              onAddReturn={() => {
                // Add the clicked flight additively — the parent's
                // swap-on-mismatch effect in `flight-pool-panel` then swaps to
                // the correct-date replica and clears layover mode.
                toggleRow(clickedFlight.id, 0)
              }}
            />
          )
        })()}

      {/* Reserved header space hint — keep the header flush */}
      <style>{`:root { --flight-grid-header-h: ${HEADER_HEIGHT}px; }`}</style>
    </div>
  )
}

function addDaysIsoLocal(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
