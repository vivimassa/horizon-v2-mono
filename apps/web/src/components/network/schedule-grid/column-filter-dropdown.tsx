"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { ScheduledFlightRef } from "@skyhub/api";
import { Search, X } from "lucide-react";

interface ColumnFilterDropdownProps {
  colKey: string;
  rows: ScheduledFlightRef[];
  activeFilters: Set<string>;
  onApply: (colKey: string, values: Set<string>) => void;
  onClose: () => void;
}

export function ColumnFilterDropdown({ colKey, rows, activeFilters, onApply, onClose }: ColumnFilterDropdownProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(activeFilters));
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Get unique values for this column
  const uniqueValues = useMemo(() => {
    const vals = new Set<string>();
    for (const row of rows) {
      const v = (row as any)[colKey];
      if (v != null && v !== "") vals.add(String(v));
    }
    return Array.from(vals).sort();
  }, [rows, colKey]);

  const filtered = search
    ? uniqueValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : uniqueValues;

  const allSelected = filtered.every((v) => selected.has(v));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach((v) => next.delete(v));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((v) => next.add(v));
      setSelected(next);
    }
  };

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setSelected(next);
  };

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-30 w-48 rounded-xl border border-hz-border bg-hz-card shadow-lg overflow-hidden"
      style={{ animation: "bc-dropdown-in 150ms cubic-bezier(0.16,1,0.3,1)" }}
    >
      {/* Search */}
      <div className="p-2 border-b border-hz-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-hz-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter..."
            className="w-full pl-7 pr-2 py-1 rounded-lg text-[12px] border border-hz-border bg-hz-bg outline-none focus:ring-1 focus:ring-module-accent/30 text-hz-text"
            autoFocus
          />
        </div>
      </div>

      {/* Select all */}
      <div className="px-2 py-1 border-b border-hz-border/50">
        <label className="flex items-center gap-2 cursor-pointer text-[12px] text-hz-text-secondary hover:text-hz-text">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-module-accent" />
          Select All ({filtered.length})
        </label>
      </div>

      {/* Values */}
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.map((v) => (
          <label
            key={v}
            className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-[12px] text-hz-text hover:bg-hz-border/20"
          >
            <input type="checkbox" checked={selected.has(v)} onChange={() => toggle(v)} className="accent-module-accent" />
            <span className="truncate">{v}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-[12px] text-hz-text-tertiary px-2 py-2">No values</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 p-2 border-t border-hz-border">
        <button
          onClick={() => { onApply(colKey, selected); onClose(); }}
          className="flex-1 py-1 rounded-lg text-[12px] font-medium text-white bg-module-accent hover:opacity-90 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={() => { onApply(colKey, new Set(uniqueValues)); onClose(); }}
          className="px-2 py-1 rounded-lg text-[12px] text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
