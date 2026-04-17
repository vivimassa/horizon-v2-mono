'use client'

import { create } from 'zustand'
import type { ScheduledFlightRef } from '@skyhub/api'
import type { CellFormat, ClipboardData } from '@/components/network/schedule-grid/types'
import { MAX_UNDO_DEPTH } from '@/components/network/schedule-grid/types'
import { GRID_COLUMNS } from '@/components/network/schedule-grid/grid-columns'
import { parseDate, formatDate } from '@/lib/date-format'
import { useOperatorStore, getOperatorId } from './use-operator-store'
import { useScheduleRefStore } from './use-schedule-ref-store'

export interface CellAddress {
  rowIdx: number
  colKey: string
}

/** Snapshot for undo/redo: captures full dirtyMap state */
interface UndoSnapshot {
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>
}

interface ScheduleGridState {
  // Filter period (from left panel)
  filterDateFrom: string
  filterDateTo: string
  setFilterPeriod: (from: string, to: string) => void

  // Data
  rows: ScheduledFlightRef[]
  setRows: (rows: ScheduledFlightRef[]) => void

  // Dirty tracking
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>
  markDirty: (id: string, changes: Partial<ScheduledFlightRef>) => void
  clearDirty: () => void
  getDirtyValue: (id: string, field: string) => unknown | undefined
  isDirty: () => boolean

  // Selection
  selectedCell: CellAddress | null
  selectCell: (cell: CellAddress | null) => void

