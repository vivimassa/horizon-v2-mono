import type { CargoFlight, CargoFlightStatus } from "@/types/cargo";
import type { Palette as PaletteType } from "@skyhub/ui/theme";
import { Plane } from "lucide-react";

const STATUS_CONFIG: Record<
  CargoFlightStatus,
  { label: string; bg: string; text: string; darkBg: string; darkText: string }
> = {
  loading: { label: "Loading", bg: "#dbeafe", text: "#1e40af", darkBg: "rgba(30,64,175,0.2)", darkText: "#60a5fa" },
  scheduled: { label: "Scheduled", bg: "#f3f4f6", text: "#6b7280", darkBg: "rgba(107,114,128,0.15)", darkText: "#9ca3af" },
  onTime: { label: "On Time", bg: "#dcfce7", text: "#166534", darkBg: "rgba(22,163,74,0.15)", darkText: "#4ade80" },
  delayed: { label: "Delayed", bg: "#fee2e2", text: "#991b1b", darkBg: "rgba(220,38,38,0.15)", darkText: "#f87171" },
  cancelled: { label: "Cancelled", bg: "#fee2e2", text: "#991b1b", darkBg: "rgba(220,38,38,0.15)", darkText: "#f87171" },
};

interface FlightCardProps {
  flight: CargoFlight;
  isSelected: boolean;
  onSelect: (id: string) => void;
  accent: string;
  palette: PaletteType;
  isDark: boolean;
}

export function FlightCard({ flight, isSelected, onSelect, accent, palette, isDark }: FlightCardProps) {
  const status = STATUS_CONFIG[flight.status];
  const statusBg = isDark ? status.darkBg : status.bg;
  const statusText = isDark ? status.darkText : status.text;

  // For loading status, use accent color
  const isLoading = flight.status === "loading";
  const pillBg = isLoading ? accent : statusBg;
  const pillText = isLoading ? "#ffffff" : statusText;

  return (
    <button
      onClick={() => onSelect(flight.id)}
      className="w-full text-left rounded-xl transition-all duration-150"
      style={{
        padding: "12px 14px",
        background: isSelected
          ? isDark ? "rgba(255,255,255,0.08)" : accent
          : isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
        border: `1.5px solid ${
          isSelected
            ? accent
            : isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"
        }`,
        boxShadow: isSelected
          ? `0 4px 16px ${isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.1)"}`
          : `0 1px 3px ${isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)"}`,
      }}
    >
      {/* Row 1: Flight number + status */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[14px] font-bold"
          style={{ color: isSelected ? (isDark ? "#fff" : "#fff") : palette.text }}
        >
          {flight.id}
        </span>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: isSelected ? "rgba(255,255,255,0.2)" : pillBg, color: isSelected ? "#fff" : pillText }}
        >
          {status.label}
        </span>
      </div>

      {/* Row 2: Route */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[13px] font-semibold"
          style={{ color: isSelected ? "rgba(255,255,255,0.9)" : palette.text }}
        >
          {flight.dep}
        </span>
        <div className="flex-1 flex items-center gap-1">
          <div
            className="flex-1 h-px"
            style={{
              background: isSelected
                ? "rgba(255,255,255,0.25)"
                : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              backgroundImage: isSelected
                ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0, rgba(255,255,255,0.25) 4px, transparent 4px, transparent 8px)"
                : `repeating-linear-gradient(90deg, ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 0, ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 4px, transparent 4px, transparent 8px)`,
              height: "1px",
            }}
          />
          <Plane
            size={12}
            strokeWidth={2}
            style={{ color: isSelected ? "rgba(255,255,255,0.6)" : palette.textTertiary, transform: "rotate(45deg)" }}
          />
          <div
            className="flex-1 h-px"
            style={{
              backgroundImage: isSelected
                ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0, rgba(255,255,255,0.25) 4px, transparent 4px, transparent 8px)"
                : `repeating-linear-gradient(90deg, ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 0, ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 4px, transparent 4px, transparent 8px)`,
              height: "1px",
            }}
          />
        </div>
        <span
          className="text-[13px] font-semibold"
          style={{ color: isSelected ? "rgba(255,255,255,0.9)" : palette.text }}
        >
          {flight.arr}
        </span>
      </div>

      {/* Row 3: Loaded weight + percent */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[11px]"
          style={{ color: isSelected ? "rgba(255,255,255,0.7)" : palette.textSecondary }}
        >
          {flight.cargoLoaded.toLocaleString()} / {flight.cargoCapacity.toLocaleString()} kg
        </span>
        <span
          className="text-[11px] font-semibold"
          style={{ color: isSelected ? "rgba(255,255,255,0.9)" : palette.text }}
        >
          {flight.loadPercent}%
        </span>
      </div>

      {/* Row 4: Progress bar */}
      <div
        className="h-[3px] rounded-full overflow-hidden"
        style={{
          background: isSelected
            ? "rgba(255,255,255,0.15)"
            : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${flight.loadPercent}%`,
            background: isSelected
              ? "#a7f3d0"
              : flight.loadPercent > 90 ? "#16a34a" : accent,
          }}
        />
      </div>
    </button>
  );
}
