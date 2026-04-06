"use client";

import { create } from "zustand";
import type { ScheduledFlightRef } from "@skyhub/api";
import type { CellFormat, ClipboardData } from "@/components/network/schedule-grid/types";
import { MAX_UNDO_DEPTH } from "@/components/network/schedule-grid/types";
import { GRID_COLUMNS } from "@/components/network/schedule-grid/grid-columns";
import { parseDate, formatDate } from "@/lib/date-format";
import { useOperatorStore } from "./use-operator-store";

export interface CellAddress {
  rowIdx: number;
  colKey: string;
}

/** Snapshot for undo/redo: captures full dirtyMap state */
interface UndoSnapshot {
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>;
}

interface ScheduleGridState {
  // Filter period (from left panel)
  filterDateFrom: string;
  filterDateTo: string;
  setFilterPeriod: (from: string, to: string) => void;

  // Data
  rows: ScheduledFlightRef[];
  setRows: (rows: ScheduledFlightRef[]) => void;

  // Dirty tracking
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>;
  markDirty: (id: string, changes: Partial<ScheduledFlightRef>) => void;
  clearDirty: () => void;
  getDirtyValue: (id: string, field: string) => unknown | undefined;
  isDirty: () => boolean;

  // Selection
  selectedCell: CellAddress | null;
  selectCell: (cell: CellAddress | null) => void;

