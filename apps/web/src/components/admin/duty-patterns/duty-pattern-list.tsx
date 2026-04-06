"use client";

import type { DutyPatternRef } from "@skyhub/api";
import { Search, Sparkles } from "lucide-react";

interface DutyPatternListProps {
  patterns: DutyPatternRef[];
  totalCount: number;
  filteredCount: number;
  selected: DutyPatternRef | null;
  onSelect: (p: DutyPatternRef) => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
  onSeed?: () => void;
}

function SegmentBar({ sequence }: { sequence: number[] }) {
  const total = sequence.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div className="flex w-full h-2.5 rounded-full overflow-hidden">
      {sequence.map((count, i) => {
        const isOn = i % 2 === 0;
        return (
          <div
            key={i}
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: isOn ? "#06C270" : "#FF5C5C",
              opacity: isOn ? 0.7 : 0.35,
            }}
          />
        );
      })}
    </div>
  );
}

export function DutyPatternList({
  patterns,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
  onSeed,
}: DutyPatternListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <h2 className="text-[16px] font-bold">Off/Duty Patterns</h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder="Search code, description..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : patterns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
            <p className="text-[13px] text-hz-text-secondary">No patterns found</p>
            {onSeed && (
              <button
                onClick={onSeed}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-module-accent transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Load Defaults
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {patterns.map((p) => {
              const isSelected = selected?._id === p._id;
              const onDays = p.sequence.reduce((s, n, i) => i % 2 === 0 ? s + n : s, 0);
              const offDays = p.cycleDays - onDays;
              const ratio = Math.round((onDays / p.cycleDays) * 100);
              return (
                <button
                  key={p._id}
                  onClick={() => onSelect(p)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                      : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold font-mono">{p.code}</span>
                    {!p.isActive && (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-hz-border/50 text-hz-text-tertiary">
                        Inactive
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <div className="text-[12px] text-hz-text-secondary truncate mb-2">{p.description}</div>
                  )}
                  <SegmentBar sequence={p.sequence} />
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-hz-text-tertiary">
                    <span>{p.cycleDays}d cycle</span>
                    <span className="text-[#06C270] font-semibold">{onDays} on</span>
                    <span className="text-[#FF5C5C] font-semibold">{offDays} off</span>
                    <span className="ml-auto font-mono">{ratio}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
