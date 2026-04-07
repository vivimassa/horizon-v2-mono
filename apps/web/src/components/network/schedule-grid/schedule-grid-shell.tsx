"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, setApiBaseUrl, type ScheduledFlightRef } from "@skyhub/api";
import { useScheduleGridStore, createSmartRow, EMPTY_BUFFER_ROWS } from "@/stores/use-schedule-grid-store";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";
import { useOperatorStore } from "@/stores/use-operator-store";
import { RunwayBar } from "@/components/ui/global-runway-progress";
import { useTheme } from "@/components/theme-provider";
import { ScheduleGrid } from "./schedule-grid";
import { FloatingSaveBar } from "./floating-save-bar";
import { RibbonToolbar } from "./ribbon/ribbon-toolbar";
import { FilterPanel, type FilterParams } from "./filter-panel";
import { FindReplaceDialog } from "./find-replace-dialog";
import { ImportDialog } from "./import-dialog";
import { ExportDialog } from "./export-dialog";
import { ScenarioPanel } from "./scenario-panel";
import { MessageDialog } from "./message-dialog";
import { Plus, RefreshCw } from "lucide-react";

setApiBaseUrl("http://localhost:3002");

export function ScheduleGridShell() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [runwayPercent, setRunwayPercent] = useState(0);
  const [runwayLabel, setRunwayLabel] = useState("");
  const [seasonCode, setSeasonCode] = useState("S26");
  const [rowHeight, setRowHeight] = useState(32);
  const loadRefData = useScheduleRefStore((s) => s.loadAll);
  const loadOperator = useOperatorStore((s) => s.loadOperator);
  const operator = useOperatorStore((s) => s.operator);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const rafRef = useRef(0);
  const didSeedRow = useRef(false);

  // Load reference data + operator config once
  useEffect(() => { loadRefData(); loadOperator(); }, [loadRefData, loadOperator]);
  const rows = useScheduleGridStore((s) => s.rows);
  const setRows = useScheduleGridStore((s) => s.setRows);
  const dirtyMap = useScheduleGridStore((s) => s.dirtyMap);
  const clearDirty = useScheduleGridStore((s) => s.clearDirty);
  const newRowIds = useScheduleGridStore((s) => s.newRowIds);
  const addNewRow = useScheduleGridStore((s) => s.addNewRow);
  const insertRowAt = useScheduleGridStore((s) => s.insertRowAt);
  const clearNewRows = useScheduleGridStore((s) => s.clearNewRows);
  const deletedIds = useScheduleGridStore((s) => s.deletedIds);
  const markDeleted = useScheduleGridStore((s) => s.markDeleted);
  const clearDeleted = useScheduleGridStore((s) => s.clearDeleted);
  const removeNewRow = useScheduleGridStore((s) => s.removeNewRow);
  const selectedCell = useScheduleGridStore((s) => s.selectedCell);
  const selectCell = useScheduleGridStore((s) => s.selectCell);
  const startEditing = useScheduleGridStore((s) => s.startEditing);
  const setFilterPeriod = useScheduleGridStore((s) => s.setFilterPeriod);
  const filterDateFrom = useScheduleGridStore((s) => s.filterDateFrom);
  const filterDateTo = useScheduleGridStore((s) => s.filterDateTo);
  const [showFind, setShowFind] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [scenarioAutoCreate, setScenarioAutoCreate] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Hydrate cellFormats and separators from row formatting data
  const hydrateFormats = useCallback((data: ScheduledFlightRef[]) => {
    const { setCellFormat, clearCellFormats, clearSeparators, addSeparator } = useScheduleGridStore.getState();
    clearCellFormats();
    clearSeparators();
    for (const row of data) {
      if (row.formatting && typeof row.formatting === "object") {
        const fmt = row.formatting as Record<string, unknown>;
        // Hydrate separator
        if (fmt.separatorBelow) {
          addSeparator(row._id);
        }
        // Hydrate cell formats
        for (const [colKey, val] of Object.entries(fmt)) {
          if (colKey === "separatorBelow") continue;
          if (val && typeof val === "object") {
            setCellFormat(row._id, colKey, val as Record<string, unknown>);
          }
        }
      }
    }
  }, []);

  const fetchFlights = useCallback(async () => {
    setLoading(true);
    didSeedRow.current = false;
    setRunwayPercent(0);
    setRunwayLabel("Loading schedule...");

    // Auto-advance animation
    const startTime = performance.now();
    const estMs = 3000;
    const advance = (now: number) => {
      const t = Math.min((now - startTime) / estMs, 1);
      const eased = 1 - Math.pow(1 - t, 2.5);
      setRunwayPercent(eased * 90);
      if (t < 1) rafRef.current = requestAnimationFrame(advance);
    };
    rafRef.current = requestAnimationFrame(advance);

    const minDelay = new Promise((r) => setTimeout(r, 3000));
    try {
      const [data] = await Promise.all([
        api.getScheduledFlights({ operatorId: getOperatorId(), seasonCode }),
        minDelay,
      ]);
      cancelAnimationFrame(rafRef.current);
      setRows(data);
      hydrateFormats(data);
      setRunwayPercent(100);
      setRunwayLabel("Schedule loaded");
      setTimeout(() => {
        setHasLoaded(true);
        setLoading(false);
      }, 800);
    } catch (e) {
      console.error("Failed to load flights:", e);
      cancelAnimationFrame(rafRef.current);
      setRunwayPercent(100);
      setRunwayLabel("Load failed");
      setTimeout(() => setLoading(false), 800);
    }
  }, [seasonCode, setRows]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { rows: storeRows, newRowIds: storeNewRowIds, dirtyMap: storeDirty, deletedIds: storeDel, cellFormats, clearCellFormats, separatorAfter } = useScheduleGridStore.getState();

      // Build per-row formatting from cellFormats + separator state
      const buildFormatting = (rowId: string, existing: Record<string, unknown> = {}) => {
        const fmt: Record<string, unknown> = { ...existing };
        // Cell formats
        for (const [key, value] of cellFormats) {
          if (key.startsWith(rowId + ":")) {
            const colKey = key.slice(rowId.length + 1);
            fmt[colKey] = value;
          }
        }
        // Separator persistence
        if (separatorAfter.has(rowId)) {
          fmt.separatorBelow = true;
        } else {
          delete fmt.separatorBelow;
        }
        return fmt;
      };

      // Build sortOrder map from current grid position (preserves user's row order)
      const sortOrderMap = new Map<string, number>();
      const visibleRows = storeRows.filter((r) => !storeDel.has(r._id));
      visibleRows.forEach((r, i) => sortOrderMap.set(r._id, i));

      // ── Auto-assign rotation IDs, sequences, and labels ──
      // Split visible rows into groups at separator boundaries
      const rotationMap = new Map<string, { rotationId: string; rotationSequence: number; rotationLabel: string }>();
      let currentGroup: typeof visibleRows = [];
      const groups: (typeof visibleRows)[] = [];
      for (const row of visibleRows) {
        currentGroup.push(row);
        if (separatorAfter.has(row._id)) {
          groups.push(currentGroup);
          currentGroup = [];
        }
      }
      if (currentGroup.length > 0) groups.push(currentGroup);

      // Assign rotation data + auto-compute day offsets per group
      const parseHHMM = (t: string): number => {
        if (!t) return 0;
        const clean = t.replace(":", "");
        if (clean.length < 4) return 0;
        return parseInt(clean.slice(0, 2)) * 60 + parseInt(clean.slice(2, 4));
      };
      const getVal = (row: ScheduledFlightRef, field: string): string =>
        (storeDirty.get(row._id)?.[field as keyof ScheduledFlightRef] as string) ?? (row as any)[field] ?? "";

      const acTypeCount = new Map<string, number>();
      for (const group of groups) {
        const rotId = crypto.randomUUID();
        const firstRow = group[0];
        const dirtyAcType = storeDirty.get(firstRow._id)?.aircraftTypeIcao;
        const acType = (dirtyAcType as string) ?? firstRow.aircraftTypeIcao ?? "UNK";
        const count = (acTypeCount.get(acType) ?? 0) + 1;
        acTypeCount.set(acType, count);
        const label = `${acType}-${String(count).padStart(2, "0")}`;

        // Resolve each flight's departure offset (respect user input, fallback to existing value or 1)
        const resolvedFlights = group.map((row) => {
          const stdMin = parseHHMM(getVal(row, "stdUtc"));
          const staMin = parseHHMM(getVal(row, "staUtc"));
          const dirtyDepOffset = storeDirty.get(row._id)?.departureDayOffset;
          const depOffset = dirtyDepOffset != null ? Number(dirtyDepOffset) : (row.departureDayOffset || 1);
          // Arrival offset: if STA <= STD, arrival crosses midnight → next day from departure
          const arrOffset = staMin > 0 && staMin <= stdMin ? depOffset + 1 : depOffset;
          return { row, depOffset, arrOffset, stdMin };
        });

        // Sort within cycle by: offset day first, then STD within the same day
        resolvedFlights.sort((a, b) => a.depOffset - b.depOffset || a.stdMin - b.stdMin);

        resolvedFlights.forEach(({ row, depOffset, arrOffset }, seq) => {
          rotationMap.set(row._id, {
            rotationId: rotId,
            rotationSequence: seq,
            rotationLabel: label,
            departureDayOffset: depOffset,
            arrivalDayOffset: arrOffset,
          });
        });
      }

      // Rebuild sortOrder after rotation sorting
      let orderIdx = 0;
      sortOrderMap.clear();
      for (const group of groups) {
        // Use rotation-sorted order
        const sorted = group.slice().sort((a, b) => {
          const ra = rotationMap.get(a._id);
          const rb = rotationMap.get(b._id);
          return (ra?.rotationSequence ?? 0) - (rb?.rotationSequence ?? 0);
        });
        for (const row of sorted) {
          sortOrderMap.set(row._id, orderIdx++);
        }
      }

      // Delete soft-deleted rows (skip new rows — just discard those)
      const deletePromises = Array.from(storeDel)
        .filter((id) => !storeNewRowIds.has(id))
        .map((id) => api.deleteScheduledFlight(id));
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // Update existing rows — dirty entries + formatting + sortOrder
      const existingUpdates: { id: string; changes: Record<string, unknown> }[] = [];
      const updatedIds = new Set<string>();
      // Rows with dirty data
      for (const [id, changes] of storeDirty.entries()) {
        if (storeNewRowIds.has(id) || storeDel.has(id)) continue;
        const fmt = buildFormatting(id, storeRows.find((r) => r._id === id)?.formatting);
        const rot = rotationMap.get(id);
        existingUpdates.push({ id, changes: { ...changes, formatting: fmt, sortOrder: sortOrderMap.get(id) ?? 0, ...rot } });
        updatedIds.add(id);
      }
      // Rows with formatting only (no dirty data changes)
      for (const [key] of cellFormats) {
        const rowId = key.split(":")[0];
        if (storeNewRowIds.has(rowId) || storeDel.has(rowId) || updatedIds.has(rowId)) continue;
        const row = storeRows.find((r) => r._id === rowId);
        if (!row) continue;
        const fmt = buildFormatting(rowId, row.formatting);
        const rot = rotationMap.get(rowId);
        existingUpdates.push({ id: rowId, changes: { formatting: fmt, sortOrder: sortOrderMap.get(rowId) ?? 0, ...rot } });
        updatedIds.add(rowId);
      }
      // Remaining rows: check sortOrder, separator, or rotation changes
      for (const row of visibleRows) {
        if (storeNewRowIds.has(row._id) || storeDel.has(row._id) || updatedIds.has(row._id)) continue;
        const newOrder = sortOrderMap.get(row._id) ?? 0;
        const hadSeparator = !!(row.formatting as Record<string, unknown>)?.separatorBelow;
        const hasSeparator = separatorAfter.has(row._id);
        const rot = rotationMap.get(row._id);
        const rotChanged = rot && (row.rotationId !== rot.rotationId || row.rotationSequence !== rot.rotationSequence || row.rotationLabel !== rot.rotationLabel);
        if (row.sortOrder !== newOrder || hadSeparator !== hasSeparator || rotChanged) {
          const fmt = buildFormatting(row._id, row.formatting);
          existingUpdates.push({ id: row._id, changes: { formatting: fmt, sortOrder: newOrder, ...rot } });
        }
      }
      if (existingUpdates.length > 0) {
        await api.updateScheduledFlightsBulk(existingUpdates);
      }

      // Create new rows (excluding soft-deleted ones and incomplete rows)
      const survivingNewRows = storeRows.filter((r) => storeNewRowIds.has(r._id) && !storeDel.has(r._id));
      if (survivingNewRows.length > 0) {
        const mergedNewRows = survivingNewRows.map((row) => {
          const dirty = storeDirty.get(row._id);
          const fmt = buildFormatting(row._id, row.formatting);
          const order = sortOrderMap.get(row._id) ?? 0;
          const rot = rotationMap.get(row._id) ?? {};
          const base = dirty ? { ...row, ...dirty } : { ...row };
          return { ...base, formatting: fmt, sortOrder: order, ...rot };
        }).filter((r) => {
          // Skip rows with empty required fields (e.g., blank rows from paste)
          return r.depStation && r.arrStation && r.flightNumber && r.stdUtc && r.staUtc && r.daysOfWeek && r.effectiveFrom && r.effectiveUntil;
        });
        if (mergedNewRows.length > 0) {
          await api.createScheduledFlightsBulk(mergedNewRows);
        }
      }

      clearDirty();
      clearNewRows();
      clearDeleted();
      clearCellFormats();
      // Silent refresh — no runway animation, then hydrate formats
      try {
        const data = await api.getScheduledFlights({ operatorId: getOperatorId(), seasonCode });
        setRows(data);
        hydrateFormats(data);
      } catch (_) { /* grid already cleared, user can re-fetch via Go */ }
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [seasonCode, clearDirty, clearNewRows, clearDeleted, setRows]);

  const handleDiscard = useCallback(() => {
    clearDirty();
    clearNewRows();
    clearDeleted();
  }, [clearDirty, clearNewRows, clearDeleted]);

  const handleAddFlight = useCallback((focusCol = "aircraftTypeIcao", insertAtIdx?: number) => {
    const store = useScheduleGridStore.getState();
    const visibleRows = store.rows.filter((r) => !store.deletedIds.has(r._id));
    const getTat = useScheduleRefStore.getState().getTatMinutes;
    const opts: import("@/stores/use-schedule-grid-store").SmartRowOptions = {
      filterDateFrom: filterDateFrom || undefined,
      filterDateTo: filterDateTo || undefined,
      seasonCode,
      airlineCode: operator?.iataCode || undefined,
    };

    if (insertAtIdx != null && insertAtIdx < visibleRows.length) {
      // Use only rows above insertion point as context (so DEP/STD chain from the row above, not the last row)
      const contextRows = visibleRows.slice(0, insertAtIdx);
      const smart = createSmartRow(contextRows, store.dirtyMap, getTat, opts);
      insertRowAt(smart, insertAtIdx);
      requestAnimationFrame(() => selectCell({ rowIdx: insertAtIdx, colKey: focusCol }));
    } else {
      const smart = createSmartRow(visibleRows, store.dirtyMap, getTat, opts);
      addNewRow(smart);
      requestAnimationFrame(() => {
        const newLen = useScheduleGridStore.getState().rows.filter((r) => !useScheduleGridStore.getState().deletedIds.has(r._id)).length;
        selectCell({ rowIdx: newLen - 1, colKey: focusCol });
      });
    }
  }, [seasonCode, addNewRow, insertRowAt, filterDateFrom, filterDateTo, selectCell, operator]);

  const handleTabWrapDown = useCallback(() => {
    handleAddFlight("arrStation");
    // After React renders the new row, start editing ARR on that row
    setTimeout(() => {
      const { rows: sr, deletedIds: sd } = useScheduleGridStore.getState();
      const newRowIdx = sr.filter((r) => !sd.has(r._id)).length - 1;
      startEditing({ rowIdx: newRowIdx, colKey: "arrStation" });
    }, 50);
  }, [handleAddFlight, startEditing]);

  // When grid first appears: ensure at least one row exists, then focus AC TYPE
  useEffect(() => {
    if (!hasLoaded || loading || didSeedRow.current) return;
    didSeedRow.current = true;
    const { rows: sr, deletedIds: sd } = useScheduleGridStore.getState();
    const visibleCount = sr.filter((r) => !sd.has(r._id)).length;
    if (visibleCount === 0) {
      handleAddFlight();
    }
    requestAnimationFrame(() => selectCell({ rowIdx: 0, colKey: "aircraftTypeIcao" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoaded, loading]);

  return (
    <div className="flex h-full overflow-hidden gap-3 p-3">
      {/* Left filter panel */}
      <FilterPanel
        seasonCode={seasonCode}
        onSeasonChange={setSeasonCode}
        onApplyFilters={(filters) => {
          setSeasonCode(filters.seasonCode);
          setFilterPeriod(filters.dateFrom, filters.dateTo);
          fetchFlights();
        }}
        loading={loading}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden gap-3 min-w-0 relative">

      {/* ── Empty state: before first load ── */}
      {!hasLoaded && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center rounded-2xl" style={{
          background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/skyhub-logo.png"
            alt=""
            aria-hidden="true"
            data-watermark
            className="select-none mb-6"
            style={{
              width: 360,
              filter: isDark ? 'brightness(10) grayscale(1)' : 'grayscale(1) brightness(0)',
              opacity: isDark ? 0.051 : 0.038,
            }}
            draggable={false}
          />
          <p className="text-[14px] text-hz-text-secondary" style={{ opacity: 0.64 }}>Select a period and click Go to load the schedule</p>
        </div>
      )}

      {/* ── Loading: runway animation ── */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/skyhub-logo.png"
            alt=""
            aria-hidden="true"
            data-watermark
            className="select-none mb-10"
            style={{
              width: 400,
              filter: isDark ? 'brightness(10) grayscale(1)' : 'grayscale(1) brightness(0)',
              opacity: isDark ? 0.051 : 0.038,
              animation: 'grp-logo-breathe 3s ease-in-out infinite',
            }}
            draggable={false}
          />
          <div className="w-full max-w-2xl px-4" style={{ opacity: 0.8 }}>
            <RunwayBar percent={runwayPercent} label={runwayLabel} />
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes grp-logo-breathe {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.7; transform: scale(1.02); }
            }
          `}} />
        </div>
      )}

      {/* ── Loaded: full grid UI ── */}
      {hasLoaded && !loading && (
        <>
          {/* Import dialog */}
          {showImport && (
            <ImportDialog seasonCode={seasonCode} scenarioId={activeScenarioId ?? undefined} onClose={() => setShowImport(false)} onImported={fetchFlights} />
          )}

          {/* Export dialog */}
          {showExport && (
            <ExportDialog seasonCode={seasonCode} scenarioId={activeScenarioId ?? undefined} flightCount={rows.length} dateFrom={filterDateFrom} dateTo={filterDateTo} onClose={() => setShowExport(false)} />
          )}

          {/* Scenario panel */}
          {showScenarios && (
            <ScenarioPanel seasonCode={seasonCode} activeScenarioId={activeScenarioId} onSelectScenario={setActiveScenarioId} onClose={() => { setShowScenarios(false); setScenarioAutoCreate(false); }} autoCreate={scenarioAutoCreate} />
          )}

          {/* Message dialog */}
          {showMessages && (
            <MessageDialog seasonCode={seasonCode} targetScenarioId={activeScenarioId ?? undefined} onClose={() => setShowMessages(false)} />
          )}

          {/* Ribbon toolbar */}
          <RibbonToolbar
            onAddFlight={() => handleAddFlight()}
            onInsertFlight={() => {
              const { selectedCell: sel, selectionRange: range } = useScheduleGridStore.getState();
              if (sel) {
                const count = range
                  ? Math.abs(range.endRow - range.startRow) + 1
                  : 1;
                const startIdx = range ? Math.min(range.startRow, range.endRow) : sel.rowIdx;
                for (let i = 0; i < count; i++) {
                  handleAddFlight("aircraftTypeIcao", startIdx);
                }
              } else {
                handleAddFlight();
              }
            }}
            onDeleteFlight={() => {
              if (!selectedCell) return;
              const visibleRows = rows.filter((r) => !deletedIds.has(r._id));
              const row = visibleRows[selectedCell.rowIdx];
              if (!row) return;
              if (newRowIds.has(row._id)) {
                // New row (not yet on server): just remove from local state
                removeNewRow(row._id);
              } else {
                // Existing server row: soft-delete (will be deleted on save)
                markDeleted(row._id);
              }
            }}
            onSave={handleSave}
            onImport={() => setShowImport(true)}
            onExport={() => setShowExport(true)}
            onScenario={() => setShowScenarios(true)}
            onMessage={() => setShowMessages(true)}
            onFind={() => setShowFind(true)}
            onReplace={() => setShowReplace(true)}
            onSaveAs={() => { setScenarioAutoCreate(true); setShowScenarios(true); }}
            hasDirty={dirtyMap.size > 0 || newRowIds.size > 0 || deletedIds.size > 0}
            hasSelection={selectedCell !== null}
            saving={saving}
            rowHeight={rowHeight}
            onRowHeightChange={setRowHeight}
          />

          {/* Grid */}
          <ScheduleGrid
            rows={rows.filter((r) => !deletedIds.has(r._id))}
            onSave={handleSave}
            onAddFlight={(insertAtIdx) => handleAddFlight("aircraftTypeIcao", insertAtIdx)}
            onTabWrapDown={handleTabWrapDown}
            onDeleteFlight={(rowIdx) => {
              const visibleRows = rows.filter((r) => !deletedIds.has(r._id));
              const row = visibleRows[rowIdx];
              if (!row) return;
              if (newRowIds.has(row._id)) {
                removeNewRow(row._id);
              } else {
                markDeleted(row._id);
              }
            }}
            onOpenFind={() => setShowFind(true)}
            onOpenReplace={() => setShowReplace(true)}
            rowHeight={rowHeight}
            showFind={showFind || showReplace}
            showReplace={showReplace}
            onCloseFind={() => { setShowFind(false); setShowReplace(false); }}
          />

          {/* Floating save bar */}
          <FloatingSaveBar
            dirtyCount={dirtyMap.size}
            newCount={newRowIds.size}
            deletedCount={deletedIds.size}
            saving={saving}
            onSave={handleSave}
            onDiscard={handleDiscard}
          />
        </>
      )}
    </div>
    </div>
  );
import { getOperatorId } from "@/stores/use-operator-store"
}
