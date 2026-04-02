import { forwardRef } from "react";
import type { CompartmentZone, HoldKey } from "@/types/cargo";

interface CompartmentOverlayProps {
  zone: CompartmentZone;
  isActive: boolean;
  onSelect: (key: HoldKey) => void;
  accent: string;
}

export const CompartmentOverlay = forwardRef<HTMLButtonElement, CompartmentOverlayProps>(
  function CompartmentOverlay({ zone, isActive, onSelect, accent }, ref) {
    return (
      <button
        ref={ref}
        onClick={() => onSelect(zone.holdKey)}
        className="absolute"
        style={{
          top: zone.top,
          left: zone.left,
          width: zone.width,
          height: zone.height,
          borderRadius: 8,
          border: isActive
            ? `2px solid ${accent}`
            : "2px solid transparent",
          background: isActive
            ? `${accent}1a`
            : "transparent",
          boxShadow: isActive
            ? `0 0 30px ${accent}1f`
            : "none",
          cursor: "pointer",
          opacity: isActive ? 1 : 0.4,
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.border = `2px solid ${accent}59`;
            e.currentTarget.style.background = `${accent}1a`;
            e.currentTarget.style.opacity = "0.7";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.border = "2px solid transparent";
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.opacity = "0.4";
          }
        }}
      >
        {isActive && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "cargo-fade-in 0.8s ease" }}
          >
            <div
              className="rounded-full"
              style={{
                width: 14,
                height: 14,
                background: accent,
                animation: "cargo-pulse 2s infinite",
              }}
            />
          </div>
        )}
      </button>
    );
  }
);
