"use client";

import { SEVERITY_DEFINITIONS } from "@skyhub/logic";
import { ShieldAlert } from "lucide-react";

/* ─── Severity Section (edit mode) ─── */

export function SeveritySection({ severity, onChange, isDark }: {
  severity: string[]; onChange: (s: string[]) => void; isDark: boolean;
}) {
  const toggle = (key: string) => {
    onChange(severity.includes(key) ? severity.filter(s => s !== key) : [...severity, key]);
  };

  return (
    <div className="rounded-2xl p-5"
      style={{ background: isDark ? "rgba(239,68,68,0.04)" : "rgba(239,68,68,0.03)", border: `1px solid ${isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.12)"}` }}>
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert size={14} color={isDark ? "#fca5a5" : "#dc2626"} strokeWidth={1.8} />
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: isDark ? "#fca5a5" : "#dc2626" }}>Enforcement Rules</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SEVERITY_DEFINITIONS.map(def => {
          const active = severity.includes(def.key);
          return (
            <button key={def.key} onClick={() => toggle(def.key)}
              className={`text-left flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all border ${
                active
                  ? def.isDestructive
                    ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                    : "border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10"
                  : "border-hz-border/50 hover:bg-hz-border/20"
              }`}>
              <div className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                active
                  ? def.isDestructive ? "border-red-500 bg-red-500" : "border-blue-500 bg-blue-500"
                  : "border-hz-text-secondary/30"
              }`}>
                {active && <span className="text-white text-[10px] font-bold">&#10003;</span>}
              </div>
              <div className="min-w-0">
                <div className={`text-[12px] font-semibold ${active ? (def.isDestructive ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400") : "text-hz-text"}`}>
                  {def.label}
                </div>
                <div className="text-[11px] text-hz-text-secondary leading-snug">{def.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
