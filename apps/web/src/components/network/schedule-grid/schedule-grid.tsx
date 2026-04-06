"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScheduledFlightRef } from "@skyhub/api";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { ROW_HEIGHT, TOTAL_WIDTH } from "./grid-columns";
import { useGridKeyboard } from "./use-grid-keyboard";
import { useGridSortStore, sortRows } from "./use-grid-sort";

interface ScheduleGridProps {
  rows: ScheduledFlightRef[];
  onSave: () => void;
  onAddFlight: () => void;
  onDeleteFlight: (rowIdx: number) => void;
}

export function ScheduleGrid({ rows, onSave, onAddFlight, onDeleteFlight }: ScheduleGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedCell = useScheduleGridStore((s) => s.selectedCell);
  const newRows = useScheduleGridStore((s) => s.newRows);
  const handleKeyDown = useGridKeyboard({ onSave, onAddFlight, onDeleteFlight });

  // Sorting
  const sortKey = useGridSortStore((s) => s.sortKey);
  const sortDir = useGridSortStore((s) => s.sortDir);

  // Column filters
  const [columnFilters, setColumnFilters] = useState<Map<string, Set<string>>>(new Map());

  const handleApplyFilter = useCallback((colKey: string, values: Set<string>) => {
    setColumnFilters((prev) => {
      const next = new Map(prev);
      // If all values selected, remove the filter
      const allValues = new Set<string>();
      for (const row of rows) {
        const v = (row as any)[colKey];
        if (v != null && v !== "") allValues.add(String(v));
      }
      if (values.size >= allValues.size) {
        next.delete(colKey);
      } else {
        next.set(colKey, values);
      }
      return next;
    });
  }, [rows]);

  // Apply filters then sort
  const processedRows = useMemo(() => {
    let result = [...rows, ...newRows];

    // Apply column filters
    for (const [colKey, allowedValues] of columnFilters) {
      result = result.filter((row) => {
        const v = (row as any)[colKey];
        return v != null && allowedValues.has(String(v));
      });
    }

    // Apply sort
    return sortRows(result, sortKey, sortDir);
  }, [rows, newRows, columnFilters, sortKey, sortDir]);

  const virtualizer = useVirtualizer({
    count: processedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  });

  // Scroll selected cell into view
  useEffect(() => {
    if (selectedCell && parentRef.current) {
      virtualizer.scrollToIndex(selectedCell.rowIdx, { align: "auto" });
    }
  }, [selectedCell, virtualizer]);

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto bg-hz-card border border-hz-border rounded-lg focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ contain: "strict" }}
    >
      <div style={{ minWidth: TOTAL_WIDTH + 40 }}>
        {/* Frozen header with sort + filter */}
        <GridHeader
          scrollLeft={0}
          rows={rows}
          columnFilters={columnFilters}
          onApplyFilter={handleApplyFilter}
        />

        {/* Virtualized body */}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = processedRows[vRow.index];
            if (!row) return null;
            return (
              <GridRow
                key={row._id}
                row={row}
                rowIdx={vRow.index}
                style={{
                  position: "absolute",
                  top: vRow.start,
                  left: 0,
                  width: "100%",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
