"use client";

import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, Filter } from "lucide-react";
import { GRID_COLUMNS, HEADER_HEIGHT, CELL_BORDER, CELL_BORDER_DARK } from "./grid-columns";
import { useGridSortStore } from "./use-grid-sort";
import { ColumnFilterDropdown } from "./column-filter-dropdown";
import { useTheme } from "@/components/theme-provider";
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const border = isDark ? CELL_BORDER_DARK : CELL_BORDER;

  return (
    <thead className="sticky top-0 z-10">
      <tr style={{ height: HEADER_HEIGHT }}>
        {/* Row number column */}
        <th
          className="text-[11px] font-medium text-hz-text-tertiary bg-hz-bg select-none"
          style={{ width: "3%", border, textAlign: "center" }}
        />
        {GRID_COLUMNS.map((col) => {
          const isSorted = sortKey === col.key;
          const hasFilter = columnFilters.has(col.key);
          return (
            <th
              key={col.key}
              className={`relative text-[13px] font-semibold uppercase tracking-wider select-none cursor-pointer outline-none focus:ring-1 focus:ring-module-accent/30 focus:ring-inset ${
                isSorted ? "text-module-accent" : "text-hz-text-secondary"
              }`}
              style={{
                width: col.width,
                border,
                padding: "0 4px",
                textAlign: "center",
                whiteSpace: "nowrap",
                backgroundColor: isSorted ? (isDark ? "rgba(62,123,250,0.08)" : "rgba(30,64,175,0.06)") : undefined,
              }}
              onClick={() => setSortKey(col.key)}
            >
              {col.label}
              {isSorted && (
                <span className="ml-0.5 inline-block align-middle">
                  {sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </span>
              )}
              {/* Filter icon */}
              <button
                onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === col.key ? null : col.key); }}
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
                  hasFilter ? "text-module-accent" : "text-hz-text-tertiary/20 hover:text-hz-text-tertiary"
                }`}
              >
                <Filter size={8} />
              </button>
              {openFilter === col.key && (
                <ColumnFilterDropdown
                  colKey={col.key}
                  rows={rows}
                  activeFilters={columnFilters.get(col.key) ?? new Set()}
                  onApply={onApplyFilter}
                  onClose={() => setOpenFilter(null)}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
