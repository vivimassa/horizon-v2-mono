"use client";

import React, { useRef, useEffect } from "react";
import type { GridColumn } from "./grid-columns";
import { SELECTION_COLOR, CELL_BORDER, CELL_BORDER_DARK } from "./grid-columns";
import type { CellFormat } from "./types";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { getConditionalFormat } from "./conditional-format-rules";
import { useTheme } from "@/components/theme-provider";
import type { ScheduledFlightRef } from "@skyhub/api";

interface GridCellProps {
  column: GridColumn;
  value: string;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
  rowIdx: number;
  rowId: string;
  row: ScheduledFlightRef;
  onContextMenu?: (e: React.MouseEvent) => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onNavigate: (dir: "up" | "down" | "left" | "right") => void;
  onFieldWire?: (field: string, value: string) => void;
  isDirty: boolean;
}

export const GridCell = React.memo(function GridCell({
  column, value, isSelected, isEditing, editValue, rowId, row,
  onContextMenu, onSelect, onStartEdit, onEditChange, onCommit, onCancel, onNavigate, onFieldWire, isDirty,
}: GridCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const border = isDark ? CELL_BORDER_DARK : CELL_BORDER;

  const acTypeOptions = useScheduleRefStore((s) => s.getAcTypeOptions);
  const svcOptions = useScheduleRefStore((s) => s.getSvcOptions);
  const getCellFormat = useScheduleGridStore((s) => s.getCellFormat);
  const fmt: CellFormat | undefined = getCellFormat(rowId, column.key);
  const condFmt = getConditionalFormat(row, column.key);

  useEffect(() => {
    if (isEditing) {
      if (column.type === "select" || column.key === "aircraftTypeIcao") selectRef.current?.focus();
      else { inputRef.current?.focus(); inputRef.current?.select(); }
    }
  }, [isEditing, column.type, column.key]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); onCommit(); onNavigate("down"); }
    else if (e.key === "Tab") { e.preventDefault(); onCommit(); onNavigate(e.shiftKey ? "left" : "right"); }
    else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };

  const monoFont = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

  const cellStyle: React.CSSProperties = {
    width: column.width,
    textAlign: column.align,
    fontFamily: column.mono ? monoFont : undefined,
    fontSize: 13,
    border,
    padding: "0 4px",
    cursor: column.editable ? "cell" : "default",
  };

  // Selection / dirty styling
  const selectionStyle: React.CSSProperties = isSelected
    ? { outline: `2px solid ${SELECTION_COLOR}`, outlineOffset: -2 }
    : isDirty
      ? { backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.08)" }
      : {};

  // Status colors
  const statusColor = column.key === "status" ? {
    draft: "#E67A00", active: "#06C270", suspended: "#8F90A6", cancelled: "#E63535",
  }[value] : undefined;

  // ── Editing mode ──
  if (isEditing && column.editable) {
    const editCellStyle: React.CSSProperties = {
      ...cellStyle,
      outline: `2px solid ${SELECTION_COLOR}`,
      outlineOffset: -2,
      backgroundColor: isDark ? "#191921" : "#FFFFFF",
      position: "relative",
    };

    if (column.key === "aircraftTypeIcao") {
      const options = acTypeOptions();
      return (
        <td style={editCellStyle}>
          <select ref={selectRef} value={editValue}
            onChange={(e) => {
              const opt = options.find((o) => o.icao === e.target.value);
              onEditChange(e.target.value);
              if (opt && onFieldWire) onFieldWire("aircraftTypeId", opt.value);
              setTimeout(onCommit, 0);
            }}
            onKeyDown={handleKeyDown} onBlur={onCommit}
            className="w-full h-full bg-transparent border-none outline-none text-[13px] text-center text-hz-text">
            <option value="">—</option>
            {options.map((o) => <option key={o.value} value={o.icao}>{o.icao}</option>)}
          </select>
        </td>
      );
    }

    if (column.type === "select" && column.key === "serviceType") {
      const options = svcOptions();
      return (
        <td style={editCellStyle}>
          <select ref={selectRef} value={editValue}
            onChange={(e) => { onEditChange(e.target.value); setTimeout(onCommit, 0); }}
            onKeyDown={handleKeyDown} onBlur={onCommit}
            className="w-full h-full bg-transparent border-none outline-none text-[13px] text-center text-hz-text">
            <option value="">—</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
          </select>
        </td>
      );
    }

    return (
      <td style={editCellStyle}>
        <input ref={inputRef} type="text" value={editValue} maxLength={column.maxLength}
          onChange={(e) => {
            let v = e.target.value;
            if (column.key === "depStation" || column.key === "arrStation" || column.key === "flightNumber") v = v.toUpperCase();
            onEditChange(v);
          }}
          onKeyDown={handleKeyDown} onBlur={onCommit}
          className="w-full h-full bg-transparent border-none outline-none text-[13px] text-center text-hz-text"
          style={{ fontFamily: column.mono ? monoFont : undefined }}
        />
      </td>
    );
  }

  // ── Display mode ──
  return (
    <td
      style={{ ...cellStyle, ...selectionStyle }}
      onClick={onSelect}
      onDoubleClick={() => column.editable && onStartEdit()}
      onContextMenu={onContextMenu}
    >
      <span
        className="block w-full truncate"
        style={{
          color: fmt?.textColor ?? condFmt?.textColor ?? (column.key === "flightNumber" ? "#E63535" : statusColor),
          fontWeight: fmt?.bold || condFmt?.bold ? 700 : (column.key === "flightNumber" || statusColor ? 600 : undefined),
          fontStyle: fmt?.italic || condFmt?.italic ? "italic" : undefined,
          textDecoration: fmt?.underline || condFmt?.underline ? "underline" : undefined,
          fontFamily: fmt?.fontFamily ? (fmt.fontFamily === "Mono" ? monoFont : fmt.fontFamily) : undefined,
          fontSize: fmt?.fontSize ? `${fmt.fontSize}px` : column.key === "status" ? "11px" : undefined,
          textTransform: column.key === "status" ? "capitalize" : undefined,
          backgroundColor: fmt?.bgColor ?? undefined,
          lineHeight: "30px",
        }}
      >
        {value}
      </span>
    </td>
  );
});
