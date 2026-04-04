"use client";

import { useState } from "react";
import type { AircraftTypeRef } from "@skyhub/api";
import { Search, Plus, ChevronRight, Plane } from "lucide-react";

interface AircraftTypeListProps {
  groups: [string, AircraftTypeRef[]][];
  categoryLabels: Record<string, string>;
  totalCount: number;
  filteredCount: number;
  selected: AircraftTypeRef | null;
  onSelect: (t: AircraftTypeRef) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  onCreateClick: () => void;
}

export function AircraftTypeList({
  groups,
  categoryLabels,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
  onCreateClick,
}: AircraftTypeListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Aircraft Types</h2>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-hz-text-secondary font-medium tabular-nums">
              {filteredCount === totalCount ? totalCount : `${filteredCount} / ${totalCount}`}
            </span>
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold text-white transition-colors"
              style={{ backgroundColor: "#1e40af" }}
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder="Search type, name, family..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No aircraft types found</div>
        ) : (
          groups.map(([category, items]) => (
            <div key={category}>
              <button
                onClick={() => toggleGroup(category)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${
                    !collapsed.has(category) ? "rotate-90" : ""
                  }`}
                />
                <Plane className="h-3.5 w-3.5 text-hz-text-secondary/50" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary/70">
                  {categoryLabels[category] || category}
                </span>
                <span className="text-[11px] text-hz-text-secondary/40">({items.length})</span>
                <div className="flex-1 h-px bg-hz-border/50 ml-1" />
              </button>
              {!collapsed.has(category) && (
                <div className="space-y-0.5">
                  {items.map((t) => {
                    const isSelected = selected?._id === t._id;
                    return (
                      <button
                        key={t._id}
                        onClick={() => onSelect(t)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSelected
                            ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                            : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold font-mono">{t.icaoType}</span>
                            <span className="text-[13px] font-medium truncate">{t.name}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
