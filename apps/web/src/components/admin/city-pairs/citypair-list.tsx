"use client";

import { useState } from "react";
import type { CityPairRef } from "@skyhub/api";
import { Search, ChevronRight } from "lucide-react";
import { CountryFlag } from "@/components/ui/country-flag";

const ROUTE_TYPE_LABELS: Record<string, string> = {
  domestic: "Domestic",
  regional: "Regional",
  international: "International",
  "long-haul": "Long-Haul",
  "ultra-long-haul": "Ultra Long-Haul",
  unknown: "Unclassified",
};

interface CityPairListProps {
  groups: [string, CityPairRef[]][];
  totalCount: number;
  filteredCount: number;
  selected: CityPairRef | null;
  onSelect: (cp: CityPairRef) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
}

export function CityPairList({
  groups,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
}: CityPairListProps) {
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
          <h2 className="text-[15px] font-bold">City Pairs</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder="Search IATA, ICAO, city, route type…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No city pairs found</div>
        ) : (
          groups.map(([routeType, pairs]) => (
            <div key={routeType}>
              <button
                onClick={() => toggleGroup(routeType)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${
                    !collapsed.has(routeType) ? "rotate-90" : ""
                  }`}
                />
                <span className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary/70">
                  {ROUTE_TYPE_LABELS[routeType] ?? routeType}
                </span>
                <span className="text-[11px] text-hz-text-secondary/40">({pairs.length})</span>
                <div className="flex-1 h-px bg-hz-border/50 ml-1" />
              </button>
              {!collapsed.has(routeType) && (
                <div className="space-y-0.5">
                  {pairs.map((cp) => {
                    const isSelected = selected?._id === cp._id;
                    const label1 = cp.station1Iata || cp.station1Icao;
                    const label2 = cp.station2Iata || cp.station2Icao;
                    return (
                      <button
                        key={cp._id}
                        onClick={() => onSelect(cp)}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSelected
                            ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                            : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                        }`}
                      >
                        {/* Route codes */}
                        <span className={`text-[13px] font-bold shrink-0 ${isSelected ? "text-module-accent" : "text-hz-text-secondary"}`}>
                          {label1}
                        </span>
                        <span className="text-[11px] text-hz-text-secondary/50">↔</span>
                        <span className={`text-[13px] font-bold shrink-0 ${isSelected ? "text-module-accent" : "text-hz-text-secondary"}`}>
                          {label2}
                        </span>
                        {/* Cities */}
                        <div className="min-w-0 flex-1 ml-1">
                          <div className="text-[12px] text-hz-text-secondary truncate">
                            {cp.station1City && cp.station2City
                              ? `${cp.station1City} – ${cp.station2City}`
                              : cp.station1Name && cp.station2Name
                                ? `${cp.station1Name.split(' ')[0]} – ${cp.station2Name.split(' ')[0]}`
                                : ""}
                          </div>
                        </div>
                        {/* Distance */}
                        {cp.distanceNm && (
                          <span className="text-[10px] text-hz-text-secondary/50 tabular-nums shrink-0">
                            {cp.distanceNm.toLocaleString()} nm
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
}
