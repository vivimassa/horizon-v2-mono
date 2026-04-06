"use client";

import { useState } from "react";
import type { AircraftRegistrationRef } from "@skyhub/api";
import { Search, Plus, ChevronRight, Plane } from "lucide-react";

const STATUS_DOT_COLOR: Record<string, string> = {
  active: "#06C270",
  maintenance: "#E67A00",
  stored: "#9ca3af",
  retired: "#E63535",
};

interface AircraftRegistrationListProps {
  groups: [string, AircraftRegistrationRef[]][];
  totalCount: number;
  filteredCount: number;
  selected: AircraftRegistrationRef | null;
  onSelect: (r: AircraftRegistrationRef) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  onCreateClick: () => void;
}

export function AircraftRegistrationList({
  groups,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
  onCreateClick,
}: AircraftRegistrationListProps) {
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
          <h2 className="text-[16px] font-bold">Registrations</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold text-white transition-colors bg-module-accent"
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
            placeholder="Search registration, MSN..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
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
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No registrations found</div>
        ) : (
          groups.map(([icaoType, items]) => (
            <div key={icaoType}>
              <button
                onClick={() => toggleGroup(icaoType)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${
                    !collapsed.has(icaoType) ? "rotate-90" : ""
                  }`}
                />
                <Plane className="h-3.5 w-3.5 text-hz-text-secondary/50" />
                <span className="text-[12px] font-bold font-mono uppercase tracking-wider text-hz-text-secondary/70">
                  {icaoType}
                </span>
                <span className="text-[13px] text-hz-text-secondary/40">({items.length})</span>
                <div className="flex-1 h-px bg-hz-border/50 ml-1" />
              </button>
              {!collapsed.has(icaoType) && (
                <div className="space-y-0.5">
                  {items.map((r) => {
                    const isSelected = selected?._id === r._id;
                    return (
                      <button
                        key={r._id}
                        onClick={() => onSelect(r)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSelected
                            ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                            : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOT_COLOR[r.status] || "#9ca3af" }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold font-mono">{r.registration}</span>
                            {r.variant && (
                              <span className="text-[12px] text-hz-text-secondary truncate">{r.variant}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[13px] text-hz-text-tertiary capitalize shrink-0">
                          {r.status}
                        </span>
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
