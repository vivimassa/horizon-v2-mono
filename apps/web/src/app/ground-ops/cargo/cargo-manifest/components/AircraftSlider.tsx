"use client";

import { useCallback } from "react";
import type { HoldKey } from "@/types/cargo";
import { getAircraftImage, AIRCRAFT_CARGO_CONFIGS } from "@/config/aircraft-cargo";
import { CompartmentOverlay } from "./CompartmentOverlay";

interface AircraftSliderProps {
  aircraftType: string;
  activeHold: HoldKey;
  onSelectHold: (key: HoldKey) => void;
  accent: string;
  isDark: boolean;
  onDotRef?: (el: HTMLButtonElement | null) => void;
  showBox?: boolean;
  overviewMode?: boolean;
}

export function AircraftSlider({
  aircraftType,
  activeHold,
  onSelectHold,
  accent,
  isDark,
  onDotRef,
  showBox = true,
  overviewMode = false,
}: AircraftSliderProps) {
  const imageSrc = getAircraftImage(aircraftType);
  const config = AIRCRAFT_CARGO_CONFIGS["A321"];
  const zones = config?.zones ?? [];

  const activeRef = useCallback(
    (el: HTMLButtonElement | null) => { onDotRef?.(el); },
    [onDotRef],
  );

  return (
    <div className="relative flex-1 flex items-center justify-center overflow-visible">
      <div className="relative" style={{ width: "100%", maxHeight: "100%" }}>
        <img
          src={imageSrc}
          alt={`${aircraftType} full aircraft`}
          className="w-full h-full object-contain select-none"
          draggable={false}
          style={{
            filter: overviewMode
              ? "drop-shadow(-12px -8px 18px rgba(0,0,0,0.35))"
              : "none",
            transition: "filter 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* Overview mode: all boxes visible but dimmed */}
        {overviewMode && (
          <div style={{ opacity: 0.3, transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            {zones.map((zone) => (
              <div
                key={zone.holdKey}
                className="absolute rounded-lg"
                style={{
                  top: zone.top,
                  left: zone.left,
                  width: zone.width,
                  height: zone.height,
                  border: `1.5px dashed ${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}`,
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                }}
              />
            ))}
          </div>
        )}

        {/* Active mode: interactive overlays */}
        {!overviewMode && (
          <div style={{ opacity: showBox ? 1 : 0, transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            {zones.map((zone) => (
              <CompartmentOverlay
                key={zone.holdKey}
                ref={activeHold === zone.holdKey ? activeRef : undefined}
                zone={zone}
                isActive={activeHold === zone.holdKey}
                onSelect={onSelectHold}
                accent={accent}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
