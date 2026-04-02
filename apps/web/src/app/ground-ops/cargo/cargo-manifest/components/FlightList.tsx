"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, ChevronUp, Plane } from "lucide-react";
import type { CargoFlight, CargoHold } from "@/types/cargo";
import type { Palette as PaletteType } from "@skyhub/ui/theme";
import { CargoDetails } from "./CargoDetails";

interface FlightListProps {
  flights: CargoFlight[];
  selectedId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  accent: string;
  palette: PaletteType;
  isDark: boolean;
  selectedFlight: CargoFlight;
  currentHold: CargoHold;
  allHolds: Record<string, CargoHold>;
  totalWeight: number;
  totalCapacity: number;
  cgMac: number;
  dockCount: number;
}

export function FlightList({
  flights,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  accent,
  palette,
  isDark,
  selectedFlight,
  currentHold,
  allHolds,
  totalWeight,
  totalCapacity,
  cgMac,
  dockCount,
}: FlightListProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasSelection = selectedId !== "";

  const pickFlight = (id: string) => {
    onSelect(id);
    setShowDropdown(false);
    onSearchChange("");
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    loading: { bg: accent, text: "#fff" },
    scheduled: { bg: isDark ? "rgba(107,114,128,0.15)" : "#f3f4f6", text: isDark ? "#9ca3af" : "#6b7280" },
    onTime: { bg: isDark ? "rgba(22,163,74,0.15)" : "#dcfce7", text: isDark ? "#4ade80" : "#166534" },
    delayed: { bg: isDark ? "rgba(220,38,38,0.15)" : "#fee2e2", text: isDark ? "#f87171" : "#991b1b" },
    cancelled: { bg: isDark ? "rgba(220,38,38,0.15)" : "#fee2e2", text: isDark ? "#f87171" : "#991b1b" },
  };

  // ── Collapsed: minimal flight card at bottom ──
  if (hasSelection && !expanded) {
    return (
      <div
        className="rounded-xl overflow-hidden cursor-pointer"
        onClick={() => setExpanded(true)}
        style={{
          background: isDark ? "rgba(20,20,24,0.75)" : "rgba(255,255,255,0.6)",
          backdropFilter: "blur(20px)",
          color: isDark ? "#f5f5f5" : palette.text,
          padding: "12px 14px",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)"}`,
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.4)"
            : "0 8px 32px rgba(0,0,0,0.08)",
        }}
      >
        {/* Expand hint at top */}
        <div className="flex items-center justify-center -mt-1 mb-1.5" style={{ opacity: 0.7 }}>
          <ChevronUp size={16} strokeWidth={2.5} style={{ color: palette.text }} />
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[16px] font-bold" style={{ color: palette.text }}>{selectedFlight.id}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${accent}20`, color: accent }}>
            {selectedFlight.status.charAt(0).toUpperCase() + selectedFlight.status.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[15px] font-semibold" style={{ color: palette.text }}>{selectedFlight.dep}</span>
          <div className="flex-1 flex items-center gap-1">
            <div className="flex-1 h-px" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} 0, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} 4px, transparent 4px, transparent 8px)` }} />
            <Plane size={13} strokeWidth={2} style={{ color: palette.textTertiary, transform: "rotate(45deg)" }} />
            <div className="flex-1 h-px" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} 0, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} 4px, transparent 4px, transparent 8px)` }} />
          </div>
          <span className="text-[15px] font-semibold" style={{ color: palette.text }}>{selectedFlight.arr}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]" style={{ color: palette.textTertiary }}>
          <span>{selectedFlight.std} — {selectedFlight.sta}</span>
          <span>{selectedFlight.aircraftType} &middot; {selectedFlight.tailNumber}</span>
        </div>
      </div>
    );
  }

  // ── Expanded: full panel growing upward ──
  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        maxHeight: "100%",
        background: isDark ? "rgba(20,20,24,0.85)" : "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)"}`,
        boxShadow: isDark
          ? "0 8px 32px rgba(0,0,0,0.4)"
          : "0 8px 32px rgba(0,0,0,0.08)",
        animation: "panel-expand-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Collapse button */}
      {hasSelection && (
        <div className="flex items-center justify-between px-3 pt-2.5 pb-0">
          <span className="text-[11px] font-semibold uppercase" style={{ color: palette.textTertiary, letterSpacing: "0.5px" }}>
            Cargo Details
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
            }}
          >
            <ChevronDown size={14} strokeWidth={2.5} style={{ color: palette.text }} />
          </button>
        </div>
      )}

      {/* Flight picker */}
      <div className="px-3 pt-2 pb-2 relative" ref={dropdownRef}>
        <div>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}`,
            }}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Search size={13} strokeWidth={2} style={{ color: palette.textTertiary }} />
            {showDropdown ? (
              <input
                type="text"
                placeholder="Search flights..."
                value={searchQuery}
                onChange={(e) => { e.stopPropagation(); onSearchChange(e.target.value); }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-transparent text-[12px] outline-none placeholder:opacity-50"
                style={{ color: palette.text }}
                autoFocus
              />
            ) : (
              <span className="flex-1 text-[12px] font-semibold" style={{ color: hasSelection ? palette.text : palette.textTertiary }}>
                {hasSelection ? selectedFlight.id : "Select flight..."}
              </span>
            )}
            <ChevronDown
              size={12}
              style={{
                color: palette.textTertiary,
                transform: showDropdown ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </div>
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            className="absolute left-3 right-3 rounded-lg overflow-hidden z-10"
            style={{
              top: "100%",
              marginTop: -4,
              background: isDark ? "rgba(30,30,34,0.95)" : "#ffffff",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {flights.map((f) => {
              const sc = STATUS_COLORS[f.status] ?? STATUS_COLORS.scheduled;
              return (
                <button
                  key={f.id}
                  onClick={() => pickFlight(f.id)}
                  className="w-full text-left px-3 py-2 flex items-center gap-2"
                  style={{
                    background: f.id === selectedId
                      ? isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"
                      : "transparent",
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold" style={{ color: palette.text }}>{f.id}</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>
                        {f.status.charAt(0).toUpperCase() + f.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px]" style={{ color: palette.textSecondary }}>{f.dep}</span>
                      <Plane size={8} style={{ color: palette.textTertiary, transform: "rotate(45deg)" }} />
                      <span className="text-[10px]" style={{ color: palette.textSecondary }}>{f.arr}</span>
                      <span className="text-[10px] ml-auto" style={{ color: palette.textTertiary }}>{f.aircraftType}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {flights.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-[11px]" style={{ color: palette.textTertiary }}>No flights found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected flight + cargo details */}
      {hasSelection && (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {/* Flight summary card */}
          <div
            className="rounded-lg mb-2"
            style={{
              padding: "10px 12px",
              background: accent,
              color: "#ffffff",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[15px] font-bold">{selectedFlight.id}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                {selectedFlight.status.charAt(0).toUpperCase() + selectedFlight.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[14px] font-semibold">{selectedFlight.dep}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-px" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 4px, transparent 4px, transparent 8px)" }} />
                <Plane size={12} strokeWidth={2} style={{ color: "rgba(255,255,255,0.6)", transform: "rotate(45deg)" }} />
                <div className="flex-1 h-px" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 4px, transparent 4px, transparent 8px)" }} />
              </div>
              <span className="text-[14px] font-semibold">{selectedFlight.arr}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]" style={{ opacity: 0.7 }}>
              <span>{selectedFlight.std} — {selectedFlight.sta}</span>
              <span>{selectedFlight.aircraftType} &middot; {selectedFlight.tailNumber}</span>
            </div>
          </div>

          {/* KPI stats */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {[
              { label: "Total Load", value: `${totalCapacity > 0 ? Math.round((totalWeight / totalCapacity) * 100) : 0}%`, highlight: true },
              { label: "Weight", value: `${totalWeight.toLocaleString()} kg` },
              { label: "CG MAC", value: `${cgMac}%` },
              { label: "Dock Queue", value: String(dockCount) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-lg"
                style={{
                  padding: "6px 10px",
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}`,
                }}
              >
                <div className="text-[14px] font-bold" style={{ color: kpi.highlight ? accent : palette.text }}>
                  {kpi.value}
                </div>
                <div className="text-[8px] font-semibold uppercase" style={{ color: palette.textTertiary, letterSpacing: "0.3px" }}>
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>

          <CargoDetails
            flight={selectedFlight}
            allHolds={allHolds}
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        </div>
      )}

      {/* Empty state */}
      {!hasSelection && (
        <div className="flex-1 flex items-center justify-center px-3 pb-4">
          <div className="text-center">
            <Plane size={28} strokeWidth={1.2} style={{ color: palette.textTertiary, margin: "0 auto 8px" }} />
            <p className="text-[12px] font-medium" style={{ color: palette.textSecondary }}>Select a flight</p>
            <p className="text-[10px] mt-0.5" style={{ color: palette.textTertiary }}>Use search or arrows above</p>
          </div>
        </div>
      )}
    </div>
  );
}
