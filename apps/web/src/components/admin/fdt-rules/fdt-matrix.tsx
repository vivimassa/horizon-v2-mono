"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { FdtlTableRef, FdtlTableCellRef } from "@skyhub/api";
import { accentTint } from "@skyhub/ui/theme";
import { Table2, RotateCcw } from "lucide-react";
import { ACCENT } from "./fdt-rules-shell";

interface Props {
  table: FdtlTableRef;
  isDark: boolean;
  onCellChange: (tableId: string, rowKey: string, colKey: string, valueMinutes: number | null) => Promise<void>;
  onResetTable: (tableId: string) => Promise<void>;
}

/** Format "HHMM-HHMM" or "HHMM" row labels as "HH:MM-HH:MM" */
function formatRowLabel(label: string): string {
  return label.replace(/\b(\d{2})(\d{2})\b/g, "$1:$2");
}

export function FdtMatrix({ table, isDark, onCellChange, onResetTable }: Props) {
  const hasModified = table.cells.some(c => !c.isTemplateDefault);
  // Track which cell is being edited: "rowKey|colKey" or null
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // Build ordered list of editable cell coords for Tab navigation
  const editableCells: { rowKey: string; colKey: string }[] = [];
  for (const rk of table.rowKeys) {
    for (const ck of table.colKeys) {
      const cell = table.cells.find(c => c.rowKey === rk && c.colKey === ck);
      // Skip prohibited (null) and N/A (-1) cells
      if (cell && cell.valueMinutes !== null && cell.valueMinutes !== -1) {
        editableCells.push({ rowKey: rk, colKey: ck });
      }
    }
  }

  const startEditing = useCallback((rowKey: string, colKey: string) => {
    const cell = table.cells.find(c => c.rowKey === rowKey && c.colKey === colKey);
    setDraft(cell?.displayValue ?? "");
    setEditingKey(`${rowKey}|${colKey}`);
  }, [table.cells]);

  const commitAndMove = useCallback(async (direction: "next" | "prev" | "stay") => {
    if (!editingKey) return;
    const [rk, ck] = editingKey.split("|");

    // Parse and save
    const trimmed = draft.trim();
    if (trimmed) {
      let minutes: number;
      if (trimmed.includes(":")) {
        const [h, m] = trimmed.split(":").map(Number);
        minutes = (h || 0) * 60 + (m || 0);
      } else {
        minutes = parseInt(trimmed) || 0;
      }
      const cell = table.cells.find(c => c.rowKey === rk && c.colKey === ck);
      if (minutes !== cell?.valueMinutes) {
        await onCellChange(table._id, rk, ck, minutes);
      }
    }

    // Move to next/prev cell
    if (direction === "stay") {
      setEditingKey(null);
      return;
    }

    const curIdx = editableCells.findIndex(c => c.rowKey === rk && c.colKey === ck);
    const nextIdx = direction === "next" ? curIdx + 1 : curIdx - 1;
    if (nextIdx >= 0 && nextIdx < editableCells.length) {
      const next = editableCells[nextIdx];
      startEditing(next.rowKey, next.colKey);
    } else {
      setEditingKey(null);
    }
  }, [editingKey, draft, table, onCellChange, editableCells, startEditing]);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1.5">
        <Table2 size={14} style={{ color: ACCENT }} />
        <span className="text-[15px] font-bold">{table.label}</span>
        <span className="text-[13px] text-hz-text-tertiary ml-1">({table.cells.length} cells)</span>
        {hasModified && (
          <button
            onClick={() => onResetTable(table._id)}
            className="ml-auto flex items-center gap-1 text-[13px] font-medium text-hz-text-tertiary hover:text-amber-600 transition-colors"
            title="Reset all cells to regulatory defaults"
          >
            <RotateCcw size={12} /> Reset all
          </button>
        )}
      </div>
      {table.legalReference && (
        <p className="text-[13px] text-hz-text-tertiary mb-2">{table.legalReference}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-hz-border shadow-sm">
        <table className="w-full text-[13px]" style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 px-4 py-2.5 text-left font-medium uppercase tracking-wider text-hz-text-tertiary bg-hz-bg border-b border-r border-hz-border" style={{ minWidth: 220 }}>
                {table.rowAxisLabel ?? "Row"}
              </th>
              {table.colLabels.map((cl, ci) => (
                <th key={ci} className="px-3 py-2.5 text-center font-medium uppercase tracking-wider text-hz-text-tertiary bg-hz-bg border-b border-hz-border whitespace-nowrap" style={{ minWidth: 72 }}>
                  {cl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rowKeys.map((rk, ri) => (
              <tr key={rk} className={ri % 2 === 0 ? "" : "bg-hz-border/[0.04]"}>
                <td className="sticky left-0 z-10 px-4 py-2.5 font-medium font-mono tabular-nums text-hz-text border-r border-hz-border bg-hz-bg whitespace-nowrap" style={{ minWidth: 220 }}>
                  {formatRowLabel(table.rowLabels[ri] ?? rk)}
                </td>
                {table.colKeys.map(ck => {
                  const cell = table.cells.find(c => c.rowKey === rk && c.colKey === ck);
                  const cellKey = `${rk}|${ck}`;
                  const isEditing = editingKey === cellKey;
                  return (
                    <MatrixCell
                      key={ck}
                      cell={cell ?? null}
                      isDark={isDark}
                      isEditing={isEditing}
                      draft={isEditing ? draft : ""}
                      onDraftChange={setDraft}
                      onStartEdit={() => startEditing(rk, ck)}
                      onCommit={(dir) => commitAndMove(dir)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Cell ─── */

function MatrixCell({
  cell,
  isDark,
  isEditing,
  draft,
  onDraftChange,
  onStartEdit,
  onCommit,
}: {
  cell: { valueMinutes: number | null; displayValue: string | null; isTemplateDefault: boolean; source: string } | null;
  isDark: boolean;
  isEditing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onCommit: (direction: "next" | "prev" | "stay") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const isProhibited = cell?.valueMinutes === null;
  const isNA = cell?.valueMinutes === -1;
  const isModified = cell && !cell.isTemplateDefault;

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.select();
  }, [isEditing]);

  if (isProhibited) {
    return (
      <td className="px-3 py-2.5 text-center">
        <span className="text-red-400 font-semibold">—</span>
      </td>
    );
  }

  if (isNA) {
    return (
      <td className="px-3 py-2.5 text-center">
        <span className="text-hz-text-tertiary">N/A</span>
      </td>
    );
  }

  if (isEditing) {
    return (
      <td className="px-3 py-2.5 text-center">
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={() => onCommit("stay")}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              onCommit(e.shiftKey ? "prev" : "next");
            }
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit("next");
            }
            if (e.key === "Escape") onCommit("stay");
          }}
          className="w-14 h-7 text-center text-[13px] font-mono font-bold rounded-md border-2 outline-none bg-hz-bg text-hz-text"
          style={{ borderColor: ACCENT }}
        />
      </td>
    );
  }

  return (
    <td
      className="px-3 py-2.5 text-center cursor-pointer transition-colors hover:bg-hz-border/20"
      style={{
        backgroundColor: isModified ? accentTint(ACCENT, isDark ? 0.08 : 0.05) : undefined,
      }}
      onClick={onStartEdit}
    >
      <span
        className={`font-mono tabular-nums ${isModified ? "font-bold" : ""}`}
        style={isModified ? { color: ACCENT } : undefined}
      >
        {cell?.displayValue ?? "—"}
      </span>
      {isModified && (
        <span className="inline-block w-1 h-1 rounded-full ml-0.5 align-super" style={{ backgroundColor: ACCENT }} />
      )}
    </td>
  );
}
