"use client";

import { memo } from "react";
import type { CrewGroupRef } from "@skyhub/api";
import { Search, Plus, Users } from "lucide-react";
import { accentTint } from "@skyhub/ui/theme";
import { ACCENT } from "./crew-groups-shell";

interface Props {
  groups: CrewGroupRef[];
  totalCount: number;
  selected: CrewGroupRef | null;
  onSelect: (g: CrewGroupRef) => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
  onAddClick: () => void;
}

export const CrewGroupList = memo(function CrewGroupList({
  groups, totalCount, selected, onSelect, search, onSearchChange, loading, onAddClick,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold">Crew Groups</h2>
            <span className="text-[11px] text-hz-text-secondary">
              {totalCount} group{totalCount !== 1 ? "s" : ""}
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
          <input type="text" placeholder="Search groups..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No groups found</div>
        ) : (
          <div className="space-y-0.5">
            {groups.map((g, i) => {
              const isSel = selected?._id === g._id;
              return (
                <button key={g._id} onClick={() => onSelect(g)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                    isSel
                      ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                      : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                  }`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: accentTint(ACCENT, isSel ? 0.15 : 0.08) }}>
                    <Users size={14} color={ACCENT} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[13px] font-medium ${isSel ? "font-semibold" : ""}`}>
                        {g.name}
                      </span>
                      {!g.isActive && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    {g.description && (
                      <span className="text-[11px] text-hz-text-secondary truncate block">
                        {g.description}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-hz-text-tertiary shrink-0">
                    #{i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
