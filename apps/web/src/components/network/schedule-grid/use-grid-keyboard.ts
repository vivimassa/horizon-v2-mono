// Network Scheduling XL — Global Keyboard Shortcuts
// Uses window capture-phase listener (like V1) to intercept Chrome shortcuts.
// Matches Excel behavior: Ctrl+C/V/X/Z/Y/S/B/I/U/F/H, Tab, Enter, Arrow keys, F2, F12, Delete

import { useEffect, useRef } from "react";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { GRID_COLUMNS } from "./grid-columns";

interface UseGridKeyboardOptions {
  onSave: () => void;
  onAddFlight: () => void;
  onDeleteFlight: (rowIdx: number) => void;
  onOpenFind?: () => void;
  onOpenReplace?: () => void;
}

export function useGridKeyboard({
  onSave,
  onAddFlight,
  onDeleteFlight,
  onOpenFind,
  onOpenReplace,
}: UseGridKeyboardOptions) {
  // Use refs to avoid stale closures in the capture-phase listener
  const callbackRefs = useRef({
    onSave,
    onAddFlight,
    onDeleteFlight,
    onOpenFind,
    onOpenReplace,
  });

  // Keep refs in sync
  useEffect(() => {
    callbackRefs.current = { onSave, onAddFlight, onDeleteFlight, onOpenFind, onOpenReplace };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const el = document.activeElement;
      const isTyping =
        el?.tagName === "INPUT" ||
        el?.tagName === "SELECT" ||
        el?.tagName === "TEXTAREA";

      const state = useScheduleGridStore.getState();
      const { selectedCell, editingCell } = state;

      // ── While typing in an input: intercept navigation + global shortcuts ──
      if (isTyping) {
        // Tab: commit edit and move to next/prev editable cell
        if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          state.commitEdit();
          const sc = state.selectedCell;
          if (sc) {
            const editableCols = GRID_COLUMNS.filter((c) => c.editable);
            const curIdx = editableCols.findIndex((c) => c.key === sc.colKey);
            const allRows = [...state.rows, ...state.newRows];
            if (e.shiftKey) {
              if (curIdx > 0) state.startEditing({ rowIdx: sc.rowIdx, colKey: editableCols[curIdx - 1].key });
              else if (sc.rowIdx > 0) state.startEditing({ rowIdx: sc.rowIdx - 1, colKey: editableCols[editableCols.length - 1].key });
            } else {
              if (curIdx < editableCols.length - 1) state.startEditing({ rowIdx: sc.rowIdx, colKey: editableCols[curIdx + 1].key });
              else if (sc.rowIdx < allRows.length - 1) state.startEditing({ rowIdx: sc.rowIdx + 1, colKey: editableCols[0].key });
            }
          }
          return;
        }
        // Enter: commit edit and move down one row
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          state.commitEdit();
          const sc = state.selectedCell;
          if (sc) {
            const allRows = [...state.rows, ...state.newRows];
            if (sc.rowIdx < allRows.length - 1) state.selectCell({ rowIdx: sc.rowIdx + 1, colKey: sc.colKey });
            else state.selectCell(sc);
          }
          return;
        }
        // Escape: cancel edit
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          state.cancelEdit();
          return;
        }
        if (mod && e.key === "s") {
          e.preventDefault();
          e.stopPropagation();
          callbackRefs.current.onSave();
          return;
        }
        if (mod && e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          state.undo();
          return;
        }
        if (mod && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
          e.preventDefault();
          state.redo();
          return;
        }
        // Let the input handle all other keys
        return;
      }

      // ── Global Ctrl shortcuts (no cell required) ──
      if (mod) {
        const key = e.key.toLowerCase();

        // Save
        if (key === "s") {
          e.preventDefault();
          e.stopPropagation();
          callbackRefs.current.onSave();
          return;
        }

        // Undo
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          state.undo();
          return;
        }

        // Redo (Ctrl+Y or Ctrl+Shift+Z)
        if (key === "y" || (key === "z" && e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          state.redo();
          return;
        }

        // Find
        if (key === "f") {
          e.preventDefault();
          e.stopPropagation();
          callbackRefs.current.onOpenFind?.();
          return;
        }

        // Find & Replace
        if (key === "h") {
          e.preventDefault();
          e.stopPropagation();
          callbackRefs.current.onOpenReplace?.();
          return;
        }

        // Bold
        if (key === "b") {
          e.preventDefault();
          e.stopPropagation();
          state.toggleBold();
          return;
        }

        // Italic
        if (key === "i") {
          e.preventDefault();
          e.stopPropagation();
          state.toggleItalic();
          return;
        }

        // Underline
        if (key === "u") {
          e.preventDefault();
          e.stopPropagation();
          state.toggleUnderline();
          return;
        }

        // Select all (Ctrl+A)
        if (key === "a") {
          e.preventDefault();
          e.stopPropagation();
          state.selectAll();
          return;
        }

        // Add Flight (Ctrl+N) — intercepts Chrome "new tab"
        if (key === "n") {
          e.preventDefault();
          e.stopPropagation();
          callbackRefs.current.onAddFlight();
          return;
        }

        // Fill Down (Ctrl+D) — copies cell above into current cell (Excel behavior)
        if (key === "d") {
          e.preventDefault();
          e.stopPropagation();
          if (selectedCell && selectedCell.rowIdx > 0) {
            const allRows = [...state.rows, ...state.newRows];
            const aboveRow = allRows[selectedCell.rowIdx - 1];
            const currentRow = allRows[selectedCell.rowIdx];
            const col = GRID_COLUMNS.find((c) => c.key === selectedCell.colKey);
            if (aboveRow && currentRow && col?.editable) {
              const dirtyAbove = state.getDirtyValue(aboveRow._id, selectedCell.colKey);
              const valueAbove = dirtyAbove !== undefined ? String(dirtyAbove) : ((aboveRow as any)[selectedCell.colKey] ?? "");
              state.markDirty(currentRow._id, { [selectedCell.colKey]: String(valueAbove ?? "") } as any);
            }
          }
          return;
        }
      }

      // ── Shortcuts requiring a selected cell ──
      if (!selectedCell) return;

      // Ctrl+Delete — delete selected flight
      if (mod && e.key === "Delete") {
        e.preventDefault();
        callbackRefs.current.onDeleteFlight(selectedCell.rowIdx);
        return;
      }

      // Ctrl+C — copy cell
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        e.stopPropagation();
        state.copyCell();
        return;
      }

      // Ctrl+X — cut cell
      if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        e.stopPropagation();
        state.cutCell();
        return;
      }

      // Ctrl+V — paste
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        e.stopPropagation();
        state.pasteCell();
        return;
      }

      // Insert — add flight
      if (e.key === "Insert") {
        e.preventDefault();
        callbackRefs.current.onAddFlight();
        return;
      }

      // F12 — save as scenario
      if (e.key === "F12") {
        e.preventDefault();
        // TODO: save as scenario
        return;
      }

      // ── Shift+Space: select entire row ──
      if (!mod && e.shiftKey && e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        state.selectEntireRow();
        return;
      }

      // ── Ctrl+Space: select entire column ──
      if (mod && !e.shiftKey && e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        state.selectEntireColumn();
        return;
      }

      // ── Navigation & editing keys ──
      const { rowIdx, colKey } = selectedCell;
      const allRows = [...state.rows, ...state.newRows];
      const colIdx = GRID_COLUMNS.findIndex((c) => c.key === colKey);
      const { selectionRange } = state;

      // Shift+Arrow: extend selection range (like Excel)
      if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();

        // If full row is selected and pressing Shift+Up/Down, extend row selection
        if (selectionRange && selectionRange.startCol === 0 && selectionRange.endCol >= GRID_COLUMNS.length - 1
            && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          const dr = e.key === "ArrowDown" ? 1 : -1;
          const newEnd = Math.max(0, Math.min(allRows.length - 1, selectionRange.endRow + dr));
          state.setSelectionRange({ ...selectionRange, endRow: newEnd });
          return;
        }

        const dRow = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        const dCol = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
        state.extendSelection(dRow, dCol);
        return;
      }

      switch (e.key) {
        // Arrow keys: navigate (clears range)
        case "ArrowDown":
          e.preventDefault();
          if (mod) {
            // Ctrl+Down: jump to last row (Excel behavior)
            state.selectCell({ rowIdx: allRows.length - 1, colKey });
          } else if (rowIdx < allRows.length - 1) {
            state.selectCell({ rowIdx: rowIdx + 1, colKey });
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (mod) {
            state.selectCell({ rowIdx: 0, colKey });
          } else if (rowIdx > 0) {
            state.selectCell({ rowIdx: rowIdx - 1, colKey });
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (mod) {
            state.selectCell({ rowIdx, colKey: GRID_COLUMNS[GRID_COLUMNS.length - 1].key });
          } else if (colIdx < GRID_COLUMNS.length - 1) {
            state.selectCell({ rowIdx, colKey: GRID_COLUMNS[colIdx + 1].key });
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (mod) {
            state.selectCell({ rowIdx, colKey: GRID_COLUMNS[0].key });
          } else if (colIdx > 0) {
            state.selectCell({ rowIdx, colKey: GRID_COLUMNS[colIdx - 1].key });
          }
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
            if (curIdx > 0) state.startEditing({ rowIdx, colKey: editableCols[curIdx - 1].key });
            else if (rowIdx > 0) state.startEditing({ rowIdx: rowIdx - 1, colKey: editableCols[editableCols.length - 1].key });
          } else {
            if (curIdx < editableCols.length - 1) state.startEditing({ rowIdx, colKey: editableCols[curIdx + 1].key });
            else if (rowIdx < allRows.length - 1) state.startEditing({ rowIdx: rowIdx + 1, colKey: editableCols[0].key });
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          state.selectCell(null);
          break;
        case "Delete":
        case "Backspace": {
          e.preventDefault();
          // If range is selected, clear all cells in range
          if (selectionRange) {
            const r = {
              r1: Math.min(selectionRange.startRow, selectionRange.endRow),
              r2: Math.max(selectionRange.startRow, selectionRange.endRow),
              c1: Math.min(selectionRange.startCol, selectionRange.endCol),
              c2: Math.max(selectionRange.startCol, selectionRange.endCol),
            };
            for (let ri = r.r1; ri <= r.r2; ri++) {
              const row = allRows[ri];
              if (!row) continue;
              for (let ci = r.c1; ci <= r.c2; ci++) {
                const col = GRID_COLUMNS[ci];
                if (!col?.editable) continue;
                state.markDirty(row._id, { [col.key]: "" } as Partial<import("@skyhub/api").ScheduledFlightRef>);
              }
            }
          } else if (GRID_COLUMNS[colIdx]?.editable) {
            state.startEditing({ rowIdx, colKey }, "");
          }
          break;
        }
        case "Home":
          e.preventDefault();
          if (mod) state.selectCell({ rowIdx: 0, colKey: GRID_COLUMNS[0].key });
          else state.selectCell({ rowIdx, colKey: GRID_COLUMNS[0].key });
          break;
        case "End":
          e.preventDefault();
          if (mod) state.selectCell({ rowIdx: allRows.length - 1, colKey: GRID_COLUMNS[GRID_COLUMNS.length - 1].key });
          else state.selectCell({ rowIdx, colKey: GRID_COLUMNS[GRID_COLUMNS.length - 1].key });
          break;
        default:
          // Typing a character starts editing
          if (e.key.length === 1 && !mod && !e.altKey) {
            const col = GRID_COLUMNS[colIdx];
            if (col?.editable) {
              e.preventDefault();
              state.startEditing({ rowIdx, colKey }, e.key);
            }
          }
          break;
      }
    };

    // CRITICAL: capture phase intercepts BEFORE Chrome processes shortcuts
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []); // Empty deps — refs handle state changes
}
