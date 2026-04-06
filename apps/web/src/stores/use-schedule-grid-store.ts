"use client";

import { create } from "zustand";
import type { ScheduledFlightRef } from "@skyhub/api";

export interface CellAddress {
  rowIdx: number;
  colKey: string;
}

interface ScheduleGridState {
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
}

export const useScheduleGridStore = create<ScheduleGridState>((set, get) => ({
  rows: [],
  setRows: (rows) => set({ rows }),

  dirtyMap: new Map(),
  markDirty: (id, changes) =>
    set((state) => {
      const next = new Map(state.dirtyMap);
      const existing = next.get(id) ?? {};
      next.set(id, { ...existing, ...changes });
      return { dirtyMap: next };
    }),
  clearDirty: () => set({ dirtyMap: new Map() }),
  getDirtyValue: (id, field) => {
    const dirty = get().dirtyMap.get(id);
    return dirty ? (dirty as Record<string, unknown>)[field] : undefined;
  },
  isDirty: () => get().dirtyMap.size > 0 || get().newRows.length > 0,

  selectedCell: null,
  selectCell: (cell) => set({ selectedCell: cell, editingCell: null, editValue: "" }),

  editingCell: null,
  editValue: "",
  startEditing: (cell, initialValue) => {
    const { rows, newRows } = get();
    const allRows = [...rows, ...newRows];
    const row = allRows[cell.rowIdx];
    if (!row) return;
    const currentVal = (row as Record<string, unknown>)[cell.colKey];
    set({
      selectedCell: cell,
      editingCell: cell,
      editValue: initialValue ?? (currentVal != null ? String(currentVal) : ""),
    });
  },
  setEditValue: (value) => set({ editValue: value }),
  commitEdit: () => {
    const { editingCell, editValue, rows, newRows, markDirty } = get();
    if (!editingCell) return;
    const allRows = [...rows, ...newRows];
    const row = allRows[editingCell.rowIdx];
    if (!row) { set({ editingCell: null, editValue: "" }); return; }
    const oldVal = (row as Record<string, unknown>)[editingCell.colKey];
    if (String(oldVal ?? "") !== editValue) {
      markDirty(row._id, { [editingCell.colKey]: editValue } as Partial<ScheduledFlightRef>);
    }
    set({ editingCell: null, editValue: "" });
  },
  cancelEdit: () => set({ editingCell: null, editValue: "" }),

  newRows: [],
  addNewRow: (row) => set((state) => ({ newRows: [...state.newRows, row] })),
  removeNewRow: (id) => set((state) => ({ newRows: state.newRows.filter((r) => r._id !== id) })),
  clearNewRows: () => set({ newRows: [] }),
}));
