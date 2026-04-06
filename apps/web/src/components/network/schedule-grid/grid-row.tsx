"use client";

import React, { useCallback } from "react";
import type { ScheduledFlightRef } from "@skyhub/api";
import { GRID_COLUMNS, ROW_HEIGHT, fmtMinutes, calcBlockMinutes, CELL_BORDER, CELL_BORDER_DARK } from "./grid-columns";
import { GridCell } from "./grid-cell";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";
import { useOperatorStore } from "@/stores/use-operator-store";
import { formatDate } from "@/lib/date-format";
import { useTheme } from "@/components/theme-provider";

interface GridRowProps {
  row: ScheduledFlightRef;
  rowIdx: number;
  onContextMenu?: (e: React.MouseEvent, rowIdx: number, colKey: string) => void;
}

export const GridRow = React.memo(function GridRow({ row, rowIdx, onContextMenu }: GridRowProps) {
  const selectedCell = useScheduleGridStore((s) => s.selectedCell);
  const editingCell = useScheduleGridStore((s) => s.editingCell);
  const editValue = useScheduleGridStore((s) => s.editValue);
  const selectCell = useScheduleGridStore((s) => s.selectCell);
  const startEditing = useScheduleGridStore((s) => s.startEditing);
  const setEditValue = useScheduleGridStore((s) => s.setEditValue);
  const commitEdit = useScheduleGridStore((s) => s.commitEdit);
  const cancelEdit = useScheduleGridStore((s) => s.cancelEdit);
  const getDirtyValue = useScheduleGridStore((s) => s.getDirtyValue);
  const dirtyMap = useScheduleGridStore((s) => s.dirtyMap);
  const markDirty = useScheduleGridStore((s) => s.markDirty);
  const getBlockMinutes = useScheduleRefStore((s) => s.getBlockMinutes);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const border = isDark ? CELL_BORDER_DARK : CELL_BORDER;

  const selectionRange = useScheduleGridStore((s) => s.selectionRange);
  const setSelectionRange = useScheduleGridStore((s) => s.setSelectionRange);

  const isRowDirty = dirtyMap.has(row._id);
  const isCancelled = row.status === "cancelled";

  // Normalize selection range for hit testing
  const normRange = selectionRange ? {
    r1: Math.min(selectionRange.startRow, selectionRange.endRow),
    r2: Math.max(selectionRange.startRow, selectionRange.endRow),
    c1: Math.min(selectionRange.startCol, selectionRange.endCol),
    c2: Math.max(selectionRange.startCol, selectionRange.endCol),
  } : null;

  const operatorDateFormat = useOperatorStore((s) => s.dateFormat);

  /** Format HHMM → HH:MM for display */
  function fmtTime(t: string): string {
    if (!t) return "";
    const clean = t.replace(":", "");
    if (clean.length >= 4) return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
    return t;
  }

  function getCellValue(colKey: string): string {
    // Computed columns always go through their formatter regardless of dirty state
    if (colKey === "ac") return row.rotationLabel ?? (row.aircraftTypeIcao ? `${row.aircraftTypeIcao}` : "—");
    if (colKey === "blockMinutes") {
      // BLOCK is always derived: STA minus STD. Never use stored/dirty values.
      const std = (getDirtyValue(row._id, "stdUtc") as string) ?? row.stdUtc;
      const sta = (getDirtyValue(row._id, "staUtc") as string) ?? row.staUtc;
      return fmtMinutes(calcBlockMinutes(std, sta));
    }

    const dirty = getDirtyValue(row._id, colKey);
    if (dirty !== undefined) {
      const v = String(dirty);
      if (colKey === "effectiveFrom" || colKey === "effectiveUntil") return formatDate(v, operatorDateFormat);
      if (colKey === "stdUtc" || colKey === "staUtc") return fmtTime(v);
      return v;
    }
    if (colKey === "tat") return "";
    if (colKey === "effectiveFrom" || colKey === "effectiveUntil") {
      const val = (row as any)[colKey];
      return val ? formatDate(String(val), operatorDateFormat) : "";
    }
    if (colKey === "stdUtc" || colKey === "staUtc") {
      const val = (row as any)[colKey];
      return val ? fmtTime(String(val)) : "";
    }
    const val = (row as any)[colKey];
    return val != null ? String(val) : "";
  }

  const handleFieldWire = useCallback((field: string, value: string) => {
    markDirty(row._id, { [field]: value } as Partial<ScheduledFlightRef>);
  }, [row._id, markDirty]);

  const handleCommitWithAutoBlock = useCallback(() => {
    commitEdit();
    const dirty = dirtyMap.get(row._id);
    if (dirty) {
      const dep = (dirty.depStation as string) ?? row.depStation;
      const arr = (dirty.arrStation as string) ?? row.arrStation;
      if (dep && arr && !row.blockMinutes) {
        const block = getBlockMinutes(dep, arr);
        if (block && block > 0) markDirty(row._id, { blockMinutes: block } as Partial<ScheduledFlightRef>);
      }
    }
  }, [commitEdit, dirtyMap, row, getBlockMinutes, markDirty]);

  function handleNavigate(dir: "up" | "down" | "left" | "right") {
    if (!selectedCell) return;
    const colIdx = GRID_COLUMNS.findIndex((c) => c.key === selectedCell.colKey);
    const editableCols = GRID_COLUMNS.filter((c) => c.editable);
    if (dir === "down") selectCell({ rowIdx: rowIdx + 1, colKey: selectedCell.colKey });
    else if (dir === "up") selectCell({ rowIdx: Math.max(0, rowIdx - 1), colKey: selectedCell.colKey });
    else if (dir === "right") {
      const next = GRID_COLUMNS.slice(colIdx + 1).find((c) => c.editable);
      if (next) startEditing({ rowIdx, colKey: next.key });
      else startEditing({ rowIdx: rowIdx + 1, colKey: editableCols[0]?.key ?? selectedCell.colKey });
    } else if (dir === "left") {
      const prev = GRID_COLUMNS.slice(0, colIdx).reverse().find((c) => c.editable);
      if (prev) startEditing({ rowIdx, colKey: prev.key });
      else if (rowIdx > 0) startEditing({ rowIdx: rowIdx - 1, colKey: editableCols[editableCols.length - 1]?.key ?? selectedCell.colKey });
    }
  }

  // Row styling
  const rowBg = isRowDirty
    ? (isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.08)")
    : rowIdx % 2 === 1
      ? (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)")
      : undefined;

  return (
    <tr
      className={`group transition-colors ${isCancelled ? "line-through text-hz-text-tertiary/40" : ""}`}
      style={{ height: ROW_HEIGHT, backgroundColor: rowBg }}
    >
      {/* Row number */}
      <td
        className="text-[11px] text-hz-text-tertiary select-none text-center"
        style={{ width: "3%", border }}
      >
        {rowIdx + 1}
      </td>

      {GRID_COLUMNS.map((col, colIndex) => {
        const isSelected = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key;
        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === col.key;
        const cellValue = getCellValue(col.key);
        const cellDirty = dirtyMap.has(row._id) && col.key in (dirtyMap.get(row._id) ?? {});
        const isInRange = normRange !== null
          && rowIdx >= normRange.r1 && rowIdx <= normRange.r2
          && colIndex >= normRange.c1 && colIndex <= normRange.c2;

        return (
          <GridCell
            key={col.key}
            column={col}
            value={cellValue}
            isSelected={isSelected}
            isEditing={isEditing}
            isInRange={isInRange}
            editValue={isEditing ? editValue : ""}
            rowIdx={rowIdx}
            colIdx={colIndex}
            rowId={row._id}
            row={row}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu?.(e, rowIdx, col.key);
            }}
            onSelect={() => selectCell({ rowIdx, colKey: col.key })}
            onStartEdit={() => startEditing({ rowIdx, colKey: col.key })}
            onEditChange={setEditValue}
            onCommit={handleCommitWithAutoBlock}
            onCancel={cancelEdit}
            onNavigate={handleNavigate}
            onFieldWire={handleFieldWire}
            onDragStart={() => {
              setSelectionRange({ startRow: rowIdx, startCol: colIndex, endRow: rowIdx, endCol: colIndex });
            }}
            onDragEnter={() => {
              const sr = useScheduleGridStore.getState().selectionRange;
              if (sr) setSelectionRange({ ...sr, endRow: rowIdx, endCol: colIndex });
            }}
            isDirty={cellDirty}
          />
        );
      })}
    </tr>
  );
});
