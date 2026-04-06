"use client";

import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScheduledFlightRef } from "@skyhub/api";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { ROW_HEIGHT, TOTAL_WIDTH } from "./grid-columns";
import { useGridKeyboard } from "./use-grid-keyboard";

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

  const allRows = [...rows, ...newRows];

  const virtualizer = useVirtualizer({
    count: allRows.length,
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
        {/* Frozen header */}
        <GridHeader scrollLeft={0} />

        {/* Virtualized body */}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = allRows[vRow.index];
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
