"use client";

import { Package } from "lucide-react";

interface LoadingTabProps {
  isDark: boolean;
}

export function LoadingTab({ isDark }: LoadingTabProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Package size={40} strokeWidth={1} style={{ margin: "0 auto 8px", opacity: 0.2, color: isDark ? "#888" : "#555" }} />
        <div style={{ fontWeight: 600, fontSize: 15, color: isDark ? "#ccc" : "#555" }}>Aircraft Loading View</div>
        <div style={{ fontSize: 13, color: isDark ? "#666" : "#999", marginTop: 2 }}>
          Reuses the Cargo Manifest aircraft image + compartment overlays
        </div>
        <div style={{ fontSize: 13, color: isDark ? "#555" : "#bbb", marginTop: 8 }}>Coming soon</div>
      </div>
    </div>
  );
}