  // Range selection (Shift+Arrow, Shift+Space, Ctrl+Space, drag)
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null
  setSelectionRange: (range: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void
  extendSelection: (dRow: number, dCol: number) => void
  selectEntireRow: () => void
  selectEntireColumn: () => void
  selectAll: () => void
  highlightedCol: number | null

  // Editing
  editingCell: CellAddress | null
  editValue: string
  startEditing: (cell: CellAddress, initialValue?: string) => void
  setEditValue: (value: string) => void
  commitEdit: () => void
  cancelEdit: () => void

  // New rows pending creation (tracked by id; rows live in `rows[]`)
  newRowIds: Set<string>
  addNewRow: (row: ScheduledFlightRef) => void
  insertRowAt: (row: ScheduledFlightRef, atIdx: number) => void
  removeNewRow: (id: string) => void
  clearNewRows: () => void

  // Soft-deleted rows (pending Save to actually remove from DB)
  deletedIds: Set<string>
  markDeleted: (id: string) => void
  clearDeleted: () => void

  // Cell formatting
  cellFormats: Map<string, CellFormat>
  setCellFormat: (rowId: string, colKey: string, format: Partial<CellFormat>) => void
  getCellFormat: (rowId: string, colKey: string) => CellFormat | undefined
  clearCellFormats: () => void

  // ── Undo/Redo ──
  undoStack: UndoSnapshot[]
  redoStack: UndoSnapshot[]
  pushUndo: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // ── Clipboard ──
  clipboard: ClipboardData | null
  copyCell: () => void
  cutCell: () => void
  pasteCell: () => Promise<void>

  // ── Formatting toggles ──
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void

  // ── Format Painter ──
  formatPainterSource: CellFormat | null
  activateFormatPainter: () => void
  applyFormatPainter: (rowId: string, colKey: string) => void
  cancelFormatPainter: () => void

  // ── Cycle separators (blank rows between rotations) ──
  separatorAfter: Set<string> // Set of row IDs that have a separator below them
  addSeparator: (rowId: string) => void
  removeSeparator: (rowId: string) => void
  clearSeparators: () => void
}

/** Number of empty buffer rows shown below data (Excel-like padding) */
export const EMPTY_BUFFER_ROWS = 20

export interface SmartRowOptions {
  filterDateFrom?: string
  filterDateTo?: string
  seasonCode?: string
  airlineCode?: string
  /** Scenario context for the new row. null = Production, string = scenario _id. Must be set explicitly. */
  scenarioId?: string | null
}

/**
 * Create a smart ScheduledFlightRef with cycle-aware defaults.
 * Detects closed rotations, chains DEP from prev ARR, suggests STD from prev STA + TAT.
 * `allRows` = all current data rows, `dirtyMap` = pending edits.
 */
export function createSmartRow(
  allRows: ScheduledFlightRef[],
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>,
  getTatMinutes: ((icao: string, dep?: string, arr?: string) => number | null) | null,
  options?: SmartRowOptions,
): ScheduledFlightRef {
  const lastRow = allRows[allRows.length - 1]
  const lastDirty = lastRow ? dirtyMap.get(lastRow._id) : undefined

  const defaultFrom = (lastDirty?.effectiveFrom as string) ?? lastRow?.effectiveFrom ?? options?.filterDateFrom ?? ''
  const defaultTo = (lastDirty?.effectiveUntil as string) ?? lastRow?.effectiveUntil ?? options?.filterDateTo ?? ''
  const lastArr = (lastDirty?.arrStation as string) ?? lastRow?.arrStation ?? ''

  // Detect closed cycle: walk backwards to find the start of the current rotation
  let cycleClosed = false
  if (lastRow && lastArr) {
    let rotationStartDep = ''
    for (let i = allRows.length - 1; i >= 0; i--) {
      const r = allRows[i]
      const rd = dirtyMap.get(r._id)
      const dep = (rd?.depStation as string) ?? r.depStation ?? ''
      if (i < allRows.length - 1) {
        const nextRow = allRows[i + 1]
        const nextDirty = dirtyMap.get(nextRow._id)
        const nextDep = (nextDirty?.depStation as string) ?? nextRow.depStation ?? ''
        const thisArr = (rd?.arrStation as string) ?? r.arrStation ?? ''
        if (thisArr !== nextDep) {
          const startRow = allRows[i + 1]
          const startDirty = dirtyMap.get(startRow._id)
          rotationStartDep = (startDirty?.depStation as string) ?? startRow.depStation ?? ''
          break
        }
      }
      if (i === 0) rotationStartDep = dep
    }
    cycleClosed = rotationStartDep !== '' && lastArr.toUpperCase() === rotationStartDep.toUpperCase()
  }

  const defaultDep = cycleClosed ? '' : lastArr
  const prevAcType = (lastDirty?.aircraftTypeIcao as string) ?? lastRow?.aircraftTypeIcao ?? ''

  // Auto-suggest STD from previous row's STA + TAT
  let defaultStd = ''
  if (!cycleClosed && getTatMinutes) {
    const prevSta = (lastDirty?.staUtc as string) ?? lastRow?.staUtc ?? ''
    if (prevSta && prevAcType) {
      const prevDep = (lastDirty?.depStation as string) ?? lastRow?.depStation ?? ''
      const prevArr = lastArr
      const tatMin = getTatMinutes(prevAcType, prevDep, prevArr)
      if (tatMin != null) {
        const clean = prevSta.replace(':', '')
        const hh = clean.length >= 3 ? Number(clean.slice(0, clean.length - 2)) : NaN
        const mm = clean.length >= 3 ? Number(clean.slice(-2)) : NaN
        if (!isNaN(hh) && !isNaN(mm)) {
          const totalMin = hh * 60 + mm + tatMin
          const h = Math.floor(totalMin / 60) % 24
          const m = totalMin % 60
          defaultStd = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        }
      }
    }
  }

  return {
    _id: crypto.randomUUID(),
    operatorId: lastRow?.operatorId ?? getOperatorId(),
    seasonCode: options?.seasonCode ?? lastRow?.seasonCode ?? '',
    airlineCode: options?.airlineCode ?? lastRow?.airlineCode ?? 'XX',
    flightNumber: '',
    suffix: null,
    depStation: defaultDep,
    arrStation: '',
    depAirportId: null,
    arrAirportId: null,
    stdUtc: defaultStd,
    staUtc: '',
    stdLocal: null,
    staLocal: null,
    blockMinutes: null,
    departureDayOffset: 1,
    arrivalDayOffset: 1,
    daysOfWeek: (lastDirty?.daysOfWeek as string) ?? lastRow?.daysOfWeek ?? '1234567',
    aircraftTypeId: cycleClosed ? null : ((lastDirty?.aircraftTypeId as string) ?? lastRow?.aircraftTypeId ?? null),
    aircraftTypeIcao: cycleClosed ? null : prevAcType || null,
    aircraftReg: null,
    serviceType: (lastDirty?.serviceType as string) ?? lastRow?.serviceType ?? 'J',
    status: 'draft',
    previousStatus: null,
    effectiveFrom: defaultFrom,
    effectiveUntil: defaultTo,
    cockpitCrewRequired: null,
    cabinCrewRequired: null,
    isEtops: false,
    isOverwater: false,
    isActive: true,
    scenarioId: options?.scenarioId !== undefined ? options.scenarioId : (lastRow?.scenarioId ?? null),
    rotationId: null,
    rotationSequence: null,
    rotationLabel: null,
    source: '1.1.1 Scheduling XL',
    sortOrder: allRows.length,
    formatting: {},
    createdAt: null,
    updatedAt: null,
  }
}

/** Iterate over all cells in the current selection (range or single cell) */
function forEachSelectedCell(state: ScheduleGridState, fn: (rowId: string, colKey: string) => void) {
  const { selectedCell, selectionRange, rows, deletedIds } = state
  if (!selectedCell) return
  const allRows = rows.filter((r) => !deletedIds.has(r._id))

  if (selectionRange) {
    const r1 = Math.min(selectionRange.startRow, selectionRange.endRow)
    const r2 = Math.max(selectionRange.startRow, selectionRange.endRow)
    const c1 = Math.min(selectionRange.startCol, selectionRange.endCol)
    const c2 = Math.max(selectionRange.startCol, selectionRange.endCol)
    for (let ri = r1; ri <= r2; ri++) {
      const row = allRows[ri]
      if (!row) continue
      for (let ci = c1; ci <= c2; ci++) {
        const col = GRID_COLUMNS[ci]
        if (col) fn(row._id, col.key)
      }
    }
  } else {
    const row = allRows[selectedCell.rowIdx]
    if (row) fn(row._id, selectedCell.colKey)
  }
}

/** Clone a dirtyMap for snapshot */
function cloneDirtyMap(m: Map<string, Partial<ScheduledFlightRef>>): Map<string, Partial<ScheduledFlightRef>> {
  const next = new Map<string, Partial<ScheduledFlightRef>>()
  for (const [k, v] of m) next.set(k, { ...v })
  return next
}

export const useScheduleGridStore = create<ScheduleGridState>((set, get) => ({
  filterDateFrom: '',
  filterDateTo: '',
  setFilterPeriod: (from, to) => set({ filterDateFrom: from, filterDateTo: to }),
  rows: [],
  setRows: (rows) => set({ rows }),

  dirtyMap: new Map(),
  markDirty: (id, changes) => {
    const state = get()
    // Push undo snapshot BEFORE applying the change
    const undoStack = [...state.undoStack, { dirtyMap: cloneDirtyMap(state.dirtyMap) }]
    if (undoStack.length > MAX_UNDO_DEPTH) undoStack.shift()

    const next = new Map(state.dirtyMap)
    const existing = next.get(id) ?? {}
    next.set(id, { ...existing, ...changes })
    set({ dirtyMap: next, undoStack, redoStack: [] })
  },
  clearDirty: () => set({ dirtyMap: new Map(), undoStack: [], redoStack: [] }),
  getDirtyValue: (id, field) => {
    const dirty = get().dirtyMap.get(id)
    return dirty ? (dirty as any)[field] : undefined
  },
  isDirty: () => get().dirtyMap.size > 0 || get().newRowIds.size > 0,

  selectedCell: null,
  selectCell: (cell) => {
    const { formatPainterSource, applyFormatPainter, rows } = get()
    // If format painter is active and clicking a cell, apply the format
    if (formatPainterSource && cell) {
      const row = rows[cell.rowIdx]
      if (row) applyFormatPainter(row._id, cell.colKey)
    }
    set({ selectedCell: cell, selectionRange: null, highlightedCol: null, editingCell: null, editValue: '' })
  },

  // ── Range selection ──
  selectionRange: null,
  highlightedCol: null,
  setSelectionRange: (range) => set({ selectionRange: range }),

  extendSelection: (dRow, dCol) => {
    const { selectedCell, selectionRange, rows } = get()
    if (!selectedCell) return
    const totalRows = rows.length + EMPTY_BUFFER_ROWS
    const totalCols = GRID_COLUMNS.length
    const anchorRow = selectedCell.rowIdx
    const anchorCol = GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey)
    const current = selectionRange
      ? { row: selectionRange.endRow, col: selectionRange.endCol }
      : { row: anchorRow, col: anchorCol }
    const newRow = Math.max(0, Math.min(totalRows - 1, current.row + dRow))
    const newCol = Math.max(0, Math.min(totalCols - 1, current.col + dCol))
    set({
      selectionRange: { startRow: anchorRow, startCol: anchorCol, endRow: newRow, endCol: newCol },
    })
  },

  selectEntireRow: () => {
    const { selectedCell, selectionRange } = get()
    if (!selectedCell) return
    const totalCols = GRID_COLUMNS.length
    const startRow = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : selectedCell.rowIdx
    const endRow = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : selectedCell.rowIdx
    set({
      selectionRange: { startRow, startCol: 0, endRow, endCol: totalCols - 1 },
    })
  },

  selectEntireColumn: () => {
    const { selectedCell, rows } = get()
    if (!selectedCell) return
    const colIdx = GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey)
    const totalRows = rows.length
    set({
      selectionRange: { startRow: 0, startCol: colIdx, endRow: totalRows - 1, endCol: colIdx },
      highlightedCol: colIdx,
    })
  },

  selectAll: () => {
    const { rows } = get()
    const totalRows = rows.length
    if (totalRows === 0) return
    set({
      selectedCell: { rowIdx: 0, colKey: GRID_COLUMNS[0].key },
      selectionRange: { startRow: 0, startCol: 0, endRow: totalRows - 1, endCol: GRID_COLUMNS.length - 1 },
    })
  },

  editingCell: null,
  editValue: '',
  startEditing: (cell, initialValue) => {
    const { rows, getDirtyValue, addNewRow } = get()
    const allRows = rows
    let row = allRows[cell.rowIdx]

    // Auto-create a smart row if editing beyond existing data (Excel-like)
    // Always appends as the next data row — no gap filling
    if (!row) {
      const { dirtyMap, filterDateFrom, filterDateTo } = get()
      const getTat = useScheduleRefStore.getState().getTatMinutes
      const opStore = useOperatorStore.getState()
      const smart = createSmartRow(allRows, dirtyMap, getTat, {
        filterDateFrom: filterDateFrom || undefined,
        filterDateTo: filterDateTo || undefined,
        airlineCode: opStore.operator?.iataCode || undefined,
        scenarioId: opStore.activeScenarioId,
      })
      addNewRow(smart)
      row = smart
      const newIdx = allRows.length
      cell = { rowIdx: newIdx, colKey: cell.colKey }
    }

    // Use dirty value if it exists, otherwise the row's raw value
    const dirtyVal = getDirtyValue(row._id, cell.colKey)
    const rawVal =
      dirtyVal !== undefined
        ? String(dirtyVal)
        : (row as any)[cell.colKey] != null
          ? String((row as any)[cell.colKey])
          : ''

    // For date columns, show the formatted date in the edit input (not raw ISO)
    let displayVal = rawVal
    const isDateCol = cell.colKey === 'effectiveFrom' || cell.colKey === 'effectiveUntil'
    if (isDateCol && rawVal && !initialValue) {
      const opDateFormat = useOperatorStore.getState().dateFormat
      displayVal = formatDate(rawVal, opDateFormat)
    }

    set({
      selectedCell: cell,
      editingCell: cell,
      editValue: initialValue ?? displayVal,
    })
  },
  setEditValue: (value) => set({ editValue: value }),
  commitEdit: () => {
    const { editingCell, editValue, rows, markDirty, addNewRow } = get()
    if (!editingCell) return
    const allRows = rows
    let row = allRows[editingCell.rowIdx]
    // Auto-create if committing on an empty row (safety — startEditing usually handles this)
    if (!row) {
      const getTat = useScheduleRefStore.getState().getTatMinutes
      const { dirtyMap: dm, filterDateFrom, filterDateTo } = get()
      const opStore = useOperatorStore.getState()
      const smart = createSmartRow(allRows, dm, getTat, {
        filterDateFrom: filterDateFrom || undefined,
        filterDateTo: filterDateTo || undefined,
        airlineCode: opStore.operator?.iataCode || undefined,
        scenarioId: opStore.activeScenarioId,
      })
      addNewRow(smart)
      row = smart
    }

    // For date columns, parse user input to ISO before storing
    const isDateCol = editingCell.colKey === 'effectiveFrom' || editingCell.colKey === 'effectiveUntil'
    let finalValue = editValue
    if (isDateCol && editValue) {
      const opDateFormat = useOperatorStore.getState().dateFormat
      finalValue = parseDate(editValue, opDateFormat)
    }

    const oldVal = (row as any)[editingCell.colKey]
    const changed = String(oldVal ?? '') !== finalValue

    // For suggested date cells (draft rows with pre-filled FROM/TO from filter panel),
    // mark dirty even if the value didn't change — this "accepts" the suggestion
    // and removes the italic styling, confirming the user acknowledged the value.
    const isSuggestedAccept = isDateCol && !changed && finalValue && row.status === 'draft'

    if (changed || isSuggestedAccept) {
      markDirty(row._id, { [editingCell.colKey]: finalValue } as Partial<ScheduledFlightRef>)
    }
    set({ editingCell: null, editValue: '' })
  },
  cancelEdit: () => set({ editingCell: null, editValue: '' }),

  newRowIds: new Set<string>(),
  addNewRow: (row) =>
    set((state) => {
      const ids = new Set(state.newRowIds)
      ids.add(row._id)
      return { rows: [...state.rows, row], newRowIds: ids }
    }),
  insertRowAt: (row, atIdx) =>
    set((state) => {
      const ids = new Set(state.newRowIds)
      ids.add(row._id)
      const next = [...state.rows]
      next.splice(Math.min(atIdx, next.length), 0, row)
      return { rows: next, newRowIds: ids }
    }),
  removeNewRow: (id) =>
    set((state) => {
      const ids = new Set(state.newRowIds)
      ids.delete(id)
      return { rows: state.rows.filter((r) => r._id !== id), newRowIds: ids }
    }),
  clearNewRows: () =>
    set((state) => {
      const ids = state.newRowIds
      if (ids.size === 0) return {}
      return { rows: state.rows.filter((r) => !ids.has(r._id)), newRowIds: new Set<string>() }
    }),

  deletedIds: new Set(),
  markDeleted: (id) =>
    set((state) => {
      const next = new Set(state.deletedIds)
      next.add(id)
      return { deletedIds: next }
    }),
  clearDeleted: () => set({ deletedIds: new Set() }),

  cellFormats: new Map(),
  setCellFormat: (rowId, colKey, format) =>
    set((state) => {
      const next = new Map(state.cellFormats)
      const key = `${rowId}:${colKey}`
      const existing = next.get(key) ?? {}
      next.set(key, { ...existing, ...format })
      return { cellFormats: next }
    }),
  getCellFormat: (rowId, colKey) => get().cellFormats.get(`${rowId}:${colKey}`),
  clearCellFormats: () => set({ cellFormats: new Map() }),

  // ── Undo/Redo ──
  undoStack: [],
  redoStack: [],
  pushUndo: () => {
    const { dirtyMap, undoStack } = get()
    const next = [...undoStack, { dirtyMap: cloneDirtyMap(dirtyMap) }]
    if (next.length > MAX_UNDO_DEPTH) next.shift()
    set({ undoStack: next, redoStack: [] })
  },
  undo: () => {
    const { undoStack, redoStack, dirtyMap } = get()
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { dirtyMap: cloneDirtyMap(dirtyMap) }],
      dirtyMap: cloneDirtyMap(prev.dirtyMap),
    })
  },
  redo: () => {
    const { undoStack, redoStack, dirtyMap } = get()
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { dirtyMap: cloneDirtyMap(dirtyMap) }],
      dirtyMap: cloneDirtyMap(next.dirtyMap),
    })
  },
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ── Clipboard ──
  clipboard: null,

  copyCell: () => {
    const { selectedCell, selectionRange, rows, getDirtyValue } = get()
    if (!selectedCell) return
    const allRows = rows

    // Determine affected rows and columns from range or single cell
    const r1 = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : selectedCell.rowIdx
    const r2 = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : selectedCell.rowIdx
    const c1 = selectionRange
      ? Math.min(selectionRange.startCol, selectionRange.endCol)
      : GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey)
    const c2 = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : c1

    const tsvRows: string[] = []
    const clipCells: { colKey: string; value: string }[] = []
    const rowIds: string[] = []
    const colKeys = GRID_COLUMNS.slice(c1, c2 + 1).map((c) => c.key)

    for (let ri = r1; ri <= r2; ri++) {
      const row = allRows[ri]
      if (!row) continue
      rowIds.push(row._id)
      const vals: string[] = []
      for (let ci = c1; ci <= c2; ci++) {
        const col = GRID_COLUMNS[ci]
        if (!col) continue
        const dirty = getDirtyValue(row._id, col.key)
        const v = dirty !== undefined ? String(dirty) : ((row as any)[col.key] ?? '')
        vals.push(String(v ?? ''))
        clipCells.push({ colKey: col.key, value: String(v ?? '') })
      }
      tsvRows.push(vals.join('\t'))
    }

    navigator.clipboard.writeText(tsvRows.join('\n')).catch(() => {})
    set({
      clipboard: {
        cells: clipCells,
        rowId: rowIds[0] ?? '',
        rowIds,
        colKeys,
        mode: 'copy',
      },
    })
  },

  cutCell: () => {
    const { selectedCell, selectionRange, rows, getDirtyValue, markDirty } = get()
    if (!selectedCell) return
    const allRows = rows

    const r1 = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : selectedCell.rowIdx
    const r2 = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : selectedCell.rowIdx
    const c1 = selectionRange
      ? Math.min(selectionRange.startCol, selectionRange.endCol)
      : GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey)
    const c2 = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : c1

    const tsvRows: string[] = []
    const clipCells: { colKey: string; value: string }[] = []
    const rowIds: string[] = []
    const colKeys = GRID_COLUMNS.slice(c1, c2 + 1).map((c) => c.key)

    for (let ri = r1; ri <= r2; ri++) {
      const row = allRows[ri]
      if (!row) continue
      rowIds.push(row._id)
      const vals: string[] = []
      for (let ci = c1; ci <= c2; ci++) {
        const col = GRID_COLUMNS[ci]
        if (!col) continue
        const dirty = getDirtyValue(row._id, col.key)
        const v = dirty !== undefined ? String(dirty) : ((row as any)[col.key] ?? '')
        vals.push(String(v ?? ''))
        clipCells.push({ colKey: col.key, value: String(v ?? '') })
      }
      tsvRows.push(vals.join('\t'))
    }

    navigator.clipboard.writeText(tsvRows.join('\n')).catch(() => {})
    set({
      clipboard: {
        cells: clipCells,
        rowId: rowIds[0] ?? '',
        rowIds,
        colKeys,
        mode: 'cut',
      },
    })

    // Clear all affected cells
    for (let ri = r1; ri <= r2; ri++) {
      const row = allRows[ri]
      if (!row) continue
      for (let ci = c1; ci <= c2; ci++) {
        const col = GRID_COLUMNS[ci]
        if (!col?.editable) continue
        markDirty(row._id, { [col.key]: '' } as Partial<ScheduledFlightRef>)
      }
    }
  },

  pasteCell: async () => {
    const { selectedCell, rows, markDirty, pushUndo, addNewRow } = get()
    if (!selectedCell) return
    const allRows = rows
    const row = allRows[selectedCell.rowIdx]
    if (!row) return
    const col = GRID_COLUMNS.find((c) => c.key === selectedCell.colKey)
    if (!col || !col.editable) return

    let text: string | null = null
    try {
      text = await navigator.clipboard.readText()
    } catch {
      // Clipboard access denied — try internal clipboard
      const { clipboard } = get()
      if (clipboard && clipboard.cells.length > 0) {
        const value = clipboard.cells[0].value
        markDirty(row._id, { [selectedCell.colKey]: value } as Partial<ScheduledFlightRef>)
      }
      return
    }

    if (!text) return

    // Parse clipboard: rows split by newlines, columns split by tabs (Excel/Sheets format)
    const pasteRows = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n')
    const pasteGrid = pasteRows.map((r) => r.split('\t'))

    // Single cell paste — no tabs, no newlines
    if (pasteGrid.length === 1 && pasteGrid[0].length === 1) {
      markDirty(row._id, { [selectedCell.colKey]: pasteGrid[0][0].trim() } as Partial<ScheduledFlightRef>)
      return
    }

    // Multi-cell paste: map columns starting from selected column, rows starting from selected row
    const startColIdx = GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey)
    if (startColIdx === -1) return

    pushUndo()

    // Use first existing row as template for new rows
    const templateRow = row

    let lastPastedRowId: string | null = null
    const { addSeparator } = get()

    for (let ri = 0; ri < pasteGrid.length; ri++) {
      const rowValues = pasteGrid[ri]
      // Blank row = cycle separator
      if (rowValues.every((v) => !v.trim())) {
        if (lastPastedRowId) addSeparator(lastPastedRowId)
        continue
      }

      const targetRowIdx = selectedCell.rowIdx + ri
      let targetRow = allRows[targetRowIdx]

      // Auto-create new smart rows when paste exceeds existing rows
      if (!targetRow) {
        const currentAll = get().rows
        const getTat = useScheduleRefStore.getState().getTatMinutes
        const smart = createSmartRow(currentAll, get().dirtyMap, getTat, {
          seasonCode: templateRow.seasonCode,
          airlineCode: templateRow.airlineCode,
          scenarioId: useOperatorStore.getState().activeScenarioId,
        })
        addNewRow(smart)
        targetRow = smart
      }

      const changes: Record<string, string> = {}
      for (let ci = 0; ci < rowValues.length; ci++) {
        const targetCol = GRID_COLUMNS[startColIdx + ci]
        if (!targetCol) break
        if (!targetCol.editable) continue
        changes[targetCol.key] = rowValues[ci].trim()
      }
      if (Object.keys(changes).length > 0) {
        markDirty(targetRow._id, changes as Partial<ScheduledFlightRef>)
      }
      lastPastedRowId = targetRow._id
    }
    // Clear clipboard indicator (dashed border) after paste
    set({ clipboard: null })
  },

  // ── Formatting toggles ──
  toggleBold: () => {
    const state = get()
    forEachSelectedCell(state, (rowId, colKey) => {
      const current = state.getCellFormat(rowId, colKey)
      state.setCellFormat(rowId, colKey, { bold: !current?.bold })
    })
  },
  toggleItalic: () => {
    const state = get()
    forEachSelectedCell(state, (rowId, colKey) => {
      const current = state.getCellFormat(rowId, colKey)
      state.setCellFormat(rowId, colKey, { italic: !current?.italic })
    })
  },
  toggleUnderline: () => {
    const state = get()
    forEachSelectedCell(state, (rowId, colKey) => {
      const current = state.getCellFormat(rowId, colKey)
      state.setCellFormat(rowId, colKey, { underline: !current?.underline })
    })
  },

  // ── Format Painter ──
  formatPainterSource: null,
  activateFormatPainter: () => {
    const { selectedCell, rows, getCellFormat } = get()
    if (!selectedCell) return
    const row = rows[selectedCell.rowIdx]
    if (!row) return
    const fmt = getCellFormat(row._id, selectedCell.colKey)
    set({ formatPainterSource: fmt ?? {} })
  },
  applyFormatPainter: (rowId, colKey) => {
    const { formatPainterSource, setCellFormat } = get()
    if (!formatPainterSource) return
    setCellFormat(rowId, colKey, formatPainterSource)
    set({ formatPainterSource: null })
  },
  cancelFormatPainter: () => set({ formatPainterSource: null }),

  // ── Cycle separators (by row ID, persisted via formatting.separatorBelow) ──
  separatorAfter: new Set<string>(),
  addSeparator: (rowId) =>
    set((state) => {
      const next = new Set(state.separatorAfter)
      next.add(rowId)
      return { separatorAfter: next }
    }),
  removeSeparator: (rowId) =>
    set((state) => {
      const next = new Set(state.separatorAfter)
      next.delete(rowId)
      return { separatorAfter: next }
    }),
  clearSeparators: () => set({ separatorAfter: new Set() }),
}))
