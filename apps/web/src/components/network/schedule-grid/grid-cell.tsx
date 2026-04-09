"use client";

import React, { useRef, useEffect } from "react";
import type { GridColumn } from "./grid-columns";
import { SELECTION_COLOR, CELL_BORDER, CELL_BORDER_DARK } from "./grid-columns";
import type { CellFormat } from "./types";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { useOperatorStore } from "@/stores/use-operator-store";
import { normalizeToIso, formatDate } from "@/lib/date-format";
import { getConditionalFormat } from "./conditional-format-rules";
import { useTheme } from "@/components/theme-provider";
import type { ScheduledFlightRef } from "@skyhub/api";

const FONT_STACKS: Record<string, string> = {
  "Mono": "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  "Inter": "Inter, system-ui, sans-serif",
  "SF Pro": "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  "Roboto": "Roboto, 'Helvetica Neue', Arial, sans-serif",
  "Helvetica Neue": "'Helvetica Neue', Helvetica, Arial, sans-serif",
  "Segoe UI": "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};
function resolveFontFamily(name: string): string {
  return FONT_STACKS[name] ?? name;
}

interface GridCellProps {
  column: GridColumn;
  value: string;
  isSelected: boolean;
  isEditing: boolean;
  isInRange?: boolean;
  editValue: string;
  rowIdx: number;
  colIdx: number;
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
  onDragStart?: () => void;
  onDragEnter?: () => void;
  isDirty: boolean;
  clipboardMode?: "copy" | "cut";
  forcedTextColor?: string;
}

export const GridCell = React.memo(function GridCell({
  column, value, isSelected, isEditing, isInRange, editValue, rowId, row,
  onContextMenu, onSelect, onStartEdit, onEditChange, onCommit, onCancel, onNavigate, onFieldWire,
  onDragStart, onDragEnter, isDirty, clipboardMode, forcedTextColor,
}: GridCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const border = isDark ? CELL_BORDER_DARK : CELL_BORDER;

  const acTypeOptions = useScheduleRefStore((s) => s.getAcTypeOptions);
  const svcOptions = useScheduleRefStore((s) => s.getSvcOptions);
  const resolveAcType = useScheduleRefStore((s) => s.resolveAcType);
  const cellFormats = useScheduleGridStore((s) => s.cellFormats);
  const filterDateFrom = useScheduleGridStore((s) => s.filterDateFrom);
  const filterDateTo = useScheduleGridStore((s) => s.filterDateTo);
  const fmt: CellFormat | undefined = cellFormats.get(`${rowId}:${column.key}`);
  const condFmt = getConditionalFormat(row, column.key);

  // Date validation: check if FROM/TO falls outside filter period
  const isDateCol = column.key === "effectiveFrom" || column.key === "effectiveUntil";
  const opDateFormat = useOperatorStore((s) => s.dateFormat);

  const normValue = isDateCol ? normalizeToIso(value, opDateFormat) : "";
  const normFrom = normalizeToIso(filterDateFrom, opDateFormat);
  const normTo = normalizeToIso(filterDateTo, opDateFormat);

  const newRowIds = useScheduleGridStore((s) => s.newRowIds);
  const isNewRow = newRowIds.has(rowId);

  const isOutOfPeriod = isDateCol && normValue && normFrom && normTo &&
    (normValue < normFrom || normValue > normTo);
  const isSuggested = isDateCol && value && !isDirty && isNewRow;

  // Clamp FROM/TO display to the filter period intersection (always in operator date format)
  let clampedDateDisplay: string | null = null;
  if (isDateCol && normValue && normFrom && normTo && !isDirty) {
    if (column.key === "effectiveFrom" && normValue < normFrom) {
      clampedDateDisplay = formatDate(normFrom, opDateFormat);
    } else if (column.key === "effectiveUntil" && normValue > normTo) {
      clampedDateDisplay = formatDate(normTo, opDateFormat);
    }
  }

  useEffect(() => {
    if (isEditing) {
      if (column.type === "select") selectRef.current?.focus();
      else if (inputRef.current) {
        inputRef.current.focus();
        // Position cursor at end so typing appends
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [isEditing, column.type, column.key]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); onCommit(); onNavigate("down"); }
    else if (e.key === "Tab") { e.preventDefault(); onCommit(); onNavigate(e.shiftKey ? "left" : "right"); }
    else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };

  const monoFont = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

  const cellStyle: React.CSSProperties = {
    width: column.width,
    textAlign: fmt?.textAlign ?? column.align,
    fontFamily: column.key === "status" ? "Inter, system-ui, sans-serif" : column.mono ? monoFont : undefined,
    fontSize: 13,
    border,
    padding: "0 4px",
    cursor: column.editable ? "cell" : "default",
  };

  // Clipboard marching-ants dashed border
  const clipboardStyle: React.CSSProperties = clipboardMode
    ? {
        outline: `2px dashed ${clipboardMode === "cut" ? "#E63535" : SELECTION_COLOR}`,
        outlineOffset: -2,
      }
    : {};

  // Selection / range / dirty styling
  const selectionStyle: React.CSSProperties = isSelected
    ? { outline: `2px solid ${SELECTION_COLOR}`, outlineOffset: -2 }
    : isInRange
      ? { backgroundColor: isDark ? "rgba(33,115,70,0.20)" : "rgba(33,115,70,0.10)" }
      : clipboardMode
        ? clipboardStyle
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
      const commitAcType = () => {
        const resolved = resolveAcType(editValue);
        if (resolved) {
          onEditChange(resolved.icao);
          if (onFieldWire) onFieldWire("aircraftTypeId", resolved.id);
        }
        onCommit();
      };
      return (
        <td style={editCellStyle}>
          <input ref={inputRef} type="text" value={editValue} maxLength={4}
            onChange={(e) => onEditChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitAcType(); onNavigate("down"); }
              else if (e.key === "Tab") { e.preventDefault(); commitAcType(); onNavigate(e.shiftKey ? "left" : "right"); }
              else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            }}
            onBlur={commitAcType}
            placeholder="e.g. 321"
            className="w-full h-full bg-transparent border-none outline-none text-[13px] text-center text-hz-text"
            style={{ fontFamily: monoFont }}
          />
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

    // Time columns (STD, STA): only allow digits and colon
    if (column.type === "time") {
      return (
        <td style={editCellStyle}>
          <input ref={inputRef} type="text" value={editValue} maxLength={5}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9:]/g, "");
              // Auto-insert colon after 2 digits if user is typing continuously
              if (v.length === 3 && !v.includes(":")) {
                onEditChange(v.slice(0, 2) + ":" + v.slice(2));
              } else {
                onEditChange(v);
              }
            }}
            onKeyDown={handleKeyDown} onBlur={onCommit}
            placeholder="HH:MM"
            className="w-full h-full bg-transparent border-none outline-none text-[13px] text-center text-hz-text"
            style={{ fontFamily: monoFont }}
          />
        </td>
      );
    }

    return (
      <td style={editCellStyle}>
        <input ref={inputRef} type="text" value={editValue} maxLength={column.maxLength}
          onChange={(e) => {
            onEditChange(e.target.value.toUpperCase());
          }}
          onKeyDown={handleKeyDown} onBlur={onCommit}
          className="w-full h-full bg-transparent border-none outline-none text-[13px] text-center text-hz-text"
          style={{ fontFamily: column.mono ? monoFont : undefined }}
        />
      </td>
    );
  }

  // Out-of-period styling — only warn if no clamp is applied (shouldn't happen now)
  const periodWarningStyle: React.CSSProperties = (isOutOfPeriod && !clampedDateDisplay)
    ? { outline: "2px solid #E63535", outlineOffset: -2 }
    : {};

  // ── Display mode ──
  return (
    <td
      style={{ ...cellStyle, ...selectionStyle, ...periodWarningStyle }}
      onClick={onSelect}
      onDoubleClick={() => column.editable && onStartEdit()}
      onContextMenu={onContextMenu}
      onMouseDown={(ev) => {
        if (ev.button === 0 && ev.shiftKey) {
          // Shift+Click extends selection to this cell
          ev.preventDefault();
        } else if (ev.button === 0) {
          onDragStart?.();
        }
      }}
      onMouseEnter={(ev) => {
        if (ev.buttons === 1) onDragEnter?.();
      }}
    >
      <span
        className="block w-full truncate"
        style={{
          color: forcedTextColor ?? (isOutOfPeriod && !clampedDateDisplay ? "#E63535" : isSuggested ? "#8F90A6" : fmt?.textColor ?? condFmt?.textColor ?? statusColor ?? undefined),
          fontWeight: fmt?.bold || condFmt?.bold ? 700 : (statusColor ? 600 : undefined),
          fontStyle: fmt?.italic || condFmt?.italic || isSuggested ? "italic" : undefined,
          textDecoration: fmt?.underline || condFmt?.underline ? "underline" : undefined,
          fontFamily: fmt?.fontFamily ? resolveFontFamily(fmt.fontFamily) : undefined,
          fontSize: fmt?.fontSize ? `${fmt.fontSize}px` : undefined,
          textTransform: column.key === "status" ? "capitalize" : undefined,
          backgroundColor: fmt?.bgColor ?? undefined,
          lineHeight: "30px",
        }}
      >
        {clampedDateDisplay ?? value}
      </span>
    </td>
  );
});
