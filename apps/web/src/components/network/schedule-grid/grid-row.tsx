"use client";

import React, { useCallback } from "react";
import type { ScheduledFlightRef } from "@skyhub/api";
import { GRID_COLUMNS, ROW_HEIGHT, fmtMinutes, calcBlockMinutes, CELL_BORDER, CELL_BORDER_DARK } from "./grid-columns";
import { GridCell } from "./grid-cell";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";
import { useTheme } from "@/components/theme-provider";

interface GridRowProps {
  row: ScheduledFlightRef;
  rowIdx: number;
}

export const GridRow = React.memo(function GridRow({ row, rowIdx }: GridRowProps) {
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

  const isRowDirty = dirtyMap.has(row._id);
  const isCancelled = row.status === "cancelled";

  function getCellValue(colKey: string): string {
    const dirty = getDirtyValue(row._id, colKey);
    if (dirty !== undefined) return String(dirty);
    if (colKey === "ac") return row.rotationLabel ?? (row.aircraftTypeIcao ? `${row.aircraftTypeIcao}` : "—");
    if (colKey === "blockMinutes") {
      const block = row.blockMinutes ?? calcBlockMinutes(row.stdUtc, row.staUtc);
      return fmtMinutes(block);
    }
    if (colKey === "tat") return "";
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
      if (next) selectCell({ rowIdx, colKey: next.key });
      else selectCell({ rowIdx: rowIdx + 1, colKey: editableCols[0]?.key ?? selectedCell.colKey });
    } else if (dir === "left") {
      const prev = GRID_COLUMNS.slice(0, colIdx).reverse().find((c) => c.editable);
      if (prev) selectCell({ rowIdx, colKey: prev.key });
      else if (rowIdx > 0) selectCell({ rowIdx: rowIdx - 1, colKey: editableCols[editableCols.length - 1]?.key ?? selectedCell.colKey });
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
        style={{ width: 40, border }}
      >
        {rowIdx + 1}
      </td>

      {GRID_COLUMNS.map((col) => {
        const isSelected = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key;
        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === col.key;
        const cellValue = getCellValue(col.key);
        const cellDirty = dirtyMap.has(row._id) && col.key in (dirtyMap.get(row._id) ?? {});

        return (
          <GridCell
            key={col.key}
            column={col}
            value={cellValue}
            isSelected={isSelected}
            isEditing={isEditing}
            editValue={isEditing ? editValue : ""}
            rowIdx={rowIdx}
            rowId={row._id}
            row={row}
            onContextMenu={(e) => e.preventDefault()}
            onSelect={() => selectCell({ rowIdx, colKey: col.key })}
            onStartEdit={() => startEditing({ rowIdx, colKey: col.key })}
            onEditChange={setEditValue}
            onCommit={handleCommitWithAutoBlock}
            onCancel={cancelEdit}
            onNavigate={handleNavigate}
            onFieldWire={handleFieldWire}
            isDirty={cellDirty}
          />
        );
      })}
    </tr>
  );
});
