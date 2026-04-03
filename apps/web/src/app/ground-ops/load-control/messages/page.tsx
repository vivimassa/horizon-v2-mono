"use client";

import { useGroundOpsStore } from "@/stores/use-ground-ops-store";
import { Mail, Plane, Construction } from "lucide-react";

export default function MessagesPage() {
  const selectedFlight = useGroundOpsStore((s) => s.selectedFlight);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Mail size={20} strokeWidth={1.8} style={{ color: "#1e40af" }} />
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Messages</h1>
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Generate and send LDM, CPM, NOTOC</p>
      </div>

      {!selectedFlight ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "#f8f8f8",
            borderRadius: 14,
            border: "1px solid #eee",
          }}
        >
          <Plane
            size={32}
            strokeWidth={1.2}
            style={{ margin: "0 auto 8px", opacity: 0.25, transform: "rotate(-45deg)" }}
          />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#555" }}>
            No flight selected
          </div>
          <div style={{ fontSize: 12, color: "#999", marginTop: 4, maxWidth: 280, margin: "4px auto 0" }}>
            Select a flight from the Station Board or use the flight selector
            in the breadcrumb bar
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "#f8f8f8",
            borderRadius: 14,
            border: "1px solid #eee",
          }}
        >
          <Construction
            size={32}
            strokeWidth={1.2}
            style={{ margin: "0 auto 8px", opacity: 0.25 }}
          />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#555" }}>
            Under Construction
          </div>
          <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            Messages for {selectedFlight.id} ({selectedFlight.dep}&rarr;{selectedFlight.arr})
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: 12,
              padding: "4px 12px",
              borderRadius: 8,
              background: "#e8e8e8",
              fontSize: 11,
              fontFamily: "monospace",
              color: "#888",
            }}
          >
            Section 4.3.2
          </div>
        </div>
      )}
    </div>
  );
}
