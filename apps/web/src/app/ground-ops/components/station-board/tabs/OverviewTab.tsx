"use client";

import { AlertTriangle, Check } from "lucide-react";
import type { StationFlight } from "../types";
import { HOLD_DATA, ZONE_DATA, WEIGHT_DATA } from "../data/mock-data";

interface OverviewTabProps {
  flight: StationFlight;
  accent: string;
  isDark: boolean;
  glass: { panel: string; panelBorder: string };
}

export function OverviewTab({ flight, accent, isDark, glass }: OverviewTabProps) {
  const textPrimary = isDark ? "#f5f5f5" : "#111";
  const textSec = isDark ? "#aaa" : "#555";
  const textMuted = isDark ? "#777" : "#888";
  const subtleBg = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
  const subtleBorder = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";

  const stats = [
    { v: `${flight.pax.onboard}/${flight.pax.booked}`, l: "PASSENGERS", a: false },
    { v: "5,500 kg", l: "BAGS", a: false },
    { v: `${flight.cargo.loaded.toLocaleString()} kg`, l: "CARGO", a: false },
    { v: "120 kg", l: "MAIL", a: false },
    { v: "8,460 kg", l: "TOTAL DEADLOAD", a: true },
  ];

  return (
    <div className="flex flex-col h-full" style={{ padding: 16, overflow: "hidden" }}>
      {/* Top stats — fixed height */}
      <div className="flex gap-2 shrink-0 mb-4">
        {stats.map((s) => (
          <div
            key={s.l}
            className="relative flex-1 overflow-hidden"
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: glass.panel,
              backdropFilter: "blur(16px)",
              border: `1px solid ${glass.panelBorder}`,
            }}
          >
            <div
              className="absolute top-0 left-0 right-0"
              style={{
                height: 2.5,
                borderRadius: "2px 2px 0 0",
                background: s.a ? accent : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
              }}
            />
            <div style={{ fontSize: 18, fontWeight: 700, color: s.a ? accent : textPrimary, marginTop: 2 }}>
              {s.v}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column body — fills remaining height */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* Left: Compartments + Zones */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{
            background: glass.panel,
            backdropFilter: "blur(16px)",
            borderRadius: 12,
            padding: 18,
            border: `1px solid ${glass.panelBorder}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
            By Compartment
          </div>
          {HOLD_DATA.map((h) => (
            <div key={h.name} className="flex items-center gap-3 mb-3">
              <span style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#ccc" : "#333", width: 80 }}>{h.name}</span>
              <div className="flex-1 overflow-hidden" style={{ height: 8, borderRadius: 4, background: subtleBg }}>
                <div style={{ height: "100%", width: `${h.pct}%`, borderRadius: 4, background: accent, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: textSec, width: 100, textAlign: "right" }}>
                {h.weight.toLocaleString()}/{h.capacity.toLocaleString()}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: accent, width: 40, textAlign: "right" }}>{h.pct}%</span>
            </div>
          ))}

          <div style={{ fontSize: 14, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 14 }}>
            By Zone (Pax)
          </div>
          <div className="flex-1">
            {ZONE_DATA.map((z) => (
              <div key={z.zone} className="flex items-center gap-3 mb-2" style={{ fontSize: 14, color: textSec }}>
                <span style={{ fontWeight: 600, width: 58 }}>Zone {z.zone}</span>
                <span style={{ color: textMuted, width: 58 }}>({z.rows})</span>
                <span style={{ fontWeight: 600 }}>{z.pax} pax</span>
                <span style={{ marginLeft: "auto", color: textMuted }}>{z.weight.toLocaleString()} kg</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Weights + CG */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{
            background: glass.panel,
            backdropFilter: "blur(16px)",
            borderRadius: 12,
            padding: 18,
            border: `1px solid ${glass.panelBorder}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
            Weights
          </div>
          {WEIGHT_DATA.map((w) => (
            <div
              key={w.label}
              className="flex items-center justify-between"
              style={{ padding: "8px 0", borderBottom: `1px solid ${subtleBorder}` }}
            >
              <span style={{ fontSize: 14, color: textSec }}>{w.label}</span>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 16, fontWeight: 700, color: textPrimary, fontVariantNumeric: "tabular-nums" }}>
                  {w.value}
                </span>
                {w.ok !== null && (
                  w.ok ? (
                    <Check size={14} strokeWidth={3} style={{ color: "#16a34a" }} />
                  ) : (
                    <AlertTriangle size={14} strokeWidth={2} style={{ color: "#dc2626" }} />
                  )
                )}
                {w.max && <span style={{ fontSize: 13, color: textMuted }}>/ {w.max}</span>}
              </div>
            </div>
          ))}

          {/* CG Gauge — push to fill remaining space */}
          <div className="flex-1 flex flex-col justify-center" style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Center of Gravity
            </div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span style={{ fontSize: 24, fontWeight: 700, color: accent }}>28.4%</span>
                <span style={{ fontSize: 14, color: textMuted, marginLeft: 6 }}>MAC</span>
              </div>
              <span
                style={{
                  fontSize: 13, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 8,
                  background: isDark ? "rgba(22,163,74,0.15)" : "#dcfce7",
                  color: "#166534",
                }}
              >
                Within Limits
              </span>
            </div>
            <div className="relative" style={{ height: 10, borderRadius: 5, background: subtleBg }}>
              <div
                className="absolute"
                style={{ left: "17%", width: "20%", height: "100%", borderRadius: 5, background: `${accent}15` }}
              />
              <div
                className="absolute"
                style={{
                  left: "28.4%",
                  top: -3,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: accent,
                  border: "2.5px solid #fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  transform: "translateX(-8px)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5" style={{ fontSize: 13, color: textMuted }}>
              <span>17.0%</span>
              <span>37.0%</span>
            </div>
          </div>

          {/* DG alert — always at bottom */}
          <div
            className="flex items-center gap-2 shrink-0"
            style={{
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: 10,
              background: isDark ? "rgba(146,64,14,0.12)" : "#fef3c7",
              border: `1px solid ${isDark ? "rgba(253,230,138,0.15)" : "#fde68a"}`,
            }}
          >
            <AlertTriangle size={14} strokeWidth={2} style={{ color: "#92400e" }} />
            <span style={{ fontSize: 13, color: "#92400e" }}>
              DG: 1 item (Lithium Ion, FWD) &middot; NOTOC: Pending
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
