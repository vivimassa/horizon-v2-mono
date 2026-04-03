"use client";

import type { StationFlight } from "./types";

interface KpiStripProps {
  flights: StationFlight[];
  accent: string;
  isDark: boolean;
  glass: { panel: string; panelBorder: string; panelShadow: string };
}

export function KpiStrip({ flights, accent, isDark, glass }: KpiStripProps) {
  const boarding = flights.filter((f) => f.status === "boarding").length;
  const loading = flights.filter((f) => f.phase === "loading").length;
  const delayed = flights.filter((f) => f.status === "delayed").length;
  const departed = flights.filter((f) => f.status === "departed").length;

  const kpis = [
    { value: String(flights.length), label: "Total Flights", accent: true, warn: false },
    { value: String(boarding), label: "Boarding Now", accent: true, warn: false },
    { value: String(loading), label: "Loading", accent: true, warn: false },
    { value: String(delayed), label: "Delayed", accent: false, warn: delayed > 0 },
    { value: String(departed), label: "Departed", accent: false, warn: false },
    { value: "87%", label: "OTP", accent: true, warn: false },
  ];

  return (
    <div className="flex gap-2" style={{ padding: "8px 16px 4px" }}>
      {kpis.map((k) => (
        <div
          key={k.label}
          className="relative flex-1 overflow-hidden"
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            background: glass.panel,
            backdropFilter: "blur(16px)",
            border: `1px solid ${glass.panelBorder}`,
            boxShadow: glass.panelShadow,
          }}
        >
          <div
            className="absolute top-0 left-0 right-0"
            style={{
              height: 2.5,
              borderRadius: "2px 2px 0 0",
              background: k.warn ? "#ef4444" : k.accent ? accent : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            }}
          />
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: k.warn ? "#dc2626" : k.accent ? accent : isDark ? "#f5f5f5" : "#111",
              marginTop: 1,
            }}
          >
            {k.value}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isDark ? "#888" : "#888",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginTop: 2,
            }}
          >
            {k.label}
          </div>
        </div>
      ))}
    </div>
  );
}
