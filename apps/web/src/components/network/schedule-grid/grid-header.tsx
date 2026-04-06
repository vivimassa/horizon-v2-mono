"use client";

import { GRID_COLUMNS, HEADER_HEIGHT } from "./grid-columns";

interface GridHeaderProps {
  scrollLeft: number;
}

export function GridHeader({ scrollLeft }: GridHeaderProps) {
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

      {GRID_COLUMNS.map((col) => (
        <div
          key={col.key}
          className="flex items-center justify-center border-r border-hz-border px-1 text-[12px] font-medium uppercase tracking-wider text-hz-text-secondary cursor-default select-none hover:bg-hz-border/20 transition-colors"
          style={{ width: col.width, height: HEADER_HEIGHT }}
        >
          {col.label}
        </div>
      ))}
    </div>
  );
}
