"use client";

import { useState } from "react";
import { Copy, Send, RefreshCw } from "lucide-react";
import { DOC_STATUS_CONFIG } from "../types";
import { MESSAGES, LDM_PREVIEW } from "../data/mock-data";

interface MessagesTabProps {
  accent: string;
  isDark: boolean;
  glass: { panel: string; panelBorder: string };
}

export function MessagesTab({ accent, isDark, glass }: MessagesTabProps) {
  const [selected, setSelected] = useState("ldm");

  const textPrimary = isDark ? "#f5f5f5" : "#111";
  const textMuted = isDark ? "#777" : "#999";

  return (
    <div className="flex h-full gap-2.5" style={{ padding: 16 }}>
      {/* Left: message type cards */}
      <div className="flex flex-col gap-1.5" style={{ width: 210 }}>
        {MESSAGES.map((m) => {
          const ds = DOC_STATUS_CONFIG[m.status];
          const isActive = selected === m.key;
          return (
            <div
              key={m.key}
              onClick={() => setSelected(m.key)}
              className="cursor-pointer transition-all duration-150"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: isActive ? glass.panel : "transparent",
                border: isActive ? `1.5px solid ${accent}40` : "1.5px solid transparent",
                backdropFilter: isActive ? "blur(12px)" : "none",
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{m.label}</span>
                <span
                  style={{
                    fontSize: 13, fontWeight: 600,
                    padding: "2px 7px", borderRadius: 8,
                    background: isDark ? `${ds.text}18` : ds.bg,
                    color: ds.text,
                  }}
                >
                  {ds.label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: textMuted, marginTop: 2 }}>{m.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Right: preview */}
      <div
        className="flex-1 flex flex-col"
        style={{
          background: glass.panel,
          backdropFilter: "blur(16px)",
          borderRadius: 12,
          border: `1px solid ${glass.panelBorder}`,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#aaa" : "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          LDM Preview
        </div>
        <pre
          className="flex-1 overflow-auto"
          style={{
            fontFamily: "'SF Mono','Roboto Mono',monospace",
            fontSize: 13,
            lineHeight: 1.6,
            color: isDark ? "#ccc" : "#333",
            background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
            borderRadius: 8,
            padding: 12,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
          }}
        >
          {LDM_PREVIEW}
        </pre>
        <div className="flex gap-1.5 mt-2.5">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
            style={{
              padding: "8px 0",
              borderRadius: 8,
              border: `1.5px solid ${accent}30`,
              background: `${accent}08`,
              color: accent,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Copy size={13} strokeWidth={2} />
            Copy to Clipboard
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
            style={{
              padding: "8px 0",
              borderRadius: 8,
              border: "none",
              background: accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: `0 2px 8px ${accent}4d`,
            }}
          >
            <Send size={13} strokeWidth={2} />
            Send via Hub
          </button>
          <button
            className="flex items-center justify-center gap-1 cursor-pointer"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1.5px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "#fff",
              color: isDark ? "#aaa" : "#555",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <RefreshCw size={13} strokeWidth={2} />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}
