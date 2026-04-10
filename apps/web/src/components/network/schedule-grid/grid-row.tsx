"use client";

import React, { useCallback } from "react";
import type { ScheduledFlightRef } from "@skyhub/api";
import { GRID_COLUMNS, ROW_HEIGHT, fmtMinutes, calcBlockMinutes, CELL_BORDER, CELL_BORDER_DARK, type GridColumn } from "./grid-columns";
import { GridCell } from "./grid-cell";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";
import { useOperatorStore } from "@/stores/use-operator-store";
import { formatDate } from "@/lib/date-format";
import { useTheme } from "@/components/theme-provider";

interface GridRowProps {
  columns?: GridColumn[];
  row: ScheduledFlightRef;
  rowIdx: number;
  prevRow?: ScheduledFlightRef | null;
  onContextMenu?: (e: React.MouseEvent, rowIdx: number, colKey: string) => void;
  onTabWrapDown?: () => void;
  rowHeight?: number;
}

export const GridRow = React.memo(function GridRow({ columns: columnsProp, row, rowIdx, prevRow, onContextMenu, onTabWrapDown, rowHeight }: GridRowProps) {
  const columns = columnsProp ?? GRID_COLUMNS;
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
  const getTatMinutes = useScheduleRefStore((s) => s.getTatMinutes);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const border = isDark ? CELL_BORDER_DARK : CELL_BORDER;

  const selectionRange = useScheduleGridStore((s) => s.selectionRange);
  const setSelectionRange = useScheduleGridStore((s) => s.setSelectionRange);
  const clipboard = useScheduleGridStore((s) => s.clipboard);

  const isRowDirty = dirtyMap.has(row._id);
  const isCancelled = row.status === "cancelled";
  const isSuspended = row.status === "suspended";

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
    if (colKey === "tat") {
      if (!prevRow) return "";
      // No TAT for first flight in a new cycle/rotation
      if (prevRow.rotationId !== row.rotationId) return "";
      // TAT = current STD - previous STA (ground time between consecutive flights)
      const prevSta = (getDirtyValue(prevRow._id, "staUtc") as string) ?? prevRow.staUtc;
      const curStd = (getDirtyValue(row._id, "stdUtc") as string) ?? row.stdUtc;
      if (!prevSta || !curStd) return "";
      const tat = calcBlockMinutes(prevSta, curStd);
      return tat != null ? fmtMinutes(tat) : "";
    }
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

  const parseFlightInput = useScheduleRefStore((s) => s.parseFlightInput);
  const isValidCarrier = useScheduleRefStore((s) => s.isValidCarrier);
  const operatorIata = useOperatorStore((s) => s.operator?.iataCode);

  const handleCommitWithAutoBlock = useCallback(() => {
    commitEdit();
    const dirty = dirtyMap.get(row._id);
    if (!dirty) return;

    // Flight number carrier code validation:
    // If user typed a 2-letter prefix (e.g. "EK123"), validate the carrier and split into airlineCode + flightNumber
    if (dirty.flightNumber != null) {
      const rawFn = String(dirty.flightNumber);
      const { airlineCode: parsedCarrier, flightNum } = parseFlightInput(rawFn);
      if (parsedCarrier) {
        if (isValidCarrier(parsedCarrier)) {
          // Valid carrier prefix — split into airlineCode + flightNumber
          markDirty(row._id, { airlineCode: parsedCarrier, flightNumber: flightNum } as Partial<ScheduledFlightRef>);
        }
        // Invalid carrier — keep the full string as flightNumber, don't change airlineCode
        // The user can fix it; we don't block the edit
      }
    }

    const dep = (dirty.depStation as string) ?? row.depStation;
    const arr = (dirty.arrStation as string) ?? row.arrStation;
    const std = (dirty.stdUtc as string) ?? row.stdUtc;

    if (dep && arr) {
      const block = getBlockMinutes(dep, arr);
      if (block && block > 0) {
        // Auto-set blockMinutes
        const dirtyBlock = (dirty.blockMinutes as number | null) ?? row.blockMinutes;
        if (!dirtyBlock) {
          markDirty(row._id, { blockMinutes: block } as Partial<ScheduledFlightRef>);
        }
        // Auto-suggest STA = STD + block (if STD exists and STA is empty)
        const sta = (dirty.staUtc as string) ?? row.staUtc;
        if (std && !sta) {
          const clean = std.replace(":", "");
          const hh = clean.length >= 3 ? Number(clean.slice(0, clean.length - 2)) : NaN;
          const mm = clean.length >= 3 ? Number(clean.slice(-2)) : NaN;
          if (!isNaN(hh) && !isNaN(mm)) {
            const totalMin = hh * 60 + mm + block;
            const h = Math.floor(totalMin / 60) % 24;
            const m = totalMin % 60;
            const suggestedSta = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            markDirty(row._id, { staUtc: suggestedSta } as Partial<ScheduledFlightRef>);
          }
        }
      }
    }

    // Auto-suggest STD from previous row's STA + TAT (if STD is empty)
    if (prevRow && !std) {
      const prevDirty = dirtyMap.get(prevRow._id);
      const prevSta = (prevDirty?.staUtc as string) ?? prevRow.staUtc ?? "";
      const prevAcType = (prevDirty?.aircraftTypeIcao as string) ?? prevRow.aircraftTypeIcao ?? "";
      const prevDep = (prevDirty?.depStation as string) ?? prevRow.depStation ?? "";
      const prevArr = (prevDirty?.arrStation as string) ?? prevRow.arrStation ?? "";
      if (prevSta && prevAcType) {
        const tatMin = getTatMinutes(prevAcType, prevDep, prevArr);
        if (tatMin != null) {
          const clean = prevSta.replace(":", "");
          const hh = clean.length >= 3 ? Number(clean.slice(0, clean.length - 2)) : NaN;
          const mm = clean.length >= 3 ? Number(clean.slice(-2)) : NaN;
          if (!isNaN(hh) && !isNaN(mm)) {
            const totalMin = hh * 60 + mm + tatMin;
            const h = Math.floor(totalMin / 60) % 24;
            const m = totalMin % 60;
            const suggestedStd = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            markDirty(row._id, { stdUtc: suggestedStd } as Partial<ScheduledFlightRef>);
          }
        }
      }
    }
  }, [commitEdit, dirtyMap, row, prevRow, getBlockMinutes, getTatMinutes, markDirty, parseFlightInput, isValidCarrier]);

  function handleNavigate(dir: "up" | "down" | "left" | "right") {
    if (!selectedCell) return;
    const colIdx = columns.findIndex((c) => c.key === selectedCell.colKey);
    const editableCols = columns.filter((c) => c.editable);
    if (dir === "down") selectCell({ rowIdx: rowIdx + 1, colKey: selectedCell.colKey });
    else if (dir === "up") selectCell({ rowIdx: Math.max(0, rowIdx - 1), colKey: selectedCell.colKey });
    else if (dir === "right") {
      const next = columns.slice(colIdx + 1).find((c) => c.editable);
      if (next) {
        startEditing({ rowIdx, colKey: next.key });
      } else {
        // Last editable column — wrap to next row
        if (onTabWrapDown) {
          onTabWrapDown();
        } else {
          startEditing({ rowIdx: rowIdx + 1, colKey: editableCols[0]?.key ?? selectedCell.colKey });
        }
      }
    } else if (dir === "left") {
      const prev = columns.slice(0, colIdx).reverse().find((c) => c.editable);
      if (prev) startEditing({ rowIdx, colKey: prev.key });
      else if (rowIdx > 0) startEditing({ rowIdx: rowIdx - 1, colKey: editableCols[editableCols.length - 1]?.key ?? selectedCell.colKey });
    }
  }

  // Row styling — priority: cancelled/suspended always win over dirty
  const rowBg = isCancelled
    ? (isDark ? "rgba(230,53,53,0.40)" : "rgba(230,53,53,0.60)")
    : isSuspended
      ? (isDark ? "rgba(143,144,166,0.15)" : "rgba(143,144,166,0.12)")
      : isRowDirty
        ? (isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.08)")
        : rowIdx % 2 === 1
          ? (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)")
          : undefined;

  // Text color override for status rows
  const rowTextColor = isCancelled
    ? (isDark ? "rgba(255,255,255,0.85)" : "#FFFFFF")
    : isSuspended
      ? (isDark ? "rgba(255,255,255,0.45)" : "#8F90A6")
      : undefined;

  return (
    <tr
      className="group transition-colors"
      style={{ height: rowHeight ?? ROW_HEIGHT, backgroundColor: rowBg }}
    >
      {/* Row number */}
      <td
        className="text-[11px] text-hz-text-tertiary select-none text-center"
        style={{ width: "3%", border, color: rowTextColor }}
      >
        {rowIdx + 1}
      </td>

      {columns.map((col, colIndex) => {
        const isSelected = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key;
        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === col.key;
        const cellValue = getCellValue(col.key);
        const cellDirty = dirtyMap.has(row._id) && col.key in (dirtyMap.get(row._id) ?? {});
        const isInRange = normRange !== null
          && rowIdx >= normRange.r1 && rowIdx <= normRange.r2
          && colIndex >= normRange.c1 && colIndex <= normRange.c2;
        const isClipboardSource = clipboard !== null
          && clipboard.rowIds.includes(row._id)
          && clipboard.colKeys.includes(col.key);

        return (
          <GridCell
            key={col.key}
            column={col}
            value={cellValue}
            isSelected={isSelected}
            isEditing={isEditing}
            isInRange={isInRange}
            clipboardMode={isClipboardSource ? clipboard.mode : undefined}
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
            isDirty={cellDirty && !isCancelled && !isSuspended}
            forcedTextColor={rowTextColor}
          />
        );
      })}
    </tr>
  );
});
