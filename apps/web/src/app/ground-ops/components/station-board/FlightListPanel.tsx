"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { StationFlight } from "./types";
import { FlightCard } from "./FlightCard";

interface FlightListPanelProps {
  flights: StationFlight[];
  selectedId: string | null;
  onSelect: (flight: StationFlight) => void;
  accent: string;
  accentDark: string;
  isDark: boolean;
  glass: { panel: string; panelBorder: string; panelShadow: string; input: string; inputBorder: string };
}

export function FlightListPanel({
  flights,
  selectedId,
  onSelect,
  accent,
  accentDark,
  isDark,
  glass,
}: FlightListPanelProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return flights;
    const q = search.toLowerCase();
    return flights.filter(
      (f) =>
        f.id.toLowerCase().includes(q) ||
        f.dep.toLowerCase().includes(q) ||
        f.arr.toLowerCase().includes(q) ||
        f.reg.toLowerCase().includes(q)
    );
  }, [flights, search]);

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: 320,
        flexShrink: 0,
        background: glass.panel,
        backdropFilter: "blur(20px)",
        borderRadius: 14,
        border: `1px solid ${glass.panelBorder}`,
        boxShadow: glass.panelShadow,
      }}
    >
      {/* Header + search */}
      <div style={{ padding: "10px 12px 6px" }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? "#f5f5f5" : "#111" }}>
            Flights Today
          </span>
          <span style={{ fontSize: 13, color: isDark ? "#777" : "#999" }}>
            {flights.length} flights
          </span>
        </div>
        <div
          className="flex items-center gap-1.5"
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            background: glass.input,
            border: `1px solid ${glass.inputBorder}`,
          }}
        >
          <Search size={12} strokeWidth={2} style={{ color: isDark ? "#666" : "#999" }} />
          <input
            type="text"
            placeholder="Search flights..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:opacity-50"
            style={{ color: isDark ? "#e5e5e5" : "#333" }}
          />
        </div>
      </div>

      {/* Flight cards */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "0 8px 8px" }}>
        {filtered.map((f) => (
          <FlightCard
            key={f.id}
            flight={f}
            isSelected={f.id === selectedId}
            accent={accent}
            accentDark={accentDark}
            isDark={isDark}
            onSelect={() => onSelect(f)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center">
            <p style={{ fontSize: 13, color: isDark ? "#666" : "#999" }}>No flights found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "7px 12px",
          borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
        }}
      >
        <span style={{ fontSize: 13, color: isDark ? "#666" : "#999" }}>Auto-refresh 30s</span>
        <div className="flex gap-1">
          {["Filter", "Export"].map((label) => (
            <button
              key={label}
              className="cursor-pointer"
              style={{
                padding: "3px 8px",
                borderRadius: 5,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.5)",
                fontSize: 13,
                color: isDark ? "#aaa" : "#555",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
