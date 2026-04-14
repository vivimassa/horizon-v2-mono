'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ScheduledFlightRef } from '@skyhub/api'
import { useScheduleGridStore, EMPTY_BUFFER_ROWS } from '@/stores/use-schedule-grid-store'
import { GridHeader } from './grid-header'
import { GridRow } from './grid-row'
import { GRID_COLUMNS, ROW_HEIGHT, type GridColumn } from './grid-columns'
import { useGridKeyboard } from './use-grid-keyboard'
import { useGridSortStore, sortRows } from './use-grid-sort'
import { GridContextMenu, type ContextMenuState } from './context-menu'
import { FindReplaceDialog } from './find-replace-dialog'
import { useTheme } from '@/components/theme-provider'

interface ScheduleGridProps {
  rows: ScheduledFlightRef[]
  columns?: GridColumn[]
  onSave: () => void
  onAddFlight: (insertAtIdx?: number) => void
  onDeleteFlight: (rowIdx: number) => void
  onTabWrapDown?: () => void
  onOpenFind?: () => void
  onOpenReplace?: () => void
  onClickEmptyRow?: (colKey: string) => void
  rowHeight?: number
  emptyBufferRows?: number
  showFind?: boolean
  showReplace?: boolean
  onCloseFind?: () => void
}

const SEPARATOR_HEIGHT = 12

