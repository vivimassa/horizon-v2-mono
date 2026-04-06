"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScheduledFlightRef } from "@skyhub/api";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { ROW_HEIGHT } from "./grid-columns";
import { useGridKeyboard } from "./use-grid-keyboard";
import { useGridSortStore, sortRows } from "./use-grid-sort";
import { useTheme } from "@/components/theme-provider";

interface ScheduleGridProps {
  rows: ScheduledFlightRef[];
  onSave: () => void;
  onAddFlight: () => void;
  onDeleteFlight: (rowIdx: number) => void;
}

export function ScheduleGrid({ rows, onSave, onAddFlight, onDeleteFlight }: ScheduleGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedCell = useScheduleGridStore((s) => s.selectedCell);
  const newRows = useScheduleGridStore((s) => s.newRows);
  const handleKeyDown = useGridKeyboard({ onSave, onAddFlight, onDeleteFlight });
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Sorting + column filters
  const sortKey = useGridSortStore((s) => s.sortKey);
  const sortDir = useGridSortStore((s) => s.sortDir);
  const [columnFilters, setColumnFilters] = useState<Map<string, Set<string>>>(new Map());

  const handleApplyFilter = useCallback((colKey: string, values: Set<string>) => {
    setColumnFilters((prev) => {
      const next = new Map(prev);
      const allValues = new Set<string>();
      for (const row of rows) {
        const v = (row as any)[colKey];
        if (v != null && v !== "") allValues.add(String(v));
      }
      if (values.size >= allValues.size) next.delete(colKey);
      else next.set(colKey, values);
      return next;
    });
  }, [rows]);

  const processedRows = useMemo(() => {
    let result = [...rows, ...newRows];
    for (const [colKey, allowedValues] of columnFilters) {
      result = result.filter((row) => {
        const v = (row as any)[colKey];
        return v != null && allowedValues.has(String(v));
      });
    }
    return sortRows(result, sortKey, sortDir);
  }, [rows, newRows, columnFilters, sortKey, sortDir]);

  // Virtualization
  const virtualizer = useVirtualizer({
    count: processedRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 50,
  });

  useEffect(() => {
    if (selectedCell) virtualizer.scrollToIndex(selectedCell.rowIdx, { align: "auto" });
  }, [selectedCell, virtualizer]);

  // Attach at window level (capture phase) to intercept browser shortcuts like Ctrl+N, Ctrl+S, Ctrl+F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only intercept when grid is focused
      if (!scrollRef.current?.contains(document.activeElement) && document.activeElement !== scrollRef.current) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const key = e.key.toLowerCase();
      if (["s", "n", "f", "h", "b", "i", "u", "a"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, []);

  const glassBg = isDark ? "rgba(25,25,33,0.85)" : "rgba(255,255,255,0.85)";
  const glassBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto select-none focus:outline-none rounded-2xl"
      style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: "blur(20px)" }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <table
        className="w-full text-[13px] font-mono"
        style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
      >
        <GridHeader
          scrollLeft={0}
          rows={rows}
          columnFilters={columnFilters}
          onApplyFilter={handleApplyFilter}
        />
        <tbody>
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = processedRows[vRow.index];
            if (!row) return null;
            return (
              <GridRow
                key={row._id}
                row={row}
                rowIdx={vRow.index}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
