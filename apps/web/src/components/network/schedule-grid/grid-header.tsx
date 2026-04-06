"use client";

import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, Filter } from "lucide-react";
import { GRID_COLUMNS, HEADER_HEIGHT } from "./grid-columns";
import { useGridSortStore } from "./use-grid-sort";
import { ColumnFilterDropdown } from "./column-filter-dropdown";
import type { ScheduledFlightRef } from "@skyhub/api";

interface GridHeaderProps {
  scrollLeft: number;
  rows: ScheduledFlightRef[];
  columnFilters: Map<string, Set<string>>;
  onApplyFilter: (colKey: string, values: Set<string>) => void;
}

export function GridHeader({ scrollLeft, rows, columnFilters, onApplyFilter }: GridHeaderProps) {
  const { sortKey, sortDir, setSortKey } = useGridSortStore();
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const handleHeaderClick = useCallback((colKey: string) => {
    setSortKey(colKey);
  }, [setSortKey]);

  return (
    <div
      className="sticky top-0 z-20 flex border-b-2 border-hz-border bg-hz-bg select-none"
      style={{ height: HEADER_HEIGHT, minWidth: "max-content" }}
    >
      {/* Row number column */}
      <div
        className="flex items-center justify-center border-r border-hz-border text-[11px] font-medium text-hz-text-tertiary shrink-0"
        style={{ width: 40, height: HEADER_HEIGHT }}
      />

      {GRID_COLUMNS.map((col) => {
        const isSorted = sortKey === col.key;
        const hasFilter = columnFilters.has(col.key);

        return (
          <div
            key={col.key}
            className={`relative flex items-center justify-center border-r border-hz-border px-1 text-[12px] font-medium uppercase tracking-wider cursor-pointer select-none transition-colors ${
              isSorted ? "bg-module-accent/[0.06] text-module-accent" : "text-hz-text-secondary hover:bg-hz-border/20"
            }`}
            style={{ width: col.width, height: HEADER_HEIGHT }}
            onClick={() => handleHeaderClick(col.key)}
          >
            <span className="truncate">{col.label}</span>

            {/* Sort indicator */}
            {isSorted && (
              <span className="ml-0.5 shrink-0">
                {sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </span>
            )}

            {/* Filter icon */}
            <button
              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === col.key ? null : col.key); }}
              className={`absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
                hasFilter ? "text-module-accent" : "text-hz-text-tertiary/30 hover:text-hz-text-tertiary"
              }`}
            >
              <Filter size={9} />
            </button>

            {/* Filter dropdown */}
            {openFilter === col.key && (
              <ColumnFilterDropdown
                colKey={col.key}
                rows={rows}
                activeFilters={columnFilters.get(col.key) ?? new Set()}
                onApply={onApplyFilter}
                onClose={() => setOpenFilter(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
