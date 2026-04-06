"use client";

import React, { useCallback } from "react";
import type { ScheduledFlightRef } from "@skyhub/api";
import { GRID_COLUMNS, ROW_HEIGHT, fmtMinutes, calcBlockMinutes } from "./grid-columns";
import { GridCell } from "./grid-cell";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";

interface GridRowProps {
  row: ScheduledFlightRef;
  rowIdx: number;
  style: React.CSSProperties;
}

export const GridRow = React.memo(function GridRow({ row, rowIdx, style }: GridRowProps) {
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

  // Wire extra fields when a primary field changes (e.g. AC type sets aircraftTypeId)
  const handleFieldWire = useCallback((field: string, value: string) => {
    markDirty(row._id, { [field]: value } as Partial<ScheduledFlightRef>);
  }, [row._id, markDirty]);

  // Auto-populate block minutes when DEP or ARR changes
  const handleCommitWithAutoBlock = useCallback(() => {
    commitEdit();

    // After commit, check if we should auto-populate block minutes
    const editCell = useScheduleGridStore.getState().editingCell;
    if (!editCell) {
      // editingCell was just cleared by commitEdit, check what was edited
      const dirty = dirtyMap.get(row._id);
      if (dirty) {
        const dep = (dirty.depStation as string) ?? row.depStation;
        const arr = (dirty.arrStation as string) ?? row.arrStation;
        if (dep && arr && !row.blockMinutes) {
          const block = getBlockMinutes(dep, arr);
          if (block && block > 0) {
            markDirty(row._id, { blockMinutes: block } as Partial<ScheduledFlightRef>);
          }
        }
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
      const nextEditable = GRID_COLUMNS.slice(colIdx + 1).find((c) => c.editable);
      if (nextEditable) selectCell({ rowIdx, colKey: nextEditable.key });
      else selectCell({ rowIdx: rowIdx + 1, colKey: editableCols[0]?.key ?? selectedCell.colKey });
    } else if (dir === "left") {
      const prevEditable = GRID_COLUMNS.slice(0, colIdx).reverse().find((c) => c.editable);
      if (prevEditable) selectCell({ rowIdx, colKey: prevEditable.key });
      else if (rowIdx > 0) selectCell({ rowIdx: rowIdx - 1, colKey: editableCols[editableCols.length - 1]?.key ?? selectedCell.colKey });
    }
  }

  return (
    <div
      className={`flex border-b border-hz-border/30 ${rowIdx % 2 === 1 ? "bg-hz-border/[0.03]" : ""}`}
      style={{ ...style, height: ROW_HEIGHT, minWidth: "max-content" }}
    >
      {/* Row number */}
      <div
        className="flex items-center justify-center border-r border-hz-border/30 text-[11px] text-hz-text-tertiary shrink-0 select-none"
        style={{ width: 40, height: ROW_HEIGHT }}
      >
        {rowIdx + 1}
      </div>

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
    </div>
  );
});
