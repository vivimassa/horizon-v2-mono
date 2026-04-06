"use client";

import React, { useRef, useEffect } from "react";
import type { GridColumn } from "./grid-columns";
import type { CellFormat } from "./types";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";

interface GridCellProps {
  column: GridColumn;
  value: string;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
  rowIdx: number;
  rowId: string;
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
  column,
  value,
  isSelected,
  isEditing,
  editValue,
  rowId,
  onSelect,
  onStartEdit,
  onEditChange,
  onCommit,
  onCancel,
  onNavigate,
  onFieldWire,
  isDirty,
}: GridCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const acTypeOptions = useScheduleRefStore((s) => s.getAcTypeOptions);
  const svcOptions = useScheduleRefStore((s) => s.getSvcOptions);
  const getCellFormat = useScheduleGridStore((s) => s.getCellFormat);
  const fmt: CellFormat | undefined = getCellFormat(rowId, column.key);

  useEffect(() => {
    if (isEditing) {
      if (column.type === "select" || column.key === "aircraftTypeIcao") {
        selectRef.current?.focus();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [isEditing, column.type, column.key]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); onCommit(); onNavigate("down"); }
    else if (e.key === "Tab") { e.preventDefault(); onCommit(); onNavigate(e.shiftKey ? "left" : "right"); }
    else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };

  const cellStyle: React.CSSProperties = {
    width: column.width,
    height: "100%",
    textAlign: column.align,
    fontFamily: column.mono ? "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace" : undefined,
  };

  const statusColor = column.key === "status" ? {
    draft: "#E67A00",
    active: "#06C270",
    suspended: "#8F90A6",
    cancelled: "#E63535",
  }[value] : undefined;

  // ── Editing mode ──
  if (isEditing && column.editable) {
    // Aircraft Type dropdown
    if (column.key === "aircraftTypeIcao") {
      const options = acTypeOptions();
      return (
        <div className="relative flex items-center shrink-0 border-r border-hz-border/30" style={cellStyle}>
          <select
            ref={selectRef}
            value={editValue}
            onChange={(e) => {
              const opt = options.find((o) => o.icao === e.target.value);
              onEditChange(e.target.value);
              if (opt && onFieldWire) onFieldWire("aircraftTypeId", opt.value);
              setTimeout(onCommit, 0);
            }}
            onKeyDown={handleKeyDown}
            onBlur={onCommit}
            className="absolute inset-0 w-full h-full px-1 text-[13px] bg-white dark:bg-hz-card outline-none border-2 border-module-accent text-hz-text"
            style={{ textAlign: column.align }}
          >
            <option value="">—</option>
            {options.map((o) => (
              <option key={o.value} value={o.icao}>{o.icao}</option>
            ))}
          </select>
        </div>
      );
    }

    // Service Type dropdown
    if (column.type === "select" && column.key === "serviceType") {
      const options = svcOptions();
      return (
        <div className="relative flex items-center shrink-0 border-r border-hz-border/30" style={cellStyle}>
          <select
            ref={selectRef}
            value={editValue}
            onChange={(e) => { onEditChange(e.target.value); setTimeout(onCommit, 0); }}
            onKeyDown={handleKeyDown}
            onBlur={onCommit}
            className="absolute inset-0 w-full h-full px-1 text-[13px] bg-white dark:bg-hz-card outline-none border-2 border-module-accent text-hz-text"
            style={{ textAlign: column.align }}
          >
            <option value="">—</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.value}</option>
            ))}
          </select>
        </div>
      );
    }

    // Standard text/time/date input
    return (
      <div className="relative flex items-center shrink-0 border-r border-hz-border/30" style={cellStyle}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          maxLength={column.maxLength}
          onChange={(e) => {
            let v = e.target.value;
            if (column.key === "depStation" || column.key === "arrStation" || column.key === "flightNumber") {
              v = v.toUpperCase();
            }
            onEditChange(v);
          }}
          onKeyDown={handleKeyDown}
          onBlur={onCommit}
          className="absolute inset-0 w-full h-full px-1 text-[13px] bg-white dark:bg-hz-card outline-none border-2 border-module-accent text-hz-text"
          style={{ textAlign: column.align, fontFamily: cellStyle.fontFamily }}
        />
      </div>
    );
  }

  // ── Display mode ──
  return (
    <div
      className={`flex items-center shrink-0 border-r border-hz-border/30 px-1 text-[13px] cursor-default select-none transition-colors ${
        isSelected
          ? "bg-module-accent/10 outline outline-2 outline-module-accent -outline-offset-2"
          : isDirty
            ? "bg-[rgba(255,136,0,0.06)]"
            : ""
      }`}
      style={cellStyle}
      onClick={onSelect}
      onDoubleClick={() => column.editable && onStartEdit()}
    >
      <span
        className="w-full truncate"
        style={{
          color: fmt?.textColor ?? (column.key === "flightNumber" ? "#E63535" : statusColor),
          fontWeight: fmt?.bold ? 700 : (column.key === "flightNumber" || statusColor ? 600 : undefined),
          fontStyle: fmt?.italic ? "italic" : undefined,
          textDecoration: fmt?.underline ? "underline" : undefined,
          fontFamily: fmt?.fontFamily ? (fmt.fontFamily === "Mono" ? cellStyle.fontFamily : fmt.fontFamily) : undefined,
          fontSize: fmt?.fontSize ? `${fmt.fontSize}px` : undefined,
          textTransform: column.key === "status" ? "capitalize" : undefined,
          backgroundColor: fmt?.bgColor ?? undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
});
