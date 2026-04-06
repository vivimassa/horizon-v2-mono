"use client";

import { useEffect, useState, useCallback } from "react";
import { api, setApiBaseUrl } from "@skyhub/api";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { useScheduleRefStore } from "@/stores/use-schedule-ref-store";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seasonCode, setSeasonCode] = useState("S26");
  const loadRefData = useScheduleRefStore((s) => s.loadAll);

  // Load reference data (AC types, service types, citypairs) once
  useEffect(() => { loadRefData(); }, [loadRefData]);
  const rows = useScheduleGridStore((s) => s.rows);
  const setRows = useScheduleGridStore((s) => s.setRows);
  const dirtyMap = useScheduleGridStore((s) => s.dirtyMap);
  const clearDirty = useScheduleGridStore((s) => s.clearDirty);
  const newRows = useScheduleGridStore((s) => s.newRows);
  const addNewRow = useScheduleGridStore((s) => s.addNewRow);
  const clearNewRows = useScheduleGridStore((s) => s.clearNewRows);
  const selectedCell = useScheduleGridStore((s) => s.selectedCell);
  const [showFind, setShowFind] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const fetchFlights = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getScheduledFlights({ operatorId: "horizon", seasonCode });
      setRows(data);
    } catch (e) {
      console.error("Failed to load flights:", e);
    } finally {
      setLoading(false);
    }
  }, [seasonCode, setRows]);

  useEffect(() => { fetchFlights(); }, [fetchFlights]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Save modified rows
      if (dirtyMap.size > 0) {
        const updates = Array.from(dirtyMap.entries()).map(([id, changes]) => ({ id, changes }));
        await api.updateScheduledFlightsBulk(updates);
      }
      // Save new rows
      if (newRows.length > 0) {
        await api.createScheduledFlightsBulk(newRows);
      }
      clearDirty();
      clearNewRows();
      await fetchFlights();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [dirtyMap, newRows, clearDirty, clearNewRows, fetchFlights]);

  const handleDiscard = useCallback(() => {
    clearDirty();
    clearNewRows();
  }, [clearDirty, clearNewRows]);

  const handleAddFlight = useCallback(() => {
    const id = crypto.randomUUID();
    addNewRow({
      _id: id,
      operatorId: "horizon",
      seasonCode,
      airlineCode: "HZ",
      flightNumber: "",
      suffix: null,
      depStation: "",
      arrStation: "",
      depAirportId: null,
      arrAirportId: null,
      stdUtc: "",
      staUtc: "",
      stdLocal: null,
      staLocal: null,
      blockMinutes: null,
      arrivalDayOffset: 0,
      daysOfWeek: "1234567",
      aircraftTypeId: null,
      aircraftTypeIcao: null,
      aircraftReg: null,
      serviceType: "J",
      status: "draft",
      previousStatus: null,
      effectiveFrom: "",
      effectiveUntil: "",
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
  }, [seasonCode, addNewRow]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left filter panel */}
      <FilterPanel
        seasonCode={seasonCode}
        onSeasonChange={setSeasonCode}
        onApplyFilters={(filters) => {
          setSeasonCode(filters.seasonCode);
          fetchFlights();
        }}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 pt-3 pb-4 gap-3 relative">

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

      {/* Top bar — season selector + actions */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold">Network Scheduling XL</h1>
          <div className="flex items-center gap-1.5">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Season</label>
            <select
              value={seasonCode}
              onChange={(e) => setSeasonCode(e.target.value)}
              className="px-2 py-1 rounded-lg text-[13px] font-medium border border-hz-border bg-hz-bg text-hz-text outline-none focus:ring-2 focus:ring-module-accent/30"
            >
              <option value="S25">S25</option>
              <option value="W25">W25</option>
              <option value="S26">S26</option>
              <option value="W26">W26</option>
            </select>
          </div>
          <span className="text-[13px] text-hz-text-tertiary">
            {loading ? "Loading..." : `${rows.length} flights`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchFlights}
            disabled={loading}
            className="p-2 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleAddFlight}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-module-accent hover:opacity-90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Flight
          </button>
        </div>
      </div>

      {/* Grid */}
      {/* Ribbon toolbar */}
      <RibbonToolbar
        onAddFlight={handleAddFlight}
        onDeleteFlight={() => {
          if (!selectedCell) return;
          const allRows = [...rows, ...newRows];
          const row = allRows[selectedCell.rowIdx];
          if (row) api.deleteScheduledFlight(row._id).then(fetchFlights).catch(console.error);
        }}
        onSave={handleSave}
        onImport={() => setShowImport(true)}
        onExport={() => setShowExport(true)}
        onScenario={() => setShowScenarios(true)}
        onMessage={() => setShowMessages(true)}
        onFind={() => setShowFind(true)}
        hasDirty={dirtyMap.size > 0 || newRows.length > 0}
        hasSelection={selectedCell !== null}
        saving={saving}
      />

      {/* Grid */}
      <ScheduleGrid
        rows={rows}
        onSave={handleSave}
        onAddFlight={handleAddFlight}
        onDeleteFlight={(rowIdx) => {
          const allRows = [...rows, ...newRows];
          const row = allRows[rowIdx];
          if (row) {
            api.deleteScheduledFlight(row._id).then(fetchFlights).catch(console.error);
          }
        }}
      />

      {/* Floating save bar */}
      <FloatingSaveBar
        dirtyCount={dirtyMap.size}
        newCount={newRows.length}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
    </div>
  );
}
