"use client";

import { Plane, CheckCircle } from "lucide-react";
import type { CargoFlight, CargoHold } from "@/types/cargo";
import type { Palette as PaletteType } from "@skyhub/ui/theme";
import { ManifestItem } from "./ManifestItem";

interface ShipmentDetailsProps {
  flight: CargoFlight;
  hold: CargoHold;
  allHolds: Record<string, CargoHold>;
  accent: string;
  palette: PaletteType;
  isDark: boolean;
}

export function ShipmentDetails({ flight, hold, allHolds, accent, palette, isDark }: ShipmentDetailsProps) {
  const allItems = Object.values(allHolds).flatMap((h) => h.items);
  const totalPieces = allItems.length;
  const totalWeight = Object.values(allHolds).reduce((sum, h) => sum + h.weight, 0);
  const cgMac = 28.4;

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{
        width: 320,
        minWidth: 320,
        background: isDark ? "rgba(30,30,34,0.9)" : "#ffffff",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
        borderRadius: 14,
        boxShadow: isDark
          ? "0 2px 8px rgba(0,0,0,0.3)"
          : "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex-1 overflow-y-auto p-3.5">
        {/* Title */}
        <h2
          className="text-[15px] font-bold mb-3"
          style={{ color: palette.text }}
        >
          Cargo Details
        </h2>

        {/* Route */}
        <div
          className="rounded-xl mb-3"
          style={{
            padding: "10px 12px",
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"}`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px]" style={{ color: palette.textSecondary }}>
              {flight.std}
            </span>
            <span className="text-[11px]" style={{ color: palette.textSecondary }}>
              {flight.sta}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold" style={{ color: palette.text }}>
              {flight.dep}
            </span>
            <div className="flex-1 flex items-center gap-1">
              <div
                className="flex-1 h-px"
                style={{
                  backgroundImage: `repeating-linear-gradient(90deg, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} 0, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} 4px, transparent 4px, transparent 8px)`,
                }}
              />
              <Plane size={14} strokeWidth={1.8} style={{ color: accent }} />
              <div
                className="flex-1 h-px"
                style={{
                  backgroundImage: `repeating-linear-gradient(90deg, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} 0, ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} 4px, transparent 4px, transparent 8px)`,
                }}
              />
            </div>
            <span className="text-[16px] font-bold" style={{ color: palette.text }}>
              {flight.arr}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px]" style={{ color: palette.textTertiary }}>
              {flight.aircraftType} &middot; {flight.tailNumber}
            </span>
          </div>
        </div>

        {/* Active Hold */}
        <div
          className="rounded-xl mb-3"
          style={{
            padding: "10px 12px",
            background: isDark ? accent : accent,
            color: "#ffffff",
          }}
        >
          <div className="text-[11px] font-semibold uppercase mb-1" style={{ opacity: 0.7, letterSpacing: "0.5px" }}>
            Active Hold
          </div>
          <div className="text-[14px] font-bold">{hold.name}</div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px]" style={{ opacity: 0.8 }}>
              {hold.weight.toLocaleString()} / {hold.capacity.toLocaleString()} kg
            </span>
            <span className="text-[13px] font-bold">{hold.percent}%</span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${hold.percent}%`, background: "#a7f3d0" }}
            />
          </div>
        </div>

        {/* Center of Gravity */}
        <div
          className="rounded-xl mb-3"
          style={{
            padding: "10px 12px",
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"}`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-semibold uppercase"
              style={{ color: palette.textSecondary, letterSpacing: "0.5px" }}
            >
              Center of Gravity
            </span>
            <span
              className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: isDark ? "rgba(22,163,74,0.15)" : "#dcfce7", color: isDark ? "#4ade80" : "#166534" }}
            >
              <CheckCircle size={10} strokeWidth={2} />
              Within Limits
            </span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[20px] font-bold" style={{ color: accent }}>
              {cgMac}%
            </span>
            <span className="text-[10px]" style={{ color: palette.textTertiary }}>
              MAC
            </span>
          </div>
          {/* CG range bar */}
          <div className="relative">
            <div
              className="h-[6px] rounded-full"
              style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
            >
              {/* Safe range */}
              <div
                className="absolute h-[6px] rounded-full"
                style={{
                  left: "15%",
                  width: "50%",
                  background: isDark ? "rgba(22,163,74,0.2)" : "rgba(22,163,74,0.15)",
                }}
              />
              {/* CG dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full"
                style={{
                  left: `${cgMac}%`,
                  background: accent,
                  border: "2px solid white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[8px]" style={{ color: palette.textTertiary }}>FWD 15%</span>
              <span className="text-[8px]" style={{ color: palette.textTertiary }}>AFT 65%</span>
            </div>
          </div>
        </div>

        {/* Manifest Items */}
        <div className="mb-3">
          <div
            className="text-[11px] font-semibold uppercase mb-2"
            style={{ color: palette.textSecondary, letterSpacing: "0.5px" }}
          >
            Manifest &middot; {hold.name}
          </div>
          <div className="flex flex-col gap-1.5">
            {hold.items.map((item) => (
              <ManifestItem key={item.id} item={item} accent={accent} isDark={isDark} />
            ))}
            {hold.items.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-[11px]" style={{ color: palette.textTertiary }}>
                  No items in this hold
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div
          className="rounded-xl mb-3"
          style={{
            padding: "8px 12px",
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"}`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: palette.textSecondary }}>
              Pieces
            </span>
            <span className="text-[12px] font-semibold" style={{ color: palette.text }}>
              {totalPieces}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px]" style={{ color: palette.textSecondary }}>
              Total Weight
            </span>
            <span className="text-[12px] font-bold" style={{ color: accent }}>
              {totalWeight.toLocaleString()} kg
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="p-3 flex gap-2"
        style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}` }}
      >
        <button
          className="flex-1 text-[12px] font-semibold py-2 rounded-lg transition-colors"
          style={{
            border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
            color: palette.textSecondary,
            background: "transparent",
          }}
        >
          Cancel Load
        </button>
        <button
          className="flex-1 text-[12px] font-semibold py-2 rounded-lg transition-colors"
          style={{
            background: accent,
            color: "#ffffff",
            border: `1.5px solid ${accent}`,
          }}
        >
          Confirm Load
        </button>
      </div>
    </div>
  );
}
