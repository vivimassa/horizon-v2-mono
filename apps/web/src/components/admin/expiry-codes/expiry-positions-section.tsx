"use client";

import { useMemo } from "react";
import type { CrewPositionRef } from "@skyhub/api";
import { accentTint } from "@skyhub/ui/theme";
import { Users } from "lucide-react";

/* ─── Positions Section (edit mode) ─── */

export function PositionsSection({ selected, positions, crewCategory, onChange, isDark }: {
  selected: string[];
  positions: CrewPositionRef[];
  crewCategory: string;
  onChange: (p: string[]) => void;
  isDark: boolean;
}) {
  const filtered = useMemo(() => {
    if (crewCategory === "both") return positions.filter(p => p.isActive);
    return positions.filter(p => p.isActive && p.category === crewCategory);
  }, [positions, crewCategory]);

  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  return (
    <div className="rounded-2xl p-5"
      style={{ background: isDark ? accentTint("#7c3aed", 0.04) : accentTint("#7c3aed", 0.03), border: `1px solid ${accentTint("#7c3aed", isDark ? 0.12 : 0.12)}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} color={isDark ? "#c4b5fd" : "#7c3aed"} strokeWidth={1.8} />
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: isDark ? "#c4b5fd" : "#7c3aed" }}>
          Applicable Positions
        </span>
        <span className="text-[11px] text-hz-text-secondary">(empty = all positions)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {filtered.map(p => {
          const active = selected.includes(p.code);
          return (
            <button key={p._id} onClick={() => toggle(p.code)}
              className={`text-[12px] font-bold font-mono px-3 py-1.5 rounded-lg transition-all border ${
                active
                  ? "border-purple-400 bg-purple-100 text-purple-800 dark:border-purple-500/40 dark:bg-purple-500/15 dark:text-purple-300"
                  : "border-hz-border/50 text-hz-text-secondary hover:bg-hz-border/20"
              }`}>
              {p.code}
              <span className="font-normal font-sans ml-1.5 text-[11px]">{p.name}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <span className="text-[12px] text-hz-text-secondary">No positions available for this crew category</span>
        )}
      </div>
    </div>
  );
}
