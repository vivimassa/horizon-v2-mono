"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  colors,
  getStatusColors,
  type StatusKey,
  type Palette,
} from "@skyhub/ui/theme";
import { useTheme } from "@/components/theme-provider";

const ACCENT = "#1e40af";

const MOCK_KPIS = [
  { label: "Today's Flights", value: "284",    change: "+12",  trend: "up" as const,      color: ACCENT },
  { label: "On-Time Rate",    value: "91.2%",  change: "+2.1%",trend: "up" as const,      color: "#16a34a" },
  { label: "Active Disruptions", value: "7",   change: "+3",   trend: "up" as const,      color: "#dc2626" },
  { label: "Crew Available",  value: "1,842",  change: "+28",  trend: "up" as const,      color: "#7c3aed" },
  { label: "Aircraft Serviceable", value: "98/102", change: "\u2014", trend: "neutral" as const, color: "#0f766e" },
  { label: "Avg Delay",       value: "14m",    change: "-3m",  trend: "down" as const,    color: "#b45309" },
];

const MOCK_FLIGHTS: { id: string; flight: string; route: string; std: string; status: StatusKey; statusLabel: string }[] = [
  { id: "1", flight: "VJ-123", route: "SGN \u2192 HAN", std: "06:30", status: "onTime",    statusLabel: "On Time" },
  { id: "2", flight: "VJ-456", route: "SGN \u2192 DAD", std: "07:15", status: "delayed",   statusLabel: "Delayed" },
  { id: "3", flight: "VJ-789", route: "HAN \u2192 SGN", std: "08:00", status: "departed",  statusLabel: "Departed" },
  { id: "4", flight: "VJ-321", route: "DAD \u2192 HAN", std: "09:45", status: "onTime",    statusLabel: "On Time" },
  { id: "5", flight: "VJ-654", route: "SGN \u2192 CXR", std: "10:30", status: "cancelled", statusLabel: "Cancelled" },
  { id: "6", flight: "VJ-987", route: "HAN \u2192 DAD", std: "11:00", status: "scheduled", statusLabel: "Scheduled" },
];

function TrendIcon({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3" style={{ color: "#16a34a" }} />;
  if (trend === "down") return <TrendingDown className="h-3 w-3" style={{ color: "#dc2626" }} />;
  return <Minus className="h-3 w-3" style={{ color: "#888888" }} />;
}

export default function HomePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette: Palette = isDark ? colors.dark : colors.light;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-full p-6">
      <h1 className="text-xl font-semibold mb-0.5" style={{ color: palette.text }}>
        Home
      </h1>
      <p className="text-sm mb-6" style={{ color: palette.textSecondary }}>
        {today} &bull; Sky Hub
      </p>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        {MOCK_KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border p-3 shadow-sm"
            style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
          >
            <div className="text-lg font-semibold mb-1" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div className="text-xs mb-1.5" style={{ color: palette.textSecondary }}>
              {kpi.label}
            </div>
            <div className="flex items-center gap-1">
              <TrendIcon trend={kpi.trend} />
              <span className="text-[11px]" style={{ color: palette.textSecondary }}>
                {kpi.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Flights Section */}
      <div className="flex items-center mb-2">
        <div
          className="w-[3px] h-4 rounded-full mr-2"
          style={{ backgroundColor: ACCENT }}
        />
        <h2 className="text-[15px] font-bold" style={{ color: palette.text, letterSpacing: -0.3 }}>
          Today&apos;s Flights
        </h2>
      </div>

      <div
        className="rounded-xl border shadow-sm overflow-hidden"
        style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
      >
        {MOCK_FLIGHTS.map((flight, i) => {
          const s = getStatusColors(flight.status, isDark);
          return (
            <div key={flight.id}>
              <div
                className="flex items-center px-3 py-2.5 cursor-pointer transition-colors"
                style={{ color: palette.text }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = palette.backgroundHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span className="text-[13px] font-bold w-20">{flight.flight}</span>
                <span className="text-[13px] flex-1" style={{ color: palette.textSecondary }}>
                  {flight.route}
                </span>
                <span className="text-xs mr-3" style={{ color: palette.textSecondary }}>
                  {flight.std}
                </span>
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: s.bg, color: s.text }}
                >
                  {flight.statusLabel}
                </span>
              </div>
              {i < MOCK_FLIGHTS.length - 1 && (
                <div className="ml-3 mr-3" style={{ height: 0.5, backgroundColor: palette.border }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