export function ScheduleGrid({
  rows,
  columns: columnsProp,
  onSave,
  onAddFlight,
  onDeleteFlight,
  onTabWrapDown,
  onOpenFind,
  onOpenReplace,
  onClickEmptyRow,
  rowHeight: rowHeightProp,
  emptyBufferRows,
  showFind,
  showReplace,
  onCloseFind,
}: ScheduleGridProps) {
  const columns = columnsProp ?? GRID_COLUMNS
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedCell = useScheduleGridStore((s) => s.selectedCell)
  const separatorAfter = useScheduleGridStore((s) => s.separatorAfter)
  const addSeparator = useScheduleGridStore((s) => s.addSeparator)
  const removeSeparator = useScheduleGridStore((s) => s.removeSeparator)
  const copyCell = useScheduleGridStore((s) => s.copyCell)
  const cutCell = useScheduleGridStore((s) => s.cutCell)
  const pasteCell = useScheduleGridStore((s) => s.pasteCell)
  const selectCell = useScheduleGridStore((s) => s.selectCell)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const activeRowHeight = rowHeightProp ?? ROW_HEIGHT

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)

  // Global capture-phase keyboard handler
  useGridKeyboard({ onSave, onAddFlight, onDeleteFlight, onTabWrapDown, onOpenFind, onOpenReplace })

  // Sorting + column filters
  const sortKey = useGridSortStore((s) => s.sortKey)
  const sortDir = useGridSortStore((s) => s.sortDir)
  const [columnFilters, setColumnFilters] = useState<Map<string, Set<string>>>(new Map())
  const [colorFilters, setColorFilters] = useState<Map<string, import('./column-filter-dropdown').ColorFilter>>(
    new Map(),
  )
  const cellFormats = useScheduleGridStore((s) => s.cellFormats)

  const handleApplyFilter = useCallback(
    (colKey: string, values: Set<string>) => {
      setColumnFilters((prev) => {
        const next = new Map(prev)
        const allValues = new Set<string>()
        for (const row of rows) {
          const v = (row as any)[colKey]
          if (v != null && v !== '') allValues.add(String(v))
        }
        if (values.size >= allValues.size) next.delete(colKey)
        else next.set(colKey, values)
        return next
      })
    },
    [rows],
  )

  const handleApplyColorFilter = useCallback(
    (colKey: string, filter: import('./column-filter-dropdown').ColorFilter | null) => {
      setColorFilters((prev) => {
        const next = new Map(prev)
        if (filter) next.set(colKey, filter)
        else next.delete(colKey)
        return next
      })
    },
    [],
  )

  const deletedIds = useScheduleGridStore((s) => s.deletedIds)

  const processedRows = useMemo(() => {
    let result = rows.filter((r) => !deletedIds.has(r._id))
    for (const [colKey, allowedValues] of columnFilters) {
      result = result.filter((row) => {
        const v = (row as any)[colKey]
        return v != null && allowedValues.has(String(v))
      })
    }
    // Color filters
    for (const [colKey, cf] of colorFilters) {
      result = result.filter((row) => {
        const fmt = cellFormats.get(`${row._id}:${colKey}`)
        if (cf.type === 'bg') {
          return cf.color === '' ? !fmt?.bgColor : fmt?.bgColor === cf.color
        }
        return fmt?.textColor === cf.color
      })
    }
    return sortRows(result, sortKey, sortDir)
  }, [rows, deletedIds, columnFilters, colorFilters, cellFormats, sortKey, sortDir])

  // Pad with empty buffer rows below data (Excel-like)
  const emptyRowCount = emptyBufferRows ?? EMPTY_BUFFER_ROWS

  // Build virtual list with separator rows + empty padding injected
  type VirtualItem =
    | { type: 'data'; rowIdx: number }
    | { type: 'separator'; afterRowIdx: number }
    | { type: 'empty'; emptyIdx: number }
  const virtualItems = useMemo<VirtualItem[]>(() => {
    const items: VirtualItem[] = []
    for (let i = 0; i < processedRows.length; i++) {
      items.push({ type: 'data', rowIdx: i })
      if (separatorAfter.has(processedRows[i]._id)) {
        items.push({ type: 'separator', afterRowIdx: i })
      }
    }
    for (let i = 0; i < emptyRowCount; i++) {
      items.push({ type: 'empty', emptyIdx: i })
    }
    return items
  }, [processedRows, separatorAfter, emptyRowCount])

  // Virtualization
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (virtualItems[i].type === 'separator' ? SEPARATOR_HEIGHT : activeRowHeight),
    overscan: 50,
  })

  useEffect(() => {
    if (selectedCell) {
      // Find the virtual index for this data row
      const vIdx = virtualItems.findIndex((v) => v.type === 'data' && v.rowIdx === selectedCell.rowIdx)
      if (vIdx >= 0) virtualizer.scrollToIndex(vIdx, { align: 'auto' })
    }
  }, [selectedCell, virtualizer, virtualItems])

  const handleContextMenu = useCallback((e: React.MouseEvent, rowIdx: number, colKey: string) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, rowIdx, colKey })
  }, [])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sepColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const totalColSpan = columns.length + 1 // +1 for row number column

  return (
    <>
      <div className="flex-1 relative min-h-0">
        {/* Find/Replace — positioned inside the grid area */}
        {showFind && onCloseFind && <FindReplaceDialog rows={rows} onClose={onCloseFind} showReplace={showReplace} />}
        <div
          ref={scrollRef}
          className="h-full overflow-auto select-none focus:outline-none rounded-2xl"
          style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(20px)' }}
          tabIndex={0}
        >
          <table
            className="w-full text-[13px]"
            style={{
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
          >
            <GridHeader
              columns={columns}
              scrollLeft={0}
              rows={rows}
              columnFilters={columnFilters}
              colorFilters={colorFilters}
              onApplyFilter={handleApplyFilter}
              onApplyColorFilter={handleApplyColorFilter}
            />
            <tbody>
              {/* Top spacer — absorbs the offset of items scrolled off the top.
                 Required for TanStack Virtual on a <table>: the tbody's actual
                 height must equal the virtualizer's total size so the scroll
                 container's scrollHeight matches what the virtualizer believes.
                 Without this, the rendered chunk's height lags the virtual
                 total near the tail and scroll feedback loops (old-TV jitter). */}
              {(() => {
                const items = virtualizer.getVirtualItems()
                if (items.length === 0) return null
                const topPad = items[0].start
                if (topPad <= 0) return null
                return (
                  <tr aria-hidden style={{ height: topPad }}>
                    <td colSpan={totalColSpan} style={{ padding: 0, border: 'none' }} />
                  </tr>
                )
              })()}
              {virtualizer.getVirtualItems().map((vRow) => {
                const item = virtualItems[vRow.index]
                if (!item) return null

                if (item.type === 'separator') {
                  return (
                    <tr key={`sep-${item.afterRowIdx}`} style={{ height: SEPARATOR_HEIGHT }}>
                      <td colSpan={totalColSpan} style={{ background: sepColor, padding: 0, border: 'none' }} />
                    </tr>
                  )
                }

                if (item.type === 'empty') {
                  const emptyAbsIdx = processedRows.length + item.emptyIdx
                  const emptyBorder = `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
                  return (
                    <tr key={`empty-${item.emptyIdx}`} style={{ height: activeRowHeight }}>
                      {/* Row number cell */}
                      <td style={{ borderBottom: emptyBorder, padding: 0 }} />
                      {columns.map((col, ci) => {
                        const isSel = selectedCell?.rowIdx === emptyAbsIdx && selectedCell?.colKey === col.key
                        return (
                          <td
                            key={col.key}
                            style={{
                              borderBottom: emptyBorder,
                              borderRight: emptyBorder,
                              padding: 0,
                              cursor: 'cell',
                              outline: isSel ? `2px solid #217346` : undefined,
                              outlineOffset: isSel ? -2 : undefined,
                            }}
                            onClick={() => {
                              if (onClickEmptyRow) onClickEmptyRow(col.key)
                              else selectCell({ rowIdx: emptyAbsIdx, colKey: col.key })
                            }}
                          />
                        )
                      })}
                    </tr>
                  )
                }

                const row = processedRows[item.rowIdx]
                if (!row) return null
                return (
                  <GridRow
                    key={row._id}
                    columns={columns}
                    row={row}
                    rowIdx={item.rowIdx}
                    prevRow={item.rowIdx > 0 ? processedRows[item.rowIdx - 1] : null}
                    onContextMenu={handleContextMenu}
                    onTabWrapDown={onTabWrapDown}
                    rowHeight={activeRowHeight}
                  />
                )
              })}
              {/* Bottom spacer — absorbs the virtual distance below the last
                 rendered item. Together with the top spacer this makes the
                 tbody's pixel height equal the virtualizer's total size. */}
              {(() => {
                const items = virtualizer.getVirtualItems()
                if (items.length === 0) return null
                const last = items[items.length - 1]
                const bottomPad = virtualizer.getTotalSize() - last.end
                if (bottomPad <= 0) return null
                return (
                  <tr aria-hidden style={{ height: bottomPad }}>
                    <td colSpan={totalColSpan} style={{ padding: 0, border: 'none' }} />
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context menu — portalled to document.body so scroll/stacking context doesn't offset it */}
      {ctxMenu &&
        createPortal(
          <GridContextMenu
            state={ctxMenu}
            onClose={() => setCtxMenu(null)}
            onInsertRow={() => onAddFlight(ctxMenu.rowIdx)}
            onDeleteRow={() => onDeleteFlight(ctxMenu.rowIdx)}
            onSeparateCycle={() => {
              const r = processedRows[ctxMenu.rowIdx]
              if (r) addSeparator(r._id)
            }}
            onRemoveSeparator={() => {
              const r = processedRows[ctxMenu.rowIdx]
              if (r) removeSeparator(r._id)
            }}
            hasSeparator={!!processedRows[ctxMenu.rowIdx] && separatorAfter.has(processedRows[ctxMenu.rowIdx]._id)}
            onCopy={copyCell}
            onCut={cutCell}
            onPaste={() => pasteCell()}
            hasSelection={!!selectedCell}
            currentStatus={processedRows[ctxMenu.rowIdx]?.status}
            onChangeStatus={(status) => {
              const markDirty = useScheduleGridStore.getState().markDirty
              const range = useScheduleGridStore.getState().selectionRange
              if (range) {
                const r1 = Math.min(range.startRow, range.endRow)
                const r2 = Math.max(range.startRow, range.endRow)
                for (let i = r1; i <= r2; i++) {
                  const row = processedRows[i]
                  if (row) markDirty(row._id, { status } as any)
                }
              } else {
                const row = processedRows[ctxMenu.rowIdx]
                if (row) markDirty(row._id, { status } as any)
              }
            }}
          />,
          document.body,
        )}
    </>
  )
}
