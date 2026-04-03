"use client";

import { BadgeCheck } from "lucide-react";

interface CaptainTabProps {
  isDark: boolean;
}

export function CaptainTab({ isDark }: CaptainTabProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <BadgeCheck size={40} strokeWidth={1} style={{ margin: "0 auto 8px", opacity: 0.2, color: isDark ? "#888" : "#555" }} />
        <div style={{ fontWeight: 600, fontSize: 15, color: isDark ? "#ccc" : "#555" }}>Captain Acceptance</div>
        <div style={{ fontSize: 13, color: isDark ? "#666" : "#999", marginTop: 2 }}>
          Loadsheet + NOTOC review + digital sign-off
        </div>
        <div style={{ fontSize: 13, color: isDark ? "#555" : "#bbb", marginTop: 8 }}>Coming soon</div>
      </div>
    </div>
  );
}
