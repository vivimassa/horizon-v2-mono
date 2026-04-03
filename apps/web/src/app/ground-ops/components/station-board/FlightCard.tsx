"use client";

import { memo } from "react";
import { Plane } from "lucide-react";
import type { StationFlight } from "./types";
import { STATUS_CONFIG, PHASE_CONFIG } from "./types";

interface FlightCardProps {
  flight: StationFlight;
  isSelected: boolean;
  accent: string;
  accentDark: string;
  isDark: boolean;
  onSelect: () => void;
}

export const FlightCard = memo(function FlightCard({
  flight,
  isSelected,
  accent,
  accentDark,
  isDark,
  onSelect,
}: FlightCardProps) {
  const sc = STATUS_CONFIG[flight.status];
  const ph = PHASE_CONFIG[flight.phase];

  return (
    <div
      onClick={onSelect}
      className="cursor-pointer transition-all duration-100"
      style={{
        padding: "10px 12px",
        marginBottom: 4,
        borderRadius: 10,
        border: isSelected ? `1.5px solid ${accent}` : "1.5px solid transparent",
        background: isSelected ? `${accent}08` : "transparent",
      }}
    >
      {/* Row 1: Flight + status */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 15, fontWeight: 700, color: isSelected ? accentDark : isDark ? "#f5f5f5" : "#111" }}>
            {flight.id}
          </span>
          <span style={{ fontSize: 13, color: isDark ? "#888" : "#999", fontFamily: "monospace" }}>
            {flight.type}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1"
          style={{
            fontSize: 13, fontWeight: 600,
            padding: "2px 8px", borderRadius: 20,
            background: isDark ? `${sc.dot}18` : sc.bg,
            color: isDark ? sc.dot : sc.text,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: 3, background: sc.dot }} />
          {sc.label}
        </span>
      </div>

      {/* Row 2: Route */}
      <div className="flex items-center gap-1 mb-1">
        <span style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#e5e5e5" : "#222" }}>{flight.dep}</span>
        <div className="flex-1 flex items-center">
          <div className="flex-1 h-0" style={{ borderTop: `1px dashed ${isDark ? "rgba(255,255,255,0.15)" : "#ccc"}` }} />
          <Plane size={10} strokeWidth={2} style={{ color: isDark ? "#666" : "#bbb", transform: "rotate(45deg)", margin: "0 3px" }} />
          <div className="flex-1 h-0" style={{ borderTop: `1px dashed ${isDark ? "rgba(255,255,255,0.15)" : "#ccc"}` }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#e5e5e5" : "#222" }}>{flight.arr}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#aaa" : "#555", fontVariantNumeric: "tabular-nums", marginLeft: 6 }}>
          {flight.std}
        </span>
      </div>

      {/* Row 3: Info strip */}
      <div className="flex items-center gap-2" style={{ fontSize: 13, color: isDark ? "#777" : "#999" }}>
        <span style={{ fontFamily: "monospace" }}>{flight.reg}</span>
        <span style={{ opacity: 0.5 }}>&middot;</span>
        <span>{flight.gate === "\u2014" ? "No gate" : flight.gate}</span>
        {flight.door && (
          <span style={{ fontSize: 13, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: accent, color: "#fff" }}>
            D.CL {flight.door}
          </span>
        )}
        {flight.delays.length > 0 && (
          <span style={{ fontSize: 13, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: isDark ? "rgba(239,68,68,0.15)" : "#fef2f2", color: "#dc2626" }}>
            +{flight.delays[0].mins}m
          </span>
        )}
      </div>

      {/* Row 4: Phase bar */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="flex-1 overflow-hidden" style={{ height: 3, borderRadius: 2, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
          <div style={{ height: "100%", width: `${ph.pct}%`, borderRadius: 2, background: ph.pct === 100 ? "#22c55e" : accent }} />
        </div>
        <span style={{ fontSize: 13, color: isDark ? "#666" : "#aaa", width: 56, textAlign: "right" }}>{ph.label}</span>
      </div>
    </div>
  );
});
