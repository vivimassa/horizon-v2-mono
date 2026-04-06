"use client";

import React, { useRef, useEffect } from "react";
import type { GridColumn } from "./grid-columns";

interface GridCellProps {
  column: GridColumn;
  value: string;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
  rowIdx: number;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onNavigate: (dir: "up" | "down" | "left" | "right") => void;
  isDirty: boolean;
}

export const GridCell = React.memo(function GridCell({
  column,
  value,
  isSelected,
  isEditing,
  editValue,
  onSelect,
  onStartEdit,
  onEditChange,
  onCommit,
  onCancel,
  onNavigate,
  isDirty,
}: GridCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  // Status badge colors
  const statusColor = column.key === "status" ? {
    draft: "#E67A00",
    active: "#06C270",
    suspended: "#8F90A6",
    cancelled: "#E63535",
  }[value] : undefined;

  if (isEditing && column.editable) {
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
          color: column.key === "flightNumber" ? "#E63535" : statusColor,
          fontWeight: column.key === "flightNumber" || statusColor ? 600 : undefined,
          textTransform: column.key === "status" ? "capitalize" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
});
