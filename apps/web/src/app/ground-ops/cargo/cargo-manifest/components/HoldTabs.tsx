import { ArrowUp, ArrowDown } from "lucide-react";
import type { HoldKey, CargoHold } from "@/types/cargo";

interface HoldTabsProps {
  activeHold: HoldKey;
  onSelect: (key: HoldKey) => void;
  holds: Record<string, CargoHold>;
  accent: string;
  isDark: boolean;
}

const TABS: { key: HoldKey; label: string; arrow: "up" | "down" }[] = [
  { key: "fwd", label: "Forward Hold", arrow: "up" },
  { key: "aft", label: "Aft Hold", arrow: "down" },
  { key: "bulk", label: "Bulk Cargo", arrow: "down" },
];

export function HoldTabs({ activeHold, onSelect, holds, accent, isDark }: HoldTabsProps) {
  return (
    <div className="flex gap-1 px-3.5">
      {TABS.map((tab) => {
        const isActive = activeHold === tab.key;
        const hold = holds[tab.key];
        const Arrow = tab.arrow === "up" ? ArrowUp : ArrowDown;

        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="flex-1 text-center transition-all duration-150 relative"
            style={{
              padding: "8px 0",
              borderRadius: 10,
              border: isActive
                ? `1.5px solid ${accent}`
                : `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.5)"}`,
              background: isActive
                ? accent
                : isDark ? "rgba(20,20,24,0.85)" : "rgba(255,255,255,1)",
              backdropFilter: isDark ? "blur(12px)" : "none",
            }}
          >
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Arrow size={13} strokeWidth={2.5} style={{ color: isActive ? "#ffffff" : isDark ? "#a1a1aa" : "#6b7280" }} />
              <span
                className="text-[14px] font-bold uppercase"
                style={{
                  color: isActive ? "#ffffff" : isDark ? "#a1a1aa" : "#6b7280",
                  letterSpacing: "0.5px",
                }}
              >
                {tab.label}
              </span>
            </div>
            <div
              className="text-[12px]"
              style={{ color: isActive ? "rgba(255,255,255,0.8)" : isDark ? "#71717a" : "#9ca3af" }}
            >
              {hold.weight.toLocaleString()} kg / {hold.percent}%
            </div>

            {/* Active bar */}
            {isActive && (
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
                style={{
                  width: "60%",
                  height: 2.5,
                  background: "#ffffff",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
