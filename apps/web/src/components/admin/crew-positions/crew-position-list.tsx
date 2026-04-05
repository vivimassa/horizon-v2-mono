"use client";

import { useState, memo } from "react";
import type { CrewPositionRef } from "@skyhub/api";
import { Search, Plus, ChevronRight, Shield } from "lucide-react";
import { ACCENT } from "./crew-positions-shell";

interface CrewPositionListProps {
  groups: [string, CrewPositionRef[]][];
  totalCount: number;
  selected: CrewPositionRef | null;
  onSelect: (p: CrewPositionRef) => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
  onAddClick: () => void;
}

export const CrewPositionList = memo(function CrewPositionList({
  groups, totalCount, selected, onSelect, search, onSearchChange, loading, onAddClick,
}: CrewPositionListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold">Crew Positions</h2>
            <span className="text-[11px] text-hz-text-secondary">
              {totalCount} position{totalCount !== 1 ? "s" : ""}
            </span>
          </div>
          <button onClick={onAddClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: ACCENT }}>
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input type="text" placeholder="Search code, name..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No positions found</div>
        ) : (
          groups.map(([category, items]) => (
            <div key={category}>
              <button onClick={() => toggle(category)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors">
                <ChevronRight className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${!collapsed.has(category) ? "rotate-90" : ""}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-hz-text-secondary/70">{category}</span>
                <span className="text-[10px] text-hz-text-secondary/40">({items.length})</span>
                <div className="flex-1 h-px bg-hz-border/50 ml-1" />
              </button>
              {!collapsed.has(category) && (
                <div className="space-y-0.5">
                  {items.map((p) => {
                    const isSel = selected?._id === p._id;
                    return (
                      <button key={p._id} onClick={() => onSelect(p)}
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSel
                            ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                            : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                        } ${!p.isActive ? "opacity-40" : ""}`}>
                        {/* Color dot + Code */}
                        <span className="flex items-center gap-1.5 w-12 shrink-0">
                          {p.color && (
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          )}
                          <span className="text-[14px] font-bold font-mono" style={{ color: p.isActive ? ACCENT : undefined }}>
                            {p.code}
                          </span>
                        </span>
                        {/* Name + rank */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">{p.name}</div>
                          <div className="text-[11px] text-hz-text-secondary">Rank {p.rankOrder}</div>
                        </div>
                        {/* PIC badge */}
                        {p.isPic && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            <Shield className="h-3 w-3" /> PIC
                          </span>
                        )}
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
});
