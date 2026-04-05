"use client";

import type { AircraftTypeRef, CrewComplementRef } from "@skyhub/api";
import { BedDouble, Plus, Plane } from "lucide-react";
import { ACCENT } from "./crew-complements-shell";

interface Props {
  aircraftTypes: AircraftTypeRef[];
  byType: Map<string, CrewComplementRef[]>;
  selectedType: string | null;
  onSelect: (icaoType: string) => void;
  loading: boolean;
}

export function CrewComplementTypeList({
  aircraftTypes,
  byType,
  selectedType,
  onSelect,
  loading,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-hz-border shrink-0">
        <h2 className="text-[15px] font-bold text-hz-text">Aircraft Types</h2>
        <p className="text-[11px] text-hz-text-tertiary mt-0.5">
          Select a type to configure crew complements
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">
            Loading...
          </div>
        ) : aircraftTypes.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">
            No aircraft types found
          </div>
        ) : (
          aircraftTypes.map((t) => {
            const rows = byType.get(t.icaoType) ?? [];
            const hasData = rows.length > 0;
            const hasRest =
              t.crewRest?.cockpitClass != null ||
              t.crewRest?.cabinClass != null;
            const restPositions =
              (t.crewRest?.cockpitPositions ?? 0) +
              (t.crewRest?.cabinPositions ?? 0);
            const isSelected = t.icaoType === selectedType;

            return (
              <button
                key={t.icaoType}
                onClick={() => onSelect(t.icaoType)}
                className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-left transition-all duration-150 ${
                  isSelected
                    ? "border-l-[3px] border-l-[#7c3aed] bg-[#7c3aed]/[0.08]"
                    : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                } ${!hasData ? "opacity-50" : ""}`}
              >
                <span
                  className={`shrink-0 font-mono font-bold text-[11px] px-1.5 py-0.5 rounded tabular-nums ${
                    isSelected
                      ? "text-white"
                      : "bg-hz-border/40 text-hz-text-secondary"
                  }`}
                  style={
                    isSelected ? { backgroundColor: ACCENT } : undefined
                  }
                >
                  {t.icaoType}
                </span>
                <span className="flex-1 min-w-0 truncate text-[13px] text-hz-text">
                  {t.name}
                </span>
                {hasData && hasRest && (
                  <span className="shrink-0 flex items-center gap-0.5 text-[11px] text-violet-500 tabular-nums">
                    {restPositions > 0 && restPositions}
                    <BedDouble className="h-3 w-3" />
                  </span>
                )}
                {!hasData && (
                  <Plus className="h-3 w-3 shrink-0 text-hz-text-tertiary" />
                )}
                {hasData && !hasRest && (
                  <span className="text-[10px] text-hz-text-tertiary">
                    {rows.length}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="px-3 py-2.5 border-t border-hz-border shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-hz-text-tertiary">
          <BedDouble className="h-3 w-3 text-violet-500" />
          <span>= rest facility configured</span>
        </div>
      </div>
    </div>
  );
}
