"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, setApiBaseUrl, type ScheduledFlightRef } from "@skyhub/api";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
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
  const loadRefData = useScheduleRefStore((s) => s.loadAll);
  const getTatMinutes = useScheduleRefStore((s) => s.getTatMinutes);
  const loadOperator = useOperatorStore((s) => s.loadOperator);
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
  const newRows = useScheduleGridStore((s) => s.newRows);
  const addNewRow = useScheduleGridStore((s) => s.addNewRow);
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
  const [showMessages, setShowMessages] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Hydrate cellFormats from row formatting data
  const hydrateFormats = useCallback((data: ScheduledFlightRef[]) => {
    const { setCellFormat, clearCellFormats } = useScheduleGridStore.getState();
    clearCellFormats();
    for (const row of data) {
      if (row.formatting && typeof row.formatting === "object") {
        for (const [colKey, fmt] of Object.entries(row.formatting)) {
          if (fmt && typeof fmt === "object") {
            setCellFormat(row._id, colKey, fmt as Record<string, unknown>);
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
    const estMs = 4000;
    const advance = (now: number) => {
      const t = Math.min((now - startTime) / estMs, 1);
      const eased = 1 - Math.pow(1 - t, 2.5);
      setRunwayPercent(eased * 90);
      if (t < 1) rafRef.current = requestAnimationFrame(advance);
    };
    rafRef.current = requestAnimationFrame(advance);

    const minDelay = new Promise((r) => setTimeout(r, 4000));
    try {
      const [data] = await Promise.all([
        api.getScheduledFlights({ operatorId: "horizon", seasonCode }),
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
      const { rows: storeRows, newRows: storeNewRows, dirtyMap: storeDirty, deletedIds: storeDel, cellFormats, clearCellFormats } = useScheduleGridStore.getState();
      const newRowIds = new Set(storeNewRows.map((r) => r._id));

      // Build per-row formatting from cellFormats
      const buildFormatting = (rowId: string, existing: Record<string, unknown> = {}) => {
        const fmt: Record<string, unknown> = { ...existing };
        for (const [key, value] of cellFormats) {
          if (key.startsWith(rowId + ":")) {
            const colKey = key.slice(rowId.length + 1);
            fmt[colKey] = value;
          }
        }
        return fmt;
      };

      // Delete soft-deleted rows (skip new rows — just discard those)
      const deletePromises = Array.from(storeDel)
        .filter((id) => !newRowIds.has(id))
        .map((id) => api.deleteScheduledFlight(id));
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // Update existing rows — dirty entries + formatting changes
      const existingUpdates: { id: string; changes: Record<string, unknown> }[] = [];
      // Rows with dirty data
      for (const [id, changes] of storeDirty.entries()) {
        if (newRowIds.has(id) || storeDel.has(id)) continue;
        const fmt = buildFormatting(id, storeRows.find((r) => r._id === id)?.formatting);
        existingUpdates.push({ id, changes: { ...changes, formatting: fmt } });
      }
      // Rows with formatting only (no dirty data changes)
      for (const [key] of cellFormats) {
        const rowId = key.split(":")[0];
        if (newRowIds.has(rowId) || storeDel.has(rowId)) continue;
        if (storeDirty.has(rowId)) continue; // already handled above
        const row = storeRows.find((r) => r._id === rowId);
        if (!row) continue;
        const fmt = buildFormatting(rowId, row.formatting);
        existingUpdates.push({ id: rowId, changes: { formatting: fmt } });
      }
      if (existingUpdates.length > 0) {
        await api.updateScheduledFlightsBulk(existingUpdates);
      }

      // Create new rows (excluding soft-deleted ones)
      const survivingNewRows = storeNewRows.filter((r) => !storeDel.has(r._id));
      if (survivingNewRows.length > 0) {
        const mergedNewRows = survivingNewRows.map((row) => {
          const dirty = storeDirty.get(row._id);
          const fmt = buildFormatting(row._id, row.formatting);
          return dirty ? { ...row, ...dirty, formatting: fmt } : { ...row, formatting: fmt };
        });
        await api.createScheduledFlightsBulk(mergedNewRows);
      }

      clearDirty();
      clearNewRows();
      clearDeleted();
      clearCellFormats();
      // Silent refresh — no runway animation, then hydrate formats
      try {
        const data = await api.getScheduledFlights({ operatorId: "horizon", seasonCode });
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

  const handleAddFlight = useCallback((focusCol = "aircraftTypeIcao") => {
    const id = crypto.randomUUID();

    // Read latest state from store (avoids stale closures and unnecessary deps)
    const { rows: storeRows, newRows: storeNewRows, dirtyMap: storeDirtyMap, deletedIds: storeDeleted } = useScheduleGridStore.getState();
    const allRows = [...storeRows, ...storeNewRows].filter((r) => !storeDeleted.has(r._id));
    const lastRow = allRows[allRows.length - 1];
    const lastDirty = lastRow ? storeDirtyMap.get(lastRow._id) : undefined;
    const defaultFrom = (lastDirty?.effectiveFrom as string) ?? lastRow?.effectiveFrom ?? filterDateFrom ?? "";
    const defaultTo = (lastDirty?.effectiveUntil as string) ?? lastRow?.effectiveUntil ?? filterDateTo ?? "";

    // Detect closed cycle: walk backwards to find the start of the current rotation.
    // If the last row's ARR equals the rotation start DEP, the cycle is complete.
    const lastArr = (lastDirty?.arrStation as string) ?? lastRow?.arrStation ?? "";
    let cycleClosed = false;
    if (lastRow && lastArr) {
      // Find the first row of the current rotation by walking backwards
      // until DEP doesn't match the previous row's ARR (i.e. chain breaks)
      let rotationStartDep = "";
      for (let i = allRows.length - 1; i >= 0; i--) {
        const r = allRows[i];
        const rd = storeDirtyMap.get(r._id);
        const dep = (rd?.depStation as string) ?? r.depStation ?? "";
        if (i === allRows.length - 1) {
          // last row — continue
        } else {
          const nextRow = allRows[i + 1];
          const nextDirty = storeDirtyMap.get(nextRow._id);
          const nextDep = (nextDirty?.depStation as string) ?? nextRow.depStation ?? "";
          const thisArr = (rd?.arrStation as string) ?? r.arrStation ?? "";
          if (thisArr !== nextDep) {
            // Chain breaks here — rotation started at i+1
            const startRow = allRows[i + 1];
            const startDirty = storeDirtyMap.get(startRow._id);
            rotationStartDep = (startDirty?.depStation as string) ?? startRow.depStation ?? "";
            break;
          }
        }
        if (i === 0) {
          rotationStartDep = dep;
        }
      }
      cycleClosed = rotationStartDep !== "" && lastArr.toUpperCase() === rotationStartDep.toUpperCase();
    }

    // If cycle is closed, start fresh — no inherited DEP/STD
    const defaultDep = cycleClosed ? "" : lastArr;
    const prevAcType = (lastDirty?.aircraftTypeIcao as string) ?? lastRow?.aircraftTypeIcao ?? "";

    let defaultStd = "";
    if (!cycleClosed) {
      const prevSta = (lastDirty?.staUtc as string) ?? lastRow?.staUtc ?? "";
      if (prevSta && prevAcType) {
        const prevDep = (lastDirty?.depStation as string) ?? lastRow?.depStation ?? "";
        const prevArr = lastArr;
        const tatMin = getTatMinutes(prevAcType, prevDep, prevArr);
        if (tatMin != null) {
          const clean = prevSta.replace(":", "");
          const hh = clean.length >= 3 ? Number(clean.slice(0, clean.length - 2)) : NaN;
          const mm = clean.length >= 3 ? Number(clean.slice(-2)) : NaN;
          if (!isNaN(hh) && !isNaN(mm)) {
            const totalMin = hh * 60 + mm + tatMin;
            const h = Math.floor(totalMin / 60) % 24;
            const m = totalMin % 60;
            defaultStd = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          }
        }
      }
    }

    addNewRow({
      _id: id,
      operatorId: "horizon",
      seasonCode,
      airlineCode: "HZ",
      flightNumber: "",
      suffix: null,
      depStation: defaultDep,
      arrStation: "",
      depAirportId: null,
      arrAirportId: null,
      stdUtc: defaultStd,
      staUtc: "",
      stdLocal: null,
      staLocal: null,
      blockMinutes: null,
      arrivalDayOffset: 0,
      daysOfWeek: (lastDirty?.daysOfWeek as string) ?? lastRow?.daysOfWeek ?? "1234567",
      aircraftTypeId: cycleClosed ? null : ((lastDirty?.aircraftTypeId as string) ?? lastRow?.aircraftTypeId ?? null),
      aircraftTypeIcao: cycleClosed ? null : (prevAcType || null),
      aircraftReg: null,
      serviceType: (lastDirty?.serviceType as string) ?? lastRow?.serviceType ?? "J",
      status: "draft",
      previousStatus: null,
      effectiveFrom: defaultFrom,
      effectiveUntil: defaultTo,
      cockpitCrewRequired: null,
      cabinCrewRequired: null,
      isEtops: false,
      isOverwater: false,
      isActive: true,
      scenarioId: null,
      rotationId: null,
      rotationSequence: null,
      rotationLabel: null,
      source: "manual",
      formatting: {},
      createdAt: null,
      updatedAt: null,
    });

    // Focus on the newly added row
    const visibleDataCount = storeRows.filter((r) => !storeDeleted.has(r._id)).length;
    const visibleNewCount = storeNewRows.filter((r) => !storeDeleted.has(r._id)).length;
    const newRowIdx = visibleDataCount + visibleNewCount; // index of the row we just added
    requestAnimationFrame(() => selectCell({ rowIdx: newRowIdx, colKey: focusCol }));
  }, [seasonCode, addNewRow, filterDateFrom, filterDateTo, selectCell, getTatMinutes]);

  const handleTabWrapDown = useCallback(() => {
    handleAddFlight("arrStation");
    // After React renders the new row, start editing ARR
    const { rows: sr, newRows: sn, deletedIds: sd } = useScheduleGridStore.getState();
    const newRowIdx = sr.filter((r) => !sd.has(r._id)).length + sn.filter((r) => !sd.has(r._id)).length;
    setTimeout(() => startEditing({ rowIdx: newRowIdx, colKey: "arrStation" }), 50);
  }, [handleAddFlight, startEditing]);

  // When grid first appears: ensure at least one row exists, then focus AC TYPE
  useEffect(() => {
    if (!hasLoaded || loading || didSeedRow.current) return;
    didSeedRow.current = true;
    const { rows: sr, newRows: sn, deletedIds: sd } = useScheduleGridStore.getState();
    const visibleCount = sr.filter((r) => !sd.has(r._id)).length + sn.filter((r) => !sd.has(r._id)).length;
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
          {/* Find/Replace dialog */}
          {(showFind || showReplace) && (
            <FindReplaceDialog
              rows={[...rows, ...newRows]}
              onClose={() => { setShowFind(false); setShowReplace(false); }}
              showReplace={showReplace}
            />
          )}

          {/* Import dialog */}
          {showImport && (
            <ImportDialog seasonCode={seasonCode} scenarioId={activeScenarioId ?? undefined} onClose={() => setShowImport(false)} onImported={fetchFlights} />
          )}

          {/* Export dialog */}
          {showExport && (
            <ExportDialog seasonCode={seasonCode} scenarioId={activeScenarioId ?? undefined} flightCount={rows.length} onClose={() => setShowExport(false)} />
          )}

          {/* Scenario panel */}
          {showScenarios && (
            <ScenarioPanel seasonCode={seasonCode} activeScenarioId={activeScenarioId} onSelectScenario={setActiveScenarioId} onClose={() => setShowScenarios(false)} />
          )}

          {/* Message dialog */}
          {showMessages && (
            <MessageDialog seasonCode={seasonCode} targetScenarioId={activeScenarioId ?? undefined} onClose={() => setShowMessages(false)} />
          )}

          {/* Ribbon toolbar */}
          <RibbonToolbar
            onAddFlight={handleAddFlight}
            onDeleteFlight={() => {
              if (!selectedCell) return;
              const visibleRows = [...rows.filter((r) => !deletedIds.has(r._id)), ...newRows.filter((r) => !deletedIds.has(r._id))];
              const row = visibleRows[selectedCell.rowIdx];
              if (!row) return;
              // New rows: remove entirely; existing rows: soft-delete
              const isNew = newRows.some((r) => r._id === row._id);
              if (isNew) removeNewRow(row._id);
              markDeleted(row._id);
            }}
            onSave={handleSave}
            onImport={() => setShowImport(true)}
            onExport={() => setShowExport(true)}
            onScenario={() => setShowScenarios(true)}
            onMessage={() => setShowMessages(true)}
            onFind={() => setShowFind(true)}
            hasDirty={dirtyMap.size > 0 || newRows.length > 0 || deletedIds.size > 0}
            hasSelection={selectedCell !== null}
            saving={saving}
          />

          {/* Grid */}
          <ScheduleGrid
            rows={rows.filter((r) => !deletedIds.has(r._id))}
            onSave={handleSave}
            onAddFlight={handleAddFlight}
            onTabWrapDown={handleTabWrapDown}
            onDeleteFlight={(rowIdx) => {
              const visibleRows = [...rows.filter((r) => !deletedIds.has(r._id)), ...newRows.filter((r) => !deletedIds.has(r._id))];
              const row = visibleRows[rowIdx];
              if (!row) return;
              const isNew = newRows.some((r) => r._id === row._id);
              if (isNew) removeNewRow(row._id);
              markDeleted(row._id);
            }}
            onOpenFind={() => setShowFind(true)}
            onOpenReplace={() => setShowReplace(true)}
          />

          {/* Floating save bar */}
          <FloatingSaveBar
            dirtyCount={dirtyMap.size}
            newCount={newRows.length}
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
}
