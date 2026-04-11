import { create } from 'zustand'
import type { ScheduledFlightRef } from '@skyhub/api'
import type { CellAddress, CellFormat, ClipboardData, UndoSnapshot } from '../components/schedule/types'
import { MAX_UNDO_DEPTH } from '../components/schedule/types'
import { GRID_COLUMNS, EDITABLE_COLUMNS } from '../components/schedule/grid-columns'

interface ScheduleGridState {
  // ── Data ──
  rows: ScheduledFlightRef[]
  setRows: (rows: ScheduledFlightRef[]) => void

  // ── Dirty tracking ──
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>
  markDirty: (id: string, changes: Partial<ScheduledFlightRef>) => void
  getDirtyValue: (id: string, field: string) => unknown | undefined
  clearDirty: () => void
  isDirty: () => boolean

  // ── New rows & deletes ──
  newRowIds: Set<string>
  addNewRow: (row: ScheduledFlightRef) => void
  insertRowAt: (row: ScheduledFlightRef, atIdx: number) => void
  removeNewRow: (id: string) => void
  clearNewRows: () => void
  deletedIds: Set<string>
  markDeleted: (id: string) => void
  clearDeleted: () => void

  // ── Selection ──
  selectedCell: CellAddress | null
  selectCell: (cell: CellAddress | null) => void
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null
  setSelectionRange: (range: ScheduleGridState['selectionRange']) => void
  extendSelection: (dRow: number, dCol: number) => void
  selectEntireRow: () => void
  selectEntireColumn: () => void
  selectAll: () => void
  highlightedCol: number | null

  // ── Editing ──
  editingCell: CellAddress | null
  editValue: string
  startEditing: (cell: CellAddress, initialValue?: string) => void
  setEditValue: (value: string) => void
  commitEdit: () => void
  cancelEdit: () => void

  // ── Cell formatting ──
  cellFormats: Map<string, CellFormat>
  setCellFormat: (rowId: string, colKey: string, format: Partial<CellFormat>) => void
  getCellFormat: (rowId: string, colKey: string) => CellFormat | undefined
  clearCellFormats: () => void

  // ── Formatting toggles ──
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void

  // ── Format painter ──
  formatPainterSource: CellFormat | null
  activateFormatPainter: () => void
  cancelFormatPainter: () => void

  // ── Clipboard ──
  clipboard: ClipboardData | null
  copyCell: () => void
  cutCell: () => void
  pasteCell: () => void

  // ── Undo/Redo ──
  undoStack: UndoSnapshot[]
  redoStack: UndoSnapshot[]
  pushUndo: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // ── Separators ──
  separatorAfter: Set<string>
  addSeparator: (rowId: string) => void
  removeSeparator: (rowId: string) => void
  clearSeparators: () => void

  // ── Filter period ──
  filterDateFrom: string
  filterDateTo: string
  setFilterPeriod: (from: string, to: string) => void
}

