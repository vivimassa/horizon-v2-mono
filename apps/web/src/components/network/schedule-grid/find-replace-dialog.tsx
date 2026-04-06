"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { X, ChevronUp, ChevronDown, Replace } from "lucide-react";
import type { ScheduledFlightRef } from "@skyhub/api";
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
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const selectCell = useScheduleGridStore((s) => s.selectCell);
  const markDirty = useScheduleGridStore((s) => s.markDirty);

  // Find all matches
  const matches = useMemo<Match[]>(() => {
    if (!query) return [];
    const q = matchCase ? query : query.toLowerCase();
    const results: Match[] = [];
    rows.forEach((row, rowIdx) => {
      for (const col of GRID_COLUMNS) {
        const val = (row as any)[col.key];
        if (val == null) continue;
        const str = matchCase ? String(val) : String(val).toLowerCase();
        if (str.includes(q)) {
          results.push({ rowIdx, colKey: col.key, rowId: row._id });
        }
      }
    });
    return results;
  }, [rows, query, matchCase]);

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

  // Keyboard: Escape closes, Enter finds next
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") { e.preventDefault(); findNext(); }
  };

  return (
    <div
      className="absolute top-2 right-4 z-30 w-80 rounded-xl border border-hz-border bg-hz-card shadow-xl p-4 space-y-3"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold">{showReplace ? "Find & Replace" : "Find"}</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-hz-border/30 transition-colors">
          <X size={14} className="text-hz-text-secondary" />
        </button>
      </div>

      {/* Find input */}
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCurrentIdx(0); }}
          placeholder="Find..."
          className="w-full px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent text-hz-text"
          autoFocus
        />
      </div>

      {/* Replace input */}
      {showReplace && (
        <input
          type="text"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          placeholder="Replace with..."
          className="w-full px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent text-hz-text"
        />
      )}

      {/* Options */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[12px] text-hz-text-secondary cursor-pointer">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} className="accent-module-accent" />
          Match case
        </label>
        <span className="text-[12px] text-hz-text-tertiary ml-auto">
          {matches.length > 0 ? `${currentIdx + 1} of ${matches.length}` : query ? "No matches" : ""}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={findPrev} disabled={matches.length === 0}
          className="p-2 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 disabled:opacity-30 transition-colors" title="Previous">
          <ChevronUp size={14} />
        </button>
        <button onClick={findNext} disabled={matches.length === 0}
          className="p-2 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 disabled:opacity-30 transition-colors" title="Next">
          <ChevronDown size={14} />
        </button>

        {showReplace && (
          <>
            <div className="w-px h-5 bg-hz-border/50" />
            <button onClick={replaceCurrent} disabled={matches.length === 0 || !replaceText}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 disabled:opacity-30 transition-colors">
              Replace
            </button>
            <button onClick={replaceAll} disabled={matches.length === 0 || !replaceText}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white bg-module-accent hover:opacity-90 disabled:opacity-30 transition-colors">
              Replace All
            </button>
          </>
        )}
      </div>
    </div>
  );
}
