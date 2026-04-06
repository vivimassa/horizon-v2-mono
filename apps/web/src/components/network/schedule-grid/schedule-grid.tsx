"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScheduledFlightRef } from "@skyhub/api";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { GRID_COLUMNS, ROW_HEIGHT } from "./grid-columns";
import { useGridKeyboard } from "./use-grid-keyboard";
import { useGridSortStore, sortRows } from "./use-grid-sort";
import { GridContextMenu, type ContextMenuState } from "./context-menu";
import { useTheme } from "@/components/theme-provider";

interface ScheduleGridProps {
  rows: ScheduledFlightRef[];
  onSave: () => void;
  onAddFlight: () => void;
  onDeleteFlight: (rowIdx: number) => void;
  onTabWrapDown?: () => void;
  onOpenFind?: () => void;
  onOpenReplace?: () => void;
}

const SEPARATOR_HEIGHT = 12;

export function ScheduleGrid({
  rows, onSave, onAddFlight, onDeleteFlight, onTabWrapDown, onOpenFind, onOpenReplace,
}: ScheduleGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedCell = useScheduleGridStore((s) => s.selectedCell);
  const newRows = useScheduleGridStore((s) => s.newRows);
  const separatorAfter = useScheduleGridStore((s) => s.separatorAfter);
  const addSeparator = useScheduleGridStore((s) => s.addSeparator);
  const removeSeparator = useScheduleGridStore((s) => s.removeSeparator);
  const copyCell = useScheduleGridStore((s) => s.copyCell);
  const cutCell = useScheduleGridStore((s) => s.cutCell);
  const pasteCell = useScheduleGridStore((s) => s.pasteCell);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  // Global capture-phase keyboard handler
  useGridKeyboard({ onSave, onAddFlight, onDeleteFlight, onTabWrapDown, onOpenFind, onOpenReplace });

  // Sorting + column filters
  const sortKey = useGridSortStore((s) => s.sortKey);
  const sortDir = useGridSortStore((s) => s.sortDir);
  const [columnFilters, setColumnFilters] = useState<Map<string, Set<string>>>(new Map());

  const handleApplyFilter = useCallback((colKey: string, values: Set<string>) => {
    setColumnFilters((prev) => {
      const next = new Map(prev);
      const allValues = new Set<string>();
      for (const row of rows) {
        const v = (row as any)[colKey];
        if (v != null && v !== "") allValues.add(String(v));
      }
      if (values.size >= allValues.size) next.delete(colKey);
      else next.set(colKey, values);
      return next;
    });
  }, [rows]);

  const deletedIds = useScheduleGridStore((s) => s.deletedIds);

  const processedRows = useMemo(() => {
    let result = [...rows, ...newRows].filter((r) => !deletedIds.has(r._id));
    for (const [colKey, allowedValues] of columnFilters) {
      result = result.filter((row) => {
        const v = (row as any)[colKey];
        return v != null && allowedValues.has(String(v));
      });
    }
    return sortRows(result, sortKey, sortDir);
  }, [rows, newRows, deletedIds, columnFilters, sortKey, sortDir]);

  // Pad with empty placeholder rows to fill viewport (Excel-like)
  const [viewportHeight, setViewportHeight] = useState(600);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const headerHeight = 36; // approximate header row height
  const minRows = Math.max(1, Math.ceil((viewportHeight - headerHeight) / ROW_HEIGHT));
  const emptyRowCount = Math.max(0, minRows - processedRows.length);

  // Build virtual list with separator rows + empty padding injected
  type VirtualItem = { type: "data"; rowIdx: number } | { type: "separator"; afterRowIdx: number } | { type: "empty"; emptyIdx: number };
  const virtualItems = useMemo<VirtualItem[]>(() => {
    const items: VirtualItem[] = [];
    for (let i = 0; i < processedRows.length; i++) {
      items.push({ type: "data", rowIdx: i });
      if (separatorAfter.has(i)) {
        items.push({ type: "separator", afterRowIdx: i });
      }
    }
    for (let i = 0; i < emptyRowCount; i++) {
      items.push({ type: "empty", emptyIdx: i });
    }
    return items;
  }, [processedRows, separatorAfter, emptyRowCount]);

  // Virtualization
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => virtualItems[i].type === "separator" ? SEPARATOR_HEIGHT : ROW_HEIGHT,
    overscan: 50,
  });

  useEffect(() => {
    if (selectedCell) {
      // Find the virtual index for this data row
      const vIdx = virtualItems.findIndex((v) => v.type === "data" && v.rowIdx === selectedCell.rowIdx);
      if (vIdx >= 0) virtualizer.scrollToIndex(vIdx, { align: "auto" });
    }
  }, [selectedCell, virtualizer, virtualItems]);

  const handleContextMenu = useCallback((e: React.MouseEvent, rowIdx: number, colKey: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, rowIdx, colKey });
  }, []);

  const glassBg = isDark ? "rgba(25,25,33,0.85)" : "rgba(255,255,255,0.85)";
  const glassBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const sepColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const totalColSpan = GRID_COLUMNS.length + 1; // +1 for row number column

  return (
    <>
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto select-none focus:outline-none rounded-2xl"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: "blur(20px)" }}
        tabIndex={0}
      >
        <table
          className="w-full text-[13px] font-mono"
          style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
        >
          <GridHeader
            scrollLeft={0}
            rows={rows}
            columnFilters={columnFilters}
            onApplyFilter={handleApplyFilter}
          />
          <tbody>
            {virtualizer.getVirtualItems().map((vRow) => {
              const item = virtualItems[vRow.index];
              if (!item) return null;

              if (item.type === "separator") {
                return (
                  <tr key={`sep-${item.afterRowIdx}`} style={{ height: SEPARATOR_HEIGHT }}>
                    <td colSpan={totalColSpan} style={{ background: sepColor, padding: 0, border: "none" }} />
                  </tr>
                );
              }

              if (item.type === "empty") {
                return (
                  <tr key={`empty-${item.emptyIdx}`} style={{ height: ROW_HEIGHT }}>
                    <td
                      colSpan={totalColSpan}
                      style={{
                        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                        padding: 0,
                      }}
                    />
                  </tr>
                );
              }

              const row = processedRows[item.rowIdx];
              if (!row) return null;
              return (
                <GridRow
                  key={row._id}
                  row={row}
                  rowIdx={item.rowIdx}
                  prevRow={item.rowIdx > 0 ? processedRows[item.rowIdx - 1] : null}
                  onContextMenu={handleContextMenu}
                  onTabWrapDown={onTabWrapDown}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Context menu — portalled to document.body so scroll/stacking context doesn't offset it */}
      {ctxMenu && createPortal(
        <GridContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onInsertRow={onAddFlight}
          onDeleteRow={() => onDeleteFlight(ctxMenu.rowIdx)}
          onSeparateCycle={() => addSeparator(ctxMenu.rowIdx)}
          onRemoveSeparator={() => removeSeparator(ctxMenu.rowIdx)}
          hasSeparator={separatorAfter.has(ctxMenu.rowIdx)}
          onCopy={copyCell}
          onCut={cutCell}
          onPaste={() => pasteCell()}
          hasSelection={!!selectedCell}
        />,
        document.body
      )}
    </>
  );
}
