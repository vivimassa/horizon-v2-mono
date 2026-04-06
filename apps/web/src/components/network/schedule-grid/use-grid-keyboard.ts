// Network Scheduling XL — Global Keyboard Shortcuts
// Matches Excel behavior: Ctrl+C/V/X/Z/Y/S/N/B/I/U/F/H, Tab, Enter, Arrow keys, F2, F12, Delete

import { useCallback } from "react";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { GRID_COLUMNS } from "./grid-columns";

interface UseGridKeyboardOptions {
  onSave: () => void;
  onAddFlight: () => void;
  onDeleteFlight: (rowIdx: number) => void;
}

export function useGridKeyboard({ onSave, onAddFlight, onDeleteFlight }: UseGridKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      const state = useScheduleGridStore.getState();
      const { selectedCell, editingCell } = state;

      // Don't intercept if editing — let input handle most keys
      if (editingCell) {
        // Only intercept Ctrl shortcuts while editing
        if (e.ctrlKey || e.metaKey) {
          if (e.key === "s") {
            e.preventDefault();
            onSave();
            return;
          }
          if (e.key === "z") {
            e.preventDefault();
            // TODO: undo
            return;
          }
          if (e.key === "y" || (e.shiftKey && e.key === "Z")) {
            e.preventDefault();
            // TODO: redo
            return;
          }
        }
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      // ── Ctrl shortcuts (no cell required) ──
      if (ctrl) {
        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            onSave();
            return;
          case "n":
            e.preventDefault();
            onAddFlight();
            return;
          case "z":
            e.preventDefault();
            // TODO: undo
            return;
          case "y":
            e.preventDefault();
            // TODO: redo
            return;
          case "a":
            e.preventDefault();
            // TODO: select all
            return;
          case "f":
            e.preventDefault();
            // TODO: find
            return;
          case "h":
            e.preventDefault();
            // TODO: find & replace
            return;
          case "b":
            e.preventDefault();
            // TODO: toggle bold
            return;
          case "i":
            e.preventDefault();
            // TODO: toggle italic
            return;
          case "u":
            e.preventDefault();
            // TODO: toggle underline
            return;
        }
      }

      if (!selectedCell) return;

      // ── Ctrl+Delete — delete selected flight ──
      if (ctrl && e.key === "Delete") {
        e.preventDefault();
        onDeleteFlight(selectedCell.rowIdx);
        return;
      }

      // ── Ctrl+C — copy ──
      if (ctrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        // TODO: copy cell/row
        return;
      }

      // ── Ctrl+X — cut ──
      if (ctrl && e.key.toLowerCase() === "x") {
        e.preventDefault();
        // TODO: cut
        return;
      }

      // ── Ctrl+V — paste ──
      if (ctrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        // TODO: paste
        return;
      }

      // ── F12 — save as ──
      if (e.key === "F12") {
        e.preventDefault();
        // TODO: save as scenario
        return;
      }

      const { rowIdx, colKey } = selectedCell;
      const allRows = [...state.rows, ...state.newRows];
      const colIdx = GRID_COLUMNS.findIndex((c) => c.key === colKey);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (rowIdx < allRows.length - 1) state.selectCell({ rowIdx: rowIdx + 1, colKey });
          break;
        case "ArrowUp":
          e.preventDefault();
          if (rowIdx > 0) state.selectCell({ rowIdx: rowIdx - 1, colKey });
          break;
        case "ArrowRight":
          e.preventDefault();
          if (colIdx < GRID_COLUMNS.length - 1) state.selectCell({ rowIdx, colKey: GRID_COLUMNS[colIdx + 1].key });
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (colIdx > 0) state.selectCell({ rowIdx, colKey: GRID_COLUMNS[colIdx - 1].key });
          break;
        case "Enter":
        case "F2": {
          e.preventDefault();
          const col = GRID_COLUMNS[colIdx];
          if (col?.editable) state.startEditing({ rowIdx, colKey });
          break;
        }
        case "Tab": {
          e.preventDefault();
          const editableCols = GRID_COLUMNS.filter((c) => c.editable);
          const curIdx = editableCols.findIndex((c) => c.key === colKey);
          if (e.shiftKey) {
            if (curIdx > 0) state.selectCell({ rowIdx, colKey: editableCols[curIdx - 1].key });
            else if (rowIdx > 0) state.selectCell({ rowIdx: rowIdx - 1, colKey: editableCols[editableCols.length - 1].key });
          } else {
            if (curIdx < editableCols.length - 1) state.selectCell({ rowIdx, colKey: editableCols[curIdx + 1].key });
            else if (rowIdx < allRows.length - 1) state.selectCell({ rowIdx: rowIdx + 1, colKey: editableCols[0].key });
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          state.selectCell(null);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          if (GRID_COLUMNS[colIdx]?.editable) {
            state.startEditing({ rowIdx, colKey }, "");
          }
          break;
        case "Home":
          e.preventDefault();
          if (ctrl) state.selectCell({ rowIdx: 0, colKey: GRID_COLUMNS[0].key });
          else state.selectCell({ rowIdx, colKey: GRID_COLUMNS[0].key });
          break;
        case "End":
          e.preventDefault();
          if (ctrl) state.selectCell({ rowIdx: allRows.length - 1, colKey: GRID_COLUMNS[GRID_COLUMNS.length - 1].key });
          else state.selectCell({ rowIdx, colKey: GRID_COLUMNS[GRID_COLUMNS.length - 1].key });
          break;
        default:
          // Typing a character starts editing
          if (e.key.length === 1 && !ctrl && !e.altKey) {
            const col = GRID_COLUMNS[colIdx];
            if (col?.editable) {
              e.preventDefault();
              state.startEditing({ rowIdx, colKey }, e.key);
            }
          }
          break;
      }
    },
    [onSave, onAddFlight, onDeleteFlight]
  );

  return handleKeyDown;
}
