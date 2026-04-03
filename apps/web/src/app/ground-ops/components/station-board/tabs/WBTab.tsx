"use client";

import { Scale } from "lucide-react";

interface WBTabProps {
  isDark: boolean;
}

export function WBTab({ isDark }: WBTabProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Scale size={40} strokeWidth={1} style={{ margin: "0 auto 8px", opacity: 0.2, color: isDark ? "#888" : "#555" }} />
        <div style={{ fontWeight: 600, fontSize: 15, color: isDark ? "#ccc" : "#555" }}>Loadsheet & LMC</div>
        <div style={{ fontSize: 13, color: isDark ? "#666" : "#999", marginTop: 2 }}>
          Weight chain + inline LMC calculator
        </div>
        <div style={{ fontSize: 13, color: isDark ? "#555" : "#bbb", marginTop: 8 }}>Coming soon</div>
      </div>
    </div>
  );
}
