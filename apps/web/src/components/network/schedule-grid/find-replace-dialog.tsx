"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { X, ChevronUp, ChevronDown, Search, Replace } from "lucide-react";
import type { ScheduledFlightRef } from "@skyhub/api";
import { useTheme } from "@/components/theme-provider";
import { GRID_COLUMNS } from "./grid-columns";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";

interface FindReplaceDialogProps {
  rows: ScheduledFlightRef[];
  onClose: () => void;
  showReplace?: boolean;
}

interface Match {
  rowIdx: number;
  colKey: string;
  rowId: string;
}

export function FindReplaceDialog({ rows, onClose, showReplace = false }: FindReplaceDialogProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const selectCell = useScheduleGridStore((s) => s.selectCell);
  const markDirty = useScheduleGridStore((s) => s.markDirty);
  const getDirtyValue = useScheduleGridStore((s) => s.getDirtyValue);

  // Capture selection scope on open (column/range selection → scoped find)
  const [scope] = useState(() => {
    const { selectionRange, highlightedCol } = useScheduleGridStore.getState();
    if (selectionRange) {
      const r1 = Math.min(selectionRange.startRow, selectionRange.endRow);
      const r2 = Math.max(selectionRange.startRow, selectionRange.endRow);
      const c1 = Math.min(selectionRange.startCol, selectionRange.endCol);
      const c2 = Math.max(selectionRange.startCol, selectionRange.endCol);
      const cols = GRID_COLUMNS.slice(c1, c2 + 1).map((c) => c.key);
      return { rowRange: [r1, r2] as [number, number], colKeys: cols };
    }
    return null; // no scope — search all
  });

  const bg = isDark ? "#1C1C28" : "#FAFAFC";
  const border = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const inputBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)";
  const shadow = isDark
    ? "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)"
    : "0 8px 32px rgba(96,97,112,0.14), 0 2px 8px rgba(96,97,112,0.08)";
  const hoverBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  // Find all matches (respects selection scope, checks dirty values)
  const matches = useMemo<Match[]>(() => {
    if (!query) return [];
    const q = matchCase ? query : query.toLowerCase();
    const results: Match[] = [];
    const cols = scope ? GRID_COLUMNS.filter((c) => scope.colKeys.includes(c.key)) : GRID_COLUMNS;
    rows.forEach((row, rowIdx) => {
      if (scope && (rowIdx < scope.rowRange[0] || rowIdx > scope.rowRange[1])) return;
      for (const col of cols) {
        const dirty = getDirtyValue(row._id, col.key);
        const val = dirty !== undefined ? dirty : (row as any)[col.key];
        if (val == null) continue;
        const str = matchCase ? String(val) : String(val).toLowerCase();
        if (str.includes(q)) {
          results.push({ rowIdx, colKey: col.key, rowId: row._id });
        }
      }
    });
    return results;
  }, [rows, query, matchCase, scope, getDirtyValue]);

  // Navigate to current match
  useEffect(() => {
    if (matches.length > 0 && currentIdx < matches.length) {
      const m = matches[currentIdx];
      selectCell({ rowIdx: m.rowIdx, colKey: m.colKey });
    }
  }, [currentIdx, matches, selectCell]);

  const findNext = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIdx((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const findPrev = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIdx((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const replaceCurrent = useCallback(() => {
    if (matches.length === 0 || !replaceText) return;
    const m = matches[currentIdx];
    const col = GRID_COLUMNS.find((c) => c.key === m.colKey);
    if (!col?.editable) return;
    markDirty(m.rowId, { [m.colKey]: replaceText } as Partial<ScheduledFlightRef>);
    findNext();
  }, [matches, currentIdx, replaceText, markDirty, findNext]);

  const replaceAll = useCallback(() => {
    if (matches.length === 0 || !replaceText) return;
    for (const m of matches) {
      const col = GRID_COLUMNS.find((c) => c.key === m.colKey);
      if (!col?.editable) continue;
      markDirty(m.rowId, { [m.colKey]: replaceText } as Partial<ScheduledFlightRef>);
    }
  }, [matches, replaceText, markDirty]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") { e.preventDefault(); findNext(); }
  };

  return (
    <div
      className="absolute top-3 right-4 z-30 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        boxShadow: shadow,
        backdropFilter: "blur(20px)",
        width: showReplace ? 340 : 320,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-module-accent" />
          <span className="text-[15px] font-semibold text-hz-text">
            {showReplace ? "Find & Replace" : "Find"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors"
          onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <X size={14} className="text-hz-text-tertiary" />
        </button>
      </div>

      {scope && (
        <div className="px-4 pb-0">
          <span className="text-[11px] font-medium text-module-accent">
            Scoped to {scope.colKeys.map((k) => GRID_COLUMNS.find((c) => c.key === k)?.label).join(", ")}
            {scope.rowRange[0] !== 0 || scope.rowRange[1] !== rows.length - 1
              ? ` (rows ${scope.rowRange[0] + 1}–${scope.rowRange[1] + 1})`
              : ""}
          </span>
        </div>
      )}
      <div className="px-4 pb-4 space-y-3">
        {/* Find input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hz-text-tertiary" size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCurrentIdx(0); }}
            placeholder="Search in schedule..."
            className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none text-hz-text"
            style={{
              backgroundColor: inputBg,
              border: `1px solid ${border}`,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-module-accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(30,64,175,0.15)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.boxShadow = "none"; }}
            autoFocus
          />
          {query && matches.length > 0 && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-medium text-hz-text-tertiary"
            >
              {currentIdx + 1}/{matches.length}
            </span>
          )}
          {query && matches.length === 0 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium" style={{ color: "#E63535" }}>
              No match
            </span>
          )}
        </div>

        {/* Replace input */}
        {showReplace && (
          <div className="relative">
            <Replace className="absolute left-3 top-1/2 -translate-y-1/2 text-hz-text-tertiary" size={14} />
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none text-hz-text"
              style={{
                backgroundColor: inputBg,
                border: `1px solid ${border}`,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-module-accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(30,64,175,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
        )}

        {/* Options + nav row */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-hz-text-secondary cursor-pointer select-none">
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} className="accent-module-accent w-3.5 h-3.5" />
            <span className="font-medium">Match case</span>
          </label>

          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={findPrev} disabled={matches.length === 0}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              title="Previous (Shift+Enter)"
              onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronUp size={15} className="text-hz-text-secondary" />
            </button>
            <button
              onClick={findNext} disabled={matches.length === 0}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              title="Next (Enter)"
              onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronDown size={15} className="text-hz-text-secondary" />
            </button>
          </div>
        </div>

        {/* Replace actions */}
        {showReplace && (
          <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: border }}>
            <button
              onClick={replaceCurrent}
              disabled={matches.length === 0 || !replaceText}
              className="flex-1 h-8 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-30"
              style={{ border: `1px solid ${border}`, color: isDark ? "#E4E4EB" : "#1C1C28" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Replace
            </button>
            <button
              onClick={replaceAll}
              disabled={matches.length === 0 || !replaceText}
              className="flex-1 h-8 rounded-lg text-[12px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-30 transition-colors"
            >
              Replace All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