export const useScheduleGridStore = create<ScheduleGridState>((set, get) => ({
  // ── Data ──
  rows: [],
  setRows: (rows) => set({ rows }),

  // ── Dirty tracking ──
  dirtyMap: new Map(),
  markDirty: (id, changes) => {
    const state = get()
    // Auto-push undo before applying
    state.pushUndo()
    const next = new Map(state.dirtyMap)
    const existing = next.get(id) ?? {}
    next.set(id, { ...existing, ...changes })
    set({ dirtyMap: next, redoStack: [] })
  },
  getDirtyValue: (id, field) => {
    const dirty = get().dirtyMap.get(id)
    return dirty ? (dirty as any)[field] : undefined
  },
  clearDirty: () => set({ dirtyMap: new Map(), undoStack: [], redoStack: [] }),
  isDirty: () => get().dirtyMap.size > 0 || get().newRowIds.size > 0 || get().deletedIds.size > 0,

  // ── New rows & deletes ──
  newRowIds: new Set(),
  addNewRow: (row) =>
    set((s) => ({
      rows: [...s.rows, row],
      newRowIds: new Set(s.newRowIds).add(row._id),
    })),
  insertRowAt: (row, atIdx) =>
    set((s) => {
      const next = [...s.rows]
      next.splice(atIdx, 0, row)
      return { rows: next, newRowIds: new Set(s.newRowIds).add(row._id) }
    }),
  removeNewRow: (id) =>
    set((s) => ({
      rows: s.rows.filter((r) => r._id !== id),
      newRowIds: (() => {
        const n = new Set(s.newRowIds)
        n.delete(id)
        return n
      })(),
    })),
  clearNewRows: () =>
    set((s) => ({
      rows: s.rows.filter((r) => !s.newRowIds.has(r._id)),
      newRowIds: new Set(),
    })),
  deletedIds: new Set(),
  markDeleted: (id) => set((s) => ({ deletedIds: new Set(s.deletedIds).add(id) })),
  clearDeleted: () => set({ deletedIds: new Set() }),

  // ── Selection ──
  selectedCell: null,
  selectCell: (cell) => set({ selectedCell: cell, editingCell: null, selectionRange: null }),
  selectionRange: null,
  setSelectionRange: (range) => set({ selectionRange: range }),
  extendSelection: (dRow, dCol) => {
    const { selectedCell, selectionRange, rows } = get()
    if (!selectedCell) return
    const maxRow = rows.length - 1
    const maxCol = GRID_COLUMNS.length - 1
    const anchor = selectionRange
      ? { startRow: selectionRange.startRow, startCol: selectionRange.startCol }
      : { startRow: selectedCell.rowIdx, startCol: GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey) }
    const endRow = Math.max(0, Math.min(maxRow, (selectionRange?.endRow ?? anchor.startRow) + dRow))
    const endCol = Math.max(0, Math.min(maxCol, (selectionRange?.endCol ?? anchor.startCol) + dCol))
    set({ selectionRange: { ...anchor, endRow, endCol } })
  },
  selectEntireRow: () => {
    const { selectedCell } = get()
    if (!selectedCell) return
    set({
      selectionRange: {
        startRow: selectedCell.rowIdx,
        startCol: 0,
        endRow: selectedCell.rowIdx,
        endCol: GRID_COLUMNS.length - 1,
      },
    })
  },
  selectEntireColumn: () => {
    const { selectedCell, rows } = get()
    if (!selectedCell) return
    const colIdx = GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey)
    set({
      selectionRange: { startRow: 0, startCol: colIdx, endRow: rows.length - 1, endCol: colIdx },
      highlightedCol: colIdx,
    })
  },
  selectAll: () => {
    const { rows } = get()
    set({
      selectedCell: { rowIdx: 0, colKey: GRID_COLUMNS[0].key },
      selectionRange: { startRow: 0, startCol: 0, endRow: rows.length - 1, endCol: GRID_COLUMNS.length - 1 },
    })
  },
  highlightedCol: null,

  // ── Editing ──
  editingCell: null,
  editValue: '',
  startEditing: (cell, initialValue) => {
    const { rows, dirtyMap } = get()
    const row = rows[cell.rowIdx]
    if (!row) return
    const dirty = dirtyMap.get(row._id)
    const val =
      initialValue ??
      (dirty && cell.colKey in dirty ? String((dirty as any)[cell.colKey]) : String((row as any)[cell.colKey] ?? ''))
    set({ editingCell: cell, editValue: val, selectedCell: cell })
  },
  setEditValue: (value) => set({ editValue: value }),
  commitEdit: () => {
    const { editingCell, editValue, rows } = get()
    if (!editingCell) return
    const row = rows[editingCell.rowIdx]
    if (!row) {
      set({ editingCell: null, editValue: '' })
      return
    }
    const currentVal = String((row as any)[editingCell.colKey] ?? '')
    if (editValue !== currentVal) {
      get().markDirty(row._id, { [editingCell.colKey]: editValue } as any)
    }
    set({ editingCell: null, editValue: '' })
  },
  cancelEdit: () => set({ editingCell: null, editValue: '' }),

  // ── Cell formatting ──
  cellFormats: new Map(),
  setCellFormat: (rowId, colKey, format) =>
    set((s) => {
      const next = new Map(s.cellFormats)
      const key = `${rowId}:${colKey}`
      const existing = next.get(key) ?? {}
      next.set(key, { ...existing, ...format })
      return { cellFormats: next }
    }),
  getCellFormat: (rowId, colKey) => get().cellFormats.get(`${rowId}:${colKey}`),
  clearCellFormats: () => set({ cellFormats: new Map() }),

  // ── Formatting toggles ──
  toggleBold: () => {
    const { selectedCell, rows, cellFormats } = get()
    if (!selectedCell) return
    const row = rows[selectedCell.rowIdx]
    if (!row) return
    const key = `${row._id}:${selectedCell.colKey}`
    const current = cellFormats.get(key)
    get().setCellFormat(row._id, selectedCell.colKey, { bold: !current?.bold })
  },
  toggleItalic: () => {
    const { selectedCell, rows, cellFormats } = get()
    if (!selectedCell) return
    const row = rows[selectedCell.rowIdx]
    if (!row) return
    const key = `${row._id}:${selectedCell.colKey}`
    const current = cellFormats.get(key)
    get().setCellFormat(row._id, selectedCell.colKey, { italic: !current?.italic })
  },
  toggleUnderline: () => {
    const { selectedCell, rows, cellFormats } = get()
    if (!selectedCell) return
    const row = rows[selectedCell.rowIdx]
    if (!row) return
    const key = `${row._id}:${selectedCell.colKey}`
    const current = cellFormats.get(key)
    get().setCellFormat(row._id, selectedCell.colKey, { underline: !current?.underline })
  },

  // ── Format painter ──
  formatPainterSource: null,
  activateFormatPainter: () => {
    const { selectedCell, rows, cellFormats } = get()
    if (!selectedCell) return
    const row = rows[selectedCell.rowIdx]
    if (!row) return
    const fmt = cellFormats.get(`${row._id}:${selectedCell.colKey}`)
    set({ formatPainterSource: fmt ?? {} })
  },
  cancelFormatPainter: () => set({ formatPainterSource: null }),

  // ── Clipboard ──
  clipboard: null,
  copyCell: () => {
    const { selectedCell, rows, dirtyMap } = get()
    if (!selectedCell) return
    const row = rows[selectedCell.rowIdx]
    if (!row) return
    const dirty = dirtyMap.get(row._id)
    const val =
      dirty && selectedCell.colKey in dirty
        ? String((dirty as any)[selectedCell.colKey])
        : String((row as any)[selectedCell.colKey] ?? '')
    set({
      clipboard: {
        cells: [{ colKey: selectedCell.colKey, value: val }],
        rowId: row._id,
        rowIds: [row._id],
        colKeys: [selectedCell.colKey],
        mode: 'copy',
      },
    })
  },
  cutCell: () => {
    get().copyCell()
    set((s) => (s.clipboard ? { clipboard: { ...s.clipboard, mode: 'cut' } } : {}))
    // Clear source cell
    const { selectedCell, rows } = get()
    if (!selectedCell) return
    const row = rows[selectedCell.rowIdx]
    if (row) get().markDirty(row._id, { [selectedCell.colKey]: '' } as any)
  },
  pasteCell: () => {
    const { clipboard, selectedCell, rows } = get()
    if (!clipboard || !selectedCell) return
    const row = rows[selectedCell.rowIdx]
    if (!row) return
    for (const cell of clipboard.cells) {
      get().markDirty(row._id, { [cell.colKey]: cell.value } as any)
    }
    if (clipboard.mode === 'cut') set({ clipboard: null })
  },

  // ── Undo/Redo ──
  undoStack: [],
  redoStack: [],
  pushUndo: () =>
    set((s) => {
      const snapshot: UndoSnapshot = { dirtyMap: new Map(s.dirtyMap) }
      const stack = [...s.undoStack, snapshot]
      if (stack.length > MAX_UNDO_DEPTH) stack.shift()
      return { undoStack: stack }
    }),
  undo: () => {
    const { undoStack, dirtyMap } = get()
    if (undoStack.length === 0) return
    const snapshot = undoStack[undoStack.length - 1]
    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, { dirtyMap: new Map(s.dirtyMap) }],
      dirtyMap: snapshot.dirtyMap as Map<string, Partial<ScheduledFlightRef>>,
    }))
  },
  redo: () => {
    const { redoStack } = get()
    if (redoStack.length === 0) return
    const snapshot = redoStack[redoStack.length - 1]
    set((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, { dirtyMap: new Map(s.dirtyMap) }],
      dirtyMap: snapshot.dirtyMap as Map<string, Partial<ScheduledFlightRef>>,
    }))
  },
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ── Separators ──
  separatorAfter: new Set(),
  addSeparator: (rowId) => set((s) => ({ separatorAfter: new Set(s.separatorAfter).add(rowId) })),
  removeSeparator: (rowId) =>
    set((s) => {
      const n = new Set(s.separatorAfter)
      n.delete(rowId)
      return { separatorAfter: n }
    }),
  clearSeparators: () => set({ separatorAfter: new Set() }),

  // ── Filter period ──
  filterDateFrom: '',
  filterDateTo: '',
  setFilterPeriod: (from, to) => set({ filterDateFrom: from, filterDateTo: to }),
}))
