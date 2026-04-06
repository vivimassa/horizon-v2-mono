"use client";

import { useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScheduledFlightRef } from "@skyhub/api";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { GRID_COLUMNS, ROW_HEIGHT, HEADER_HEIGHT, TOTAL_WIDTH } from "./grid-columns";

interface ScheduleGridProps {
  rows: ScheduledFlightRef[];
}

export function ScheduleGrid({ rows }: ScheduleGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedCell = useScheduleGridStore((s) => s.selectedCell);
  const editingCell = useScheduleGridStore((s) => s.editingCell);
  const selectCell = useScheduleGridStore((s) => s.selectCell);
  const startEditing = useScheduleGridStore((s) => s.startEditing);
  const commitEdit = useScheduleGridStore((s) => s.commitEdit);
  const cancelEdit = useScheduleGridStore((s) => s.cancelEdit);
  const newRows = useScheduleGridStore((s) => s.newRows);

  const allRows = [...rows, ...newRows];

  const virtualizer = useVirtualizer({
    count: allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  });

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't intercept if editing (let input handle it)
      if (editingCell) return;

      if (!selectedCell) return;

      const { rowIdx, colKey } = selectedCell;
      const colIdx = GRID_COLUMNS.findIndex((c) => c.key === colKey);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (rowIdx < allRows.length - 1) selectCell({ rowIdx: rowIdx + 1, colKey });
          break;
        case "ArrowUp":
          e.preventDefault();
          if (rowIdx > 0) selectCell({ rowIdx: rowIdx - 1, colKey });
          break;
        case "ArrowRight":
          e.preventDefault();
          if (colIdx < GRID_COLUMNS.length - 1) selectCell({ rowIdx, colKey: GRID_COLUMNS[colIdx + 1].key });
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (colIdx > 0) selectCell({ rowIdx, colKey: GRID_COLUMNS[colIdx - 1].key });
          break;
        case "Enter":
        case "F2": {
          e.preventDefault();
          const col = GRID_COLUMNS[colIdx];
          if (col?.editable) startEditing({ rowIdx, colKey });
          break;
        }
        case "Tab": {
          e.preventDefault();
          const editableCols = GRID_COLUMNS.filter((c) => c.editable);
          const curEditIdx = editableCols.findIndex((c) => c.key === colKey);
          if (e.shiftKey) {
            if (curEditIdx > 0) selectCell({ rowIdx, colKey: editableCols[curEditIdx - 1].key });
            else if (rowIdx > 0) selectCell({ rowIdx: rowIdx - 1, colKey: editableCols[editableCols.length - 1].key });
          } else {
            if (curEditIdx < editableCols.length - 1) selectCell({ rowIdx, colKey: editableCols[curEditIdx + 1].key });
            else if (rowIdx < allRows.length - 1) selectCell({ rowIdx: rowIdx + 1, colKey: editableCols[0].key });
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          selectCell(null);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          // Clear cell — start editing with empty value
          if (GRID_COLUMNS[colIdx]?.editable) startEditing({ rowIdx, colKey }, "");
          break;
        default:
          // Typing a character starts editing
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const col = GRID_COLUMNS[colIdx];
            if (col?.editable) {
              e.preventDefault();
              startEditing({ rowIdx, colKey }, e.key);
            }
          }
          break;
      }
    },
    [selectedCell, editingCell, allRows.length, selectCell, startEditing]
  );

  // Scroll selected cell into view
  useEffect(() => {
    if (selectedCell && parentRef.current) {
      virtualizer.scrollToIndex(selectedCell.rowIdx, { align: "auto" });
    }
  }, [selectedCell, virtualizer]);

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto bg-hz-card border border-hz-border rounded-lg focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ contain: "strict" }}
    >
      <div style={{ minWidth: TOTAL_WIDTH + 40 }}>
        {/* Frozen header */}
        <GridHeader scrollLeft={0} />

        {/* Virtualized body */}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = allRows[vRow.index];
            if (!row) return null;
            return (
              <GridRow
                key={row._id}
                row={row}
                rowIdx={vRow.index}
                style={{
                  position: "absolute",
                  top: vRow.start,
                  left: 0,
                  width: "100%",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