  // Range selection (Shift+Arrow, Shift+Space, Ctrl+Space, drag)
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  setSelectionRange: (range: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void;
  extendSelection: (dRow: number, dCol: number) => void;
  selectEntireRow: () => void;
  selectEntireColumn: () => void;
  selectAll: () => void;
  highlightedCol: number | null;

  // Editing
  editingCell: CellAddress | null;
  editValue: string;
  startEditing: (cell: CellAddress, initialValue?: string) => void;
  setEditValue: (value: string) => void;
  commitEdit: () => void;
  cancelEdit: () => void;

  // New rows pending creation
  newRows: ScheduledFlightRef[];
  addNewRow: (row: ScheduledFlightRef) => void;
  removeNewRow: (id: string) => void;
  clearNewRows: () => void;

  // Cell formatting
  cellFormats: Map<string, CellFormat>;
  setCellFormat: (rowId: string, colKey: string, format: Partial<CellFormat>) => void;
  getCellFormat: (rowId: string, colKey: string) => CellFormat | undefined;
  clearCellFormats: () => void;

  // ── Undo/Redo ──
  undoStack: UndoSnapshot[];
  redoStack: UndoSnapshot[];
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── Clipboard ──
  clipboard: ClipboardData | null;
  copyCell: () => void;
  cutCell: () => void;
  pasteCell: () => Promise<void>;

  // ── Formatting toggles ──
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;

  // ── Cycle separators (blank rows between rotations) ──
  separatorAfter: Set<number>;  // Set of rowIdx values that have a separator below them
  addSeparator: (afterRowIdx: number) => void;
  removeSeparator: (afterRowIdx: number) => void;
  clearSeparators: () => void;
}

/** Clone a dirtyMap for snapshot */
function cloneDirtyMap(m: Map<string, Partial<ScheduledFlightRef>>): Map<string, Partial<ScheduledFlightRef>> {
  const next = new Map<string, Partial<ScheduledFlightRef>>();
  for (const [k, v] of m) next.set(k, { ...v });
  return next;
}

export const useScheduleGridStore = create<ScheduleGridState>((set, get) => ({
  filterDateFrom: "",
  filterDateTo: "",
  setFilterPeriod: (from, to) => set({ filterDateFrom: from, filterDateTo: to }),
  rows: [],
  setRows: (rows) => set({ rows }),

  dirtyMap: new Map(),
  markDirty: (id, changes) => {
    const state = get();
    // Push undo snapshot BEFORE applying the change
    const undoStack = [...state.undoStack, { dirtyMap: cloneDirtyMap(state.dirtyMap) }];
    if (undoStack.length > MAX_UNDO_DEPTH) undoStack.shift();

    const next = new Map(state.dirtyMap);
    const existing = next.get(id) ?? {};
    next.set(id, { ...existing, ...changes });
    set({ dirtyMap: next, undoStack, redoStack: [] });
  },
  clearDirty: () => set({ dirtyMap: new Map(), undoStack: [], redoStack: [] }),
  getDirtyValue: (id, field) => {
    const dirty = get().dirtyMap.get(id);
    return dirty ? (dirty as any)[field] : undefined;
  },
  isDirty: () => get().dirtyMap.size > 0 || get().newRows.length > 0,

  selectedCell: null,
  selectCell: (cell) => set({ selectedCell: cell, selectionRange: null, highlightedCol: null, editingCell: null, editValue: "" }),

  // ── Range selection ──
  selectionRange: null,
  highlightedCol: null,
  setSelectionRange: (range) => set({ selectionRange: range }),

  extendSelection: (dRow, dCol) => {
    const { selectedCell, selectionRange, rows, newRows } = get();
    if (!selectedCell) return;
    const totalRows = rows.length + newRows.length;
    const totalCols = GRID_COLUMNS.length;
    const anchorRow = selectedCell.rowIdx;
    const anchorCol = GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey);
    const current = selectionRange
      ? { row: selectionRange.endRow, col: selectionRange.endCol }
      : { row: anchorRow, col: anchorCol };
    const newRow = Math.max(0, Math.min(totalRows - 1, current.row + dRow));
    const newCol = Math.max(0, Math.min(totalCols - 1, current.col + dCol));
    set({
      selectionRange: { startRow: anchorRow, startCol: anchorCol, endRow: newRow, endCol: newCol },
    });
  },

  selectEntireRow: () => {
    const { selectedCell, selectionRange, rows, newRows } = get();
    if (!selectedCell) return;
    const totalCols = GRID_COLUMNS.length;
    const startRow = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : selectedCell.rowIdx;
    const endRow = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : selectedCell.rowIdx;
    set({
      selectionRange: { startRow, startCol: 0, endRow, endCol: totalCols - 1 },
    });
  },

  selectEntireColumn: () => {
    const { selectedCell, rows, newRows } = get();
    if (!selectedCell) return;
    const colIdx = GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey);
    const totalRows = rows.length + newRows.length;
    set({
      selectionRange: { startRow: 0, startCol: colIdx, endRow: totalRows - 1, endCol: colIdx },
      highlightedCol: colIdx,
    });
  },

  selectAll: () => {
    const { rows, newRows } = get();
    const totalRows = rows.length + newRows.length;
    if (totalRows === 0) return;
    set({
      selectedCell: { rowIdx: 0, colKey: GRID_COLUMNS[0].key },
      selectionRange: { startRow: 0, startCol: 0, endRow: totalRows - 1, endCol: GRID_COLUMNS.length - 1 },
    });
  },

  editingCell: null,
  editValue: "",
  startEditing: (cell, initialValue) => {
    const { rows, newRows, getDirtyValue } = get();
    const allRows = [...rows, ...newRows];
    const row = allRows[cell.rowIdx];
    if (!row) return;

    // Use dirty value if it exists, otherwise the row's raw value
    const dirtyVal = getDirtyValue(row._id, cell.colKey);
    const rawVal = dirtyVal !== undefined ? String(dirtyVal) : ((row as any)[cell.colKey] != null ? String((row as any)[cell.colKey]) : "");

    // For date columns, show the formatted date in the edit input (not raw ISO)
    let displayVal = rawVal;
    const isDateCol = cell.colKey === "effectiveFrom" || cell.colKey === "effectiveUntil";
    if (isDateCol && rawVal && !initialValue) {
      const opDateFormat = useOperatorStore.getState().dateFormat;
      displayVal = formatDate(rawVal, opDateFormat);
    }

    set({
      selectedCell: cell,
      editingCell: cell,
      editValue: initialValue ?? displayVal,
    });
  },
  setEditValue: (value) => set({ editValue: value }),
  commitEdit: () => {
    const { editingCell, editValue, rows, newRows, markDirty } = get();
    if (!editingCell) return;
    const allRows = [...rows, ...newRows];
    const row = allRows[editingCell.rowIdx];
    if (!row) { set({ editingCell: null, editValue: "" }); return; }

    // For date columns, parse user input to ISO before storing
    const isDateCol = editingCell.colKey === "effectiveFrom" || editingCell.colKey === "effectiveUntil";
    let finalValue = editValue;
    if (isDateCol && editValue) {
      const opDateFormat = useOperatorStore.getState().dateFormat;
      finalValue = parseDate(editValue, opDateFormat);
    }

    const oldVal = (row as any)[editingCell.colKey];
    const changed = String(oldVal ?? "") !== finalValue;

    // For suggested date cells (draft rows with pre-filled FROM/TO from filter panel),
    // mark dirty even if the value didn't change — this "accepts" the suggestion
    // and removes the italic styling, confirming the user acknowledged the value.
    const isSuggestedAccept = isDateCol && !changed && finalValue && row.status === "draft";

    if (changed || isSuggestedAccept) {
      markDirty(row._id, { [editingCell.colKey]: finalValue } as Partial<ScheduledFlightRef>);
    }
    set({ editingCell: null, editValue: "" });
  },
  cancelEdit: () => set({ editingCell: null, editValue: "" }),

  newRows: [],
  addNewRow: (row) => set((state) => ({ newRows: [...state.newRows, row] })),
  removeNewRow: (id) => set((state) => ({ newRows: state.newRows.filter((r) => r._id !== id) })),
  clearNewRows: () => set({ newRows: [] }),

  cellFormats: new Map(),
  setCellFormat: (rowId, colKey, format) =>
    set((state) => {
      const next = new Map(state.cellFormats);
      const key = `${rowId}:${colKey}`;
      const existing = next.get(key) ?? {};
      next.set(key, { ...existing, ...format });
      return { cellFormats: next };
    }),
  getCellFormat: (rowId, colKey) => get().cellFormats.get(`${rowId}:${colKey}`),
  clearCellFormats: () => set({ cellFormats: new Map() }),

  // ── Undo/Redo ──
  undoStack: [],
  redoStack: [],
  pushUndo: () => {
    const { dirtyMap, undoStack } = get();
    const next = [...undoStack, { dirtyMap: cloneDirtyMap(dirtyMap) }];
    if (next.length > MAX_UNDO_DEPTH) next.shift();
    set({ undoStack: next, redoStack: [] });
  },
  undo: () => {
    const { undoStack, redoStack, dirtyMap } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { dirtyMap: cloneDirtyMap(dirtyMap) }],
      dirtyMap: cloneDirtyMap(prev.dirtyMap),
    });
  },
  redo: () => {
    const { undoStack, redoStack, dirtyMap } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { dirtyMap: cloneDirtyMap(dirtyMap) }],
      dirtyMap: cloneDirtyMap(next.dirtyMap),
    });
  },
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ── Clipboard ──
  clipboard: null,

  copyCell: () => {
    const { selectedCell, rows, newRows, getDirtyValue } = get();
    if (!selectedCell) return;
    const allRows = [...rows, ...newRows];
    const row = allRows[selectedCell.rowIdx];
    if (!row) return;
    const col = GRID_COLUMNS.find((c) => c.key === selectedCell.colKey);
    if (!col) return;
    // Get the current display value (dirty or original)
    const dirty = getDirtyValue(row._id, selectedCell.colKey);
    const value = dirty !== undefined ? String(dirty) : ((row as any)[selectedCell.colKey] ?? "");
    const strValue = value != null ? String(value) : "";
    // Write to system clipboard
    navigator.clipboard.writeText(strValue).catch(() => {});
    // Store in internal clipboard
    set({
      clipboard: {
        cells: [{ colKey: selectedCell.colKey, value: strValue }],
        rowId: row._id,
        mode: "copy",
      },
    });
  },

  cutCell: () => {
    const { selectedCell, rows, newRows, getDirtyValue, markDirty } = get();
    if (!selectedCell) return;
    const allRows = [...rows, ...newRows];
    const row = allRows[selectedCell.rowIdx];
    if (!row) return;
    const col = GRID_COLUMNS.find((c) => c.key === selectedCell.colKey);
    if (!col || !col.editable) return;
    const dirty = getDirtyValue(row._id, selectedCell.colKey);
    const value = dirty !== undefined ? String(dirty) : ((row as any)[selectedCell.colKey] ?? "");
    const strValue = value != null ? String(value) : "";
    navigator.clipboard.writeText(strValue).catch(() => {});
    set({
      clipboard: {
        cells: [{ colKey: selectedCell.colKey, value: strValue }],
        rowId: row._id,
        mode: "cut",
      },
    });
    // Clear the source cell
    markDirty(row._id, { [selectedCell.colKey]: "" } as Partial<ScheduledFlightRef>);
  },

  pasteCell: async () => {
    const { selectedCell, rows, newRows, markDirty } = get();
    if (!selectedCell) return;
    const allRows = [...rows, ...newRows];
    const row = allRows[selectedCell.rowIdx];
    if (!row) return;
    const col = GRID_COLUMNS.find((c) => c.key === selectedCell.colKey);
    if (!col || !col.editable) return;
    try {
      const text = await navigator.clipboard.readText();
      const value = text.trim() || "";
      markDirty(row._id, { [selectedCell.colKey]: value } as Partial<ScheduledFlightRef>);
    } catch {
      // Clipboard access denied — try internal clipboard
      const { clipboard } = get();
      if (clipboard && clipboard.cells.length > 0) {
        const value = clipboard.cells[0].value;
        markDirty(row._id, { [selectedCell.colKey]: value } as Partial<ScheduledFlightRef>);
      }
    }
  },

  // ── Formatting toggles ──
  toggleBold: () => {
    const { selectedCell, rows, newRows, getCellFormat, setCellFormat } = get();
    if (!selectedCell) return;
    const allRows = [...rows, ...newRows];
    const row = allRows[selectedCell.rowIdx];
    if (!row) return;
    const current = getCellFormat(row._id, selectedCell.colKey);
    setCellFormat(row._id, selectedCell.colKey, { bold: !current?.bold });
  },
  toggleItalic: () => {
    const { selectedCell, rows, newRows, getCellFormat, setCellFormat } = get();
    if (!selectedCell) return;
    const allRows = [...rows, ...newRows];
    const row = allRows[selectedCell.rowIdx];
    if (!row) return;
    const current = getCellFormat(row._id, selectedCell.colKey);
    setCellFormat(row._id, selectedCell.colKey, { italic: !current?.italic });
  },
  toggleUnderline: () => {
    const { selectedCell, rows, newRows, getCellFormat, setCellFormat } = get();
    if (!selectedCell) return;
    const allRows = [...rows, ...newRows];
    const row = allRows[selectedCell.rowIdx];
    if (!row) return;
    const current = getCellFormat(row._id, selectedCell.colKey);
    setCellFormat(row._id, selectedCell.colKey, { underline: !current?.underline });
  },

  // ── Cycle separators ──
  separatorAfter: new Set<number>(),
  addSeparator: (afterRowIdx) =>
    set((state) => {
      const next = new Set(state.separatorAfter);
      next.add(afterRowIdx);
      return { separatorAfter: next };
    }),
  removeSeparator: (afterRowIdx) =>
    set((state) => {
      const next = new Set(state.separatorAfter);
      next.delete(afterRowIdx);
      return { separatorAfter: next };
    }),
  clearSeparators: () => set({ separatorAfter: new Set() }),
}));
