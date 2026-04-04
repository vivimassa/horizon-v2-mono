"use client";

import { useState } from "react";
import type { AirportRef } from "@skyhub/api";
import { Search, ChevronRight } from "lucide-react";

interface AirportListProps {
  groups: [string, AirportRef[]][];
  totalCount: number;
  filteredCount: number;
  selected: AirportRef | null;
  onSelect: (airport: AirportRef) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
}

export function AirportList({
  groups,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
}: AirportListProps) {
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
          <h2 className="text-[15px] font-bold">Airports</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder="Search IATA, ICAO, name, city…"
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
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No airports found</div>
        ) : (
          groups.map(([country, airports]) => (
            <div key={country}>
              <button
                onClick={() => toggleGroup(country)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${
                    !collapsed.has(country) ? "rotate-90" : ""
                  }`}
                />
                <span className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary/70">{country}</span>
                <span className="text-[11px] text-hz-text-secondary/40">({airports.length})</span>
                <div className="flex-1 h-px bg-hz-border/50 ml-1" />
              </button>
              {!collapsed.has(country) && (
                <div className="space-y-0.5">
                  {airports.map((airport) => {
                    const isSelected = selected?._id === airport._id;
                    return (
                      <button
                        key={airport._id}
                        onClick={() => onSelect(airport)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSelected
                            ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                            : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                        }`}
                      >
                        <span className={`text-[13px] font-bold shrink-0 w-8 ${isSelected ? "text-module-accent" : "text-hz-text-secondary"}`}>
                          {airport.iataCode ?? "—"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium truncate">{airport.name}</div>
                          <div className="text-[12px] text-hz-text-secondary truncate">{airport.city}</div>
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
