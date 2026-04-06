"use client";

import React from "react";
import type { ScheduledFlightRef } from "@skyhub/api";
import { GRID_COLUMNS, ROW_HEIGHT, fmtMinutes, calcBlockMinutes } from "./grid-columns";
import { GridCell } from "./grid-cell";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";

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

  const isRowDirty = dirtyMap.has(row._id);

  function getCellValue(colKey: string): string {
    // Check dirty value first
    const dirty = getDirtyValue(row._id, colKey);
    if (dirty !== undefined) return String(dirty);

    // Computed columns
    if (colKey === "ac") return row.rotationLabel ?? (row.aircraftTypeIcao ? `${row.aircraftTypeIcao}` : "—");
    if (colKey === "blockMinutes") {
      const block = row.blockMinutes ?? calcBlockMinutes(row.stdUtc, row.staUtc);
      return fmtMinutes(block);
    }
    if (colKey === "tat") return ""; // TAT calculated in shell from rotation chains

    const val = (row as Record<string, unknown>)[colKey];
    return val != null ? String(val) : "";
  }

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
            onSelect={() => selectCell({ rowIdx, colKey: col.key })}
            onStartEdit={() => startEditing({ rowIdx, colKey: col.key })}
            onEditChange={setEditValue}
            onCommit={commitEdit}
            onCancel={cancelEdit}
            onNavigate={handleNavigate}
            isDirty={cellDirty}
          />
        );
      })}
    </div>
  );
});
