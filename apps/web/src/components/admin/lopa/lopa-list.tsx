"use client";

import { useState } from "react";
import type { CabinClassRef, LopaConfigRef } from "@skyhub/api";
import { Search, Plus, ChevronRight, Plane, Star } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { modeColor } from "@skyhub/ui/theme";

type ViewMode = "cabin-classes" | "lopa-configs";

interface LopaListProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  // Cabin classes
  cabinClasses: CabinClassRef[];
  cabinClassTotal: number;
  selectedClass: CabinClassRef | null;
  onSelectClass: (cc: CabinClassRef) => void;
  // LOPA configs
  configGroups: [string, LopaConfigRef[]][];
  configTotal: number;
  configFilteredCount: number;
  selectedConfig: LopaConfigRef | null;
  onSelectConfig: (lc: LopaConfigRef) => void;
  // Shared
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  onCreateClick: () => void;
}

export function LopaList({
  viewMode,
  onViewChange,
  cabinClasses,
  cabinClassTotal,
  selectedClass,
  onSelectClass,
  configGroups,
  configTotal,
  configFilteredCount,
  selectedConfig,
  onSelectConfig,
  search,
  onSearchChange,
  loading,
  onCreateClick,
}: LopaListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const isCabinMode = viewMode === "cabin-classes";
  const totalCount = isCabinMode ? cabinClassTotal : configTotal;
  const filteredCount = isCabinMode ? cabinClasses.length : configFilteredCount;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">LOPA</h2>
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

        {/* Segment toggle */}
        <div className="flex rounded-lg border border-hz-border overflow-hidden">
          <button
            onClick={() => onViewChange("cabin-classes")}
            className={`flex-1 py-1.5 text-[12px] font-semibold transition-colors ${
              isCabinMode
                ? "text-white"
                : "text-hz-text-secondary hover:text-hz-text"
            }`}
            style={isCabinMode ? { backgroundColor: "#1e40af" } : undefined}
          >
            Cabin Classes
          </button>
          <button
            onClick={() => onViewChange("lopa-configs")}
            className={`flex-1 py-1.5 text-[12px] font-semibold transition-colors ${
              !isCabinMode
                ? "text-white"
                : "text-hz-text-secondary hover:text-hz-text"
            }`}
            style={!isCabinMode ? { backgroundColor: "#1e40af" } : undefined}
          >
            Configurations
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder={isCabinMode ? "Search code or name..." : "Search aircraft type or config..."}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : isCabinMode ? (
          // ── Cabin Classes list ──
          cabinClasses.length === 0 ? (
            <div className="text-[13px] text-hz-text-secondary px-3 py-4">No cabin classes found</div>
          ) : (
            <div className="space-y-0.5">
              {cabinClasses.map((cc) => {
                const isSelected = selectedClass?._id === cc._id;
                return (
                  <button
                    key={cc._id}
                    onClick={() => onSelectClass(cc)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                      isSelected
                        ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                        : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                    }`}
                  >
                    <span
                      className="shrink-0 w-5 h-5 rounded-full border border-hz-border/50"
                      style={{ backgroundColor: modeColor(cc.color || "#9ca3af", isDark) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold font-mono">{cc.code}</span>
                        <span className="text-[13px] font-medium truncate">{cc.name}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-hz-text-tertiary font-mono shrink-0">
                      #{cc.sortOrder}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          // ── LOPA Configs list (grouped by aircraft type) ──
          configGroups.length === 0 ? (
            <div className="text-[13px] text-hz-text-secondary px-3 py-4">No configurations found</div>
          ) : (
            configGroups.map(([aircraftType, configs]) => (
              <div key={aircraftType}>
                <button
                  onClick={() => toggleGroup(aircraftType)}
                  className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
                >
                  <ChevronRight
                    className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${
                      !collapsed.has(aircraftType) ? "rotate-90" : ""
                    }`}
                  />
                  <Plane className="h-3.5 w-3.5 text-hz-text-secondary/50" />
                  <span className="text-[12px] font-bold font-mono uppercase tracking-wider text-hz-text-secondary/70">
                    {aircraftType}
                  </span>
                  <span className="text-[11px] text-hz-text-secondary/40">({configs.length})</span>
                  <div className="flex-1 h-px bg-hz-border/50 ml-1" />
                </button>
                {!collapsed.has(aircraftType) && (
                  <div className="space-y-0.5">
                    {configs.map((config) => {
                      const isSelected = selectedConfig?._id === config._id;
                      return (
                        <button
                          key={config._id}
                          onClick={() => onSelectConfig(config)}
                          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                            isSelected
                              ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                              : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium truncate">{config.configName}</span>
                              {config.isDefault && (
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="text-[12px] text-hz-text-secondary truncate">
                              {config.totalSeats} seats · {config.cabins.length} cabin{config.cabins.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
