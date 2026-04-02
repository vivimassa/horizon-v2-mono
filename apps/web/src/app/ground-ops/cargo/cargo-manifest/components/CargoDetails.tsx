"use client";

import { CheckCircle, Package } from "lucide-react";
import type { CargoFlight, CargoHold } from "@/types/cargo";
import type { Palette as PaletteType } from "@skyhub/ui/theme";
import { ManifestItem } from "./ManifestItem";

interface CargoDetailsProps {
  flight: CargoFlight;
  allHolds: Record<string, CargoHold>;
  accent: string;
  palette: PaletteType;
  isDark: boolean;
}

const HOLD_LABELS: Record<string, string> = {
  fwd: "Forward",
  aft: "Aft",
  bulk: "Bulk",
};

export function CargoDetails({ flight, allHolds, accent, palette, isDark }: CargoDetailsProps) {
  const holds = Object.values(allHolds);
  const allItems = holds.flatMap((h) => h.items);
  const totalPieces = allItems.length;
  const totalWeight = holds.reduce((sum, h) => sum + h.weight, 0);
  const cgMac = 28.4;

  return (
    <div>
      {/* Center of Gravity */}
      <div
        className="rounded-lg mb-2"
        style={{
          padding: "8px 10px",
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.015)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}`,
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase" style={{ color: palette.textSecondary, letterSpacing: "0.5px" }}>
            Center of Gravity
          </span>
          <span
            className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: isDark ? "rgba(22,163,74,0.15)" : "#dcfce7", color: isDark ? "#4ade80" : "#166534" }}
          >
            <CheckCircle size={9} strokeWidth={2} />
            Within Limits
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[18px] font-bold" style={{ color: accent }}>{cgMac}%</span>
          <span className="text-[9px]" style={{ color: palette.textTertiary }}>MAC</span>
        </div>
        <div className="relative">
          <div className="h-[5px] rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            <div className="absolute h-[5px] rounded-full" style={{ left: "15%", width: "50%", background: isDark ? "rgba(22,163,74,0.2)" : "rgba(22,163,74,0.15)" }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full"
              style={{ left: `${cgMac}%`, background: accent, border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px]" style={{ color: palette.textTertiary }}>FWD 15%</span>
            <span className="text-[8px]" style={{ color: palette.textTertiary }}>AFT 65%</span>
          </div>
        </div>
      </div>

      {/* All holds — each with items */}
      {holds.map((hold) => (
        <div key={hold.key} className="mb-2">
          {/* Hold header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Package size={10} strokeWidth={2} style={{ color: accent }} />
              <span className="text-[10px] font-semibold uppercase" style={{ color: palette.textSecondary, letterSpacing: "0.5px" }}>
                {HOLD_LABELS[hold.key] ?? hold.name}
              </span>
            </div>
            <span className="text-[10px] font-semibold" style={{ color: palette.text }}>
              {hold.weight.toLocaleString()} / {hold.capacity.toLocaleString()} kg
              <span className="ml-1" style={{ color: accent }}>{hold.percent}%</span>
            </span>
          </div>

          {/* Hold progress bar */}
          <div
            className="h-[3px] rounded-full mb-1.5"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${hold.percent}%`, background: accent }}
            />
          </div>

          {/* Items */}
          <div className="flex flex-col gap-1">
            {hold.items.map((item) => (
              <ManifestItem key={item.id} item={item} accent={accent} isDark={isDark} />
            ))}
            {hold.items.length === 0 && (
              <div className="py-2 text-center">
                <p className="text-[10px]" style={{ color: palette.textTertiary }}>Empty</p>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Totals */}
      <div
        className="rounded-lg mb-2"
        style={{
          padding: "6px 10px",
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.015)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}`,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: palette.textSecondary }}>Total Pieces</span>
          <span className="text-[11px] font-semibold" style={{ color: palette.text }}>{totalPieces}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px]" style={{ color: palette.textSecondary }}>Total Weight</span>
          <span className="text-[11px] font-bold" style={{ color: accent }}>{totalWeight.toLocaleString()} kg</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg"
          style={{
            border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
            color: palette.textSecondary,
            background: "transparent",
          }}
        >
          Cancel Load
        </button>
        <button
          className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg"
          style={{ background: accent, color: "#ffffff", border: `1.5px solid ${accent}` }}
        >
          Confirm Load
        </button>
      </div>
    </div>
  );
}
