"use client";

import { useMemo, useCallback } from "react";
import { useTheme } from "@/components/theme-provider";
import { colors, type Palette as PaletteType } from "@skyhub/ui/theme";
import { useGroundOpsStore } from "@/stores/use-ground-ops-store";
import type { StationFlight } from "./types";
import { MOCK_FLIGHTS } from "./data/mock-data";
import { KpiStrip } from "./KpiStrip";
import { FlightListPanel } from "./FlightListPanel";
import { WorkspacePanel } from "./WorkspacePanel";

function desaturate(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const nr = Math.round(r + (gray - r) * amount);
  const ng = Math.round(g + (gray - g) * amount);
  const nb = Math.round(b + (gray - b) * amount);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

export function StationBoard() {
  const { theme, moduleTheme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;

  const rawAccent = moduleTheme?.accent ?? "#059669";
  const accent = isDark ? desaturate(rawAccent, 0.2) : rawAccent;
  const accentDark = isDark ? accent : "#065f46";

  const selectedFlight = useGroundOpsStore((s) => s.selectedFlight);
  const setSelectedFlight = useGroundOpsStore((s) => s.setSelectedFlight);
  const activeTab = useGroundOpsStore((s) => s.activeTab);
  const setActiveTab = useGroundOpsStore((s) => s.setActiveTab);

  const glass = useMemo(
    () =>
      isDark
        ? {
            panel: "rgba(20,20,24,0.75)",
            panelBorder: "rgba(255,255,255,0.08)",
            panelShadow: "0 8px 32px rgba(0,0,0,0.4)",
            input: "rgba(255,255,255,0.06)",
            inputBorder: "rgba(255,255,255,0.08)",
          }
        : {
            panel: "rgba(255,255,255,0.6)",
            panelBorder: "rgba(255,255,255,0.6)",
            panelShadow: "0 8px 32px rgba(0,0,0,0.08)",
            input: "rgba(255,255,255,0.7)",
            inputBorder: "rgba(0,0,0,0.05)",
          },
    [isDark]
  );

  // Find full StationFlight for selected
  const activeFlight = useMemo(() => {
    if (!selectedFlight) return null;
    return MOCK_FLIGHTS.find((f) => f.id === selectedFlight.id) ?? null;
  }, [selectedFlight]);

  const handleSelectFlight = useCallback(
    (flight: StationFlight) => {
      const wasEmpty = !selectedFlight;
      setSelectedFlight({
        id: flight.id,
        dep: flight.dep,
        arr: flight.arr,
        reg: flight.reg,
        type: flight.type,
        std: flight.std,
        gate: flight.gate,
        status: flight.status,
      });
      if (wasEmpty) setActiveTab("overview");
    },
    [selectedFlight, setSelectedFlight, setActiveTab]
  );

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: "100%",
        paddingTop: 6,
        background: isDark
          ? "linear-gradient(160deg, #2a2a32 0%, #252530 30%, #22222c 60%, #1e1e28 100%)"
          : "linear-gradient(160deg, #e8ecf1 0%, #dde2e8 30%, #d0d5dc 60%, #c8cdd4 100%)",
      }}
    >
      {/* Radial highlight */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: isDark
            ? "radial-gradient(ellipse 60% 45% at 50% 35%, rgba(255,255,255,0.04), transparent 70%)"
            : "radial-gradient(ellipse 60% 45% at 50% 35%, rgba(255,255,255,0.3), transparent 70%)",
        }}
      />

      {/* KPI strip */}
      <div className="relative" style={{ zIndex: 1 }}>
        <KpiStrip flights={MOCK_FLIGHTS} accent={accent} isDark={isDark} glass={glass} />
      </div>

      {/* Main content */}
      <div
        className="flex flex-1 overflow-hidden relative"
        style={{ padding: "6px 16px 16px", gap: 10, zIndex: 1 }}
      >
        <FlightListPanel
          flights={MOCK_FLIGHTS}
          selectedId={selectedFlight?.id ?? null}
          onSelect={handleSelectFlight}
          accent={accent}
          accentDark={accentDark}
          isDark={isDark}
          glass={glass}
        />
        <WorkspacePanel
          flight={activeFlight}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accent={accent}
          accentDark={accentDark}
          isDark={isDark}
          glass={glass}
        />
      </div>
    </div>
  );
}
