"use client";

import { useState, useCallback, useRef } from "react";
import type { CityPairRef, BlockHourData } from "@skyhub/api";
import { api } from "@skyhub/api";
import { FieldRow } from "../airports/field-row";
import { CountryFlag } from "@/components/ui/country-flag";
import { CityPairMap } from "./citypair-map";
import {
  Info,
  Clock,
  Pencil,
  Save,
  X,
  Trash2,
  Plus,
  Check,
  Plane,
} from "lucide-react";

function fmtBlock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const TABS = [
  { key: "general", label: "General", icon: Info },
  { key: "block-hours", label: "Block Hours", icon: Clock },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ROUTE_TYPE_OPTIONS = [
  "domestic", "regional", "international", "long-haul", "ultra-long-haul", "unknown",
];

interface CityPairDetailProps {
  cityPair: CityPairRef;
  onSave?: (id: string, data: Partial<CityPairRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: (data: { station1Icao: string; station2Icao: string; standardBlockMinutes?: number }) => Promise<void>;
  onRefresh?: () => void;
}

export function CityPairDetail({ cityPair, onSave, onDelete, onCreate, onRefresh }: CityPairDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Partial<CityPairRef>>({});
  const [errorMsg, setErrorMsg] = useState("");

  // Create flow
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({ station1: "", station2: "", blockMinutes: "" });

  // Map resize
  const [mapHeight, setMapHeight] = useState(250);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: mapHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setMapHeight(Math.max(120, Math.min(600, dragRef.current.startH + (ev.clientY - dragRef.current.startY))));
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [mapHeight]);

  const resetCreate = useCallback(() => {
    setShowCreate(false); setCreateError("");
    setCreateForm({ station1: "", station2: "", blockMinutes: "" });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!onCreate) return;
    if (!createForm.station1.trim() || !createForm.station2.trim()) { setCreateError("Both ICAO codes are required"); return; }
    setCreating(true); setCreateError("");
    try {
      await onCreate({
        station1Icao: createForm.station1.toUpperCase(),
        station2Icao: createForm.station2.toUpperCase(),
        standardBlockMinutes: createForm.blockMinutes ? Number(createForm.blockMinutes) : undefined,
      });
      resetCreate();
    } catch (err: any) {
      const msg = err.message || "Create failed";
      try {
        const match = msg.match(/API (\d+): (.+)/);
        if (match) {
          const parsed = JSON.parse(match[2]);
          setCreateError(parsed.error || msg);
        } else setCreateError(msg);
      } catch { setCreateError(msg); }
    } finally { setCreating(false); }
  }, [onCreate, createForm, resetCreate]);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave || Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(cityPair._id, draft); setEditing(false); setDraft({}); }
    catch (err) { console.error("Save failed:", err); }
    finally { setSaving(false); }
  }, [onSave, cityPair._id, draft]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    setSaving(true); setErrorMsg("");
    try { await onDelete(cityPair._id); }
    catch (err: any) {
      const msg = err.message || "Delete failed";
      const match = msg.match(/API \d+: (.+)/);
      try { setErrorMsg(JSON.parse(match?.[1] ?? "{}").error || msg); } catch { setErrorMsg(match?.[1] || msg); }
    } finally { setSaving(false); setConfirmDelete(false); }
  }, [onDelete, cityPair._id]);

  const getVal = (key: keyof CityPairRef) => key in draft ? (draft as any)[key] : cityPair[key];

  const label1 = cityPair.station1Iata || cityPair.station1Icao;
  const label2 = cityPair.station2Iata || cityPair.station2Icao;
  const hasCoords = cityPair.station1Lat != null && cityPair.station1Lon != null && cityPair.station2Lat != null && cityPair.station2Lon != null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cityPair.station1CountryIso2 && <CountryFlag iso2={cityPair.station1CountryIso2} size={22} />}
            <h1 className="text-xl font-semibold">{label1}</h1>
            <span className="text-hz-text-secondary text-lg">↔</span>
            <h1 className="text-xl font-semibold">{label2}</h1>
            {cityPair.station2CountryIso2 && <CountryFlag iso2={cityPair.station2CountryIso2} size={22} />}
            <span className="text-[12px] font-medium px-2.5 py-0.5 rounded-full capitalize"
              style={{
                backgroundColor: cityPair.routeType === "domestic" ? "#dcfce7" : cityPair.routeType === "regional" ? "#dbeafe" : cityPair.routeType === "international" ? "#fef3c7" : cityPair.routeType === "long-haul" ? "#fce7f3" : cityPair.routeType === "ultra-long-haul" ? "#ede9fe" : "#f3f4f6",
                color: cityPair.routeType === "domestic" ? "#166534" : cityPair.routeType === "regional" ? "#1e40af" : cityPair.routeType === "international" ? "#92400e" : cityPair.routeType === "long-haul" ? "#9d174d" : cityPair.routeType === "ultra-long-haul" ? "#5b21b6" : "#374151",
              }}>
              {cityPair.routeType}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={handleCancel} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors"
                  style={{ backgroundColor: "#1e40af" }}>
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  confirmDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] text-red-500 font-medium">Delete?</span>
                      <button onClick={handleDelete} disabled={saving} className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">Yes</button>
                      <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
                {onSave && (
                  <button onClick={handleEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {onCreate && (
                  <button onClick={() => { resetCreate(); setShowCreate(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white transition-colors"
                    style={{ backgroundColor: "#1e40af" }}>
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sub-info */}
        <div className="mt-2 flex items-center gap-3 text-[13px] text-hz-text-secondary">
          <span>{cityPair.station1City ?? cityPair.station1Name} – {cityPair.station2City ?? cityPair.station2Name}</span>
          {cityPair.isEtops && <span className="text-amber-600 font-semibold">· ETOPS</span>}
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="text-[13px] text-red-700 dark:text-red-400">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 shrink-0 ml-auto"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Add New City Pair</span>
            <button onClick={resetCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">Cancel</button>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Station 1 ICAO *</label>
              <input type="text" value={createForm.station1} maxLength={4} placeholder="e.g. VVTS"
                onChange={(e) => setCreateForm(p => ({ ...p, station1: e.target.value.toUpperCase() }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Station 2 ICAO *</label>
              <input type="text" value={createForm.station2} maxLength={4} placeholder="e.g. RJTT"
                onChange={(e) => setCreateForm(p => ({ ...p, station2: e.target.value.toUpperCase() }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Block Minutes</label>
              <input type="number" value={createForm.blockMinutes} placeholder="Optional"
                onChange={(e) => setCreateForm(p => ({ ...p, blockMinutes: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#1e40af" }}>
            {creating ? "Creating…" : "Add City Pair"}
          </button>
          {createError && <p className="text-[12px] text-red-500">{createError}</p>}
        </div>
      )}

      {/* Map */}
      {hasCoords && (
        <div className="shrink-0 border-b border-hz-border relative" style={{ height: mapHeight }}>
          <CityPairMap
            lat1={cityPair.station1Lat!} lon1={cityPair.station1Lon!}
            lat2={cityPair.station2Lat!} lon2={cityPair.station2Lon!}
            label1={label1} label2={label2}
            distanceNm={cityPair.distanceNm} distanceKm={cityPair.distanceKm}
          />
          <div onMouseDown={onDragStart}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-10 group flex items-center justify-center">
            <div className="w-10 h-1 rounded-full bg-hz-text-secondary/30 group-hover:bg-hz-text-secondary/60 transition-colors" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-hz-border shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium transition-colors duration-150 shrink-0 ${
                active ? "bg-module-accent/15 text-module-accent" : "text-hz-text-secondary hover:bg-hz-border/30 hover:text-hz-text"
              }`}>
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "general" && (
          <div className="px-6 pt-3 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow label="Station 1 (ICAO)" value={<span className="font-bold">{cityPair.station1Icao}</span>} />
              <FieldRow label="Station 1 (IATA)" value={cityPair.station1Iata ?? "—"} />
              <FieldRow label="Station 1 City" value={cityPair.station1City} />
              <FieldRow label="Station 2 (ICAO)" value={<span className="font-bold">{cityPair.station2Icao}</span>} />
              <FieldRow label="Station 2 (IATA)" value={cityPair.station2Iata ?? "—"} />
              <FieldRow label="Station 2 City" value={cityPair.station2City} />
              <FieldRow label="Distance (nm)" value={cityPair.distanceNm?.toLocaleString()} />
              <FieldRow label="Distance (km)" value={cityPair.distanceKm?.toLocaleString()} />
              <FieldRow label="Standard Block (min)" value={cityPair.standardBlockMinutes}
                editing={editing} fieldKey="standardBlockMinutes" editValue={getVal("standardBlockMinutes")} onChange={handleFieldChange} inputType="number" />
              <FieldRow label="Route Type"
                value={<span className="capitalize">{cityPair.routeType}</span>}
                editing={editing} fieldKey="routeType" editValue={getVal("routeType")} onChange={handleFieldChange} />
              <FieldRow label="ETOPS"
                value={cityPair.isEtops ? <span className="text-amber-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>}
                editing={editing} fieldKey="isEtops" editValue={getVal("isEtops")} onChange={handleFieldChange} inputType="toggle" />
              <FieldRow label="Overwater"
                value={cityPair.isOverwater ? <span className="text-blue-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>}
                editing={editing} fieldKey="isOverwater" editValue={getVal("isOverwater")} onChange={handleFieldChange} inputType="toggle" />
            </div>
          </div>
        )}
        {activeTab === "block-hours" && (
          <BlockHoursTab cityPair={cityPair} onRefresh={onRefresh} />
        )}
      </div>
    </div>
  );
}

/* ── Block Hours Tab ── */
function BlockHoursTab({ cityPair, onRefresh }: { cityPair: CityPairRef; onRefresh?: () => void }) {
  const blockHours = cityPair.blockHours ?? [];
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const emptyForm = { aircraftTypeIcao: "", seasonType: "annual", dir1Block: "", dir2Block: "", dir1Flight: "", dir2Flight: "", dir1Fuel: "", dir2Fuel: "", notes: "" };
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const label1 = cityPair.station1Iata || cityPair.station1Icao;
  const label2 = cityPair.station2Iata || cityPair.station2Icao;

  const formToPayload = (f: typeof emptyForm) => ({
    aircraftTypeIcao: f.aircraftTypeIcao || null,
    seasonType: f.seasonType,
    dir1BlockMinutes: Number(f.dir1Block) || 0,
    dir2BlockMinutes: Number(f.dir2Block) || 0,
    dir1FlightMinutes: f.dir1Flight ? Number(f.dir1Flight) : null,
    dir2FlightMinutes: f.dir2Flight ? Number(f.dir2Flight) : null,
    dir1FuelKg: f.dir1Fuel ? Number(f.dir1Fuel) : null,
    dir2FuelKg: f.dir2Fuel ? Number(f.dir2Fuel) : null,
    notes: f.notes || null,
  });

  const handleAdd = useCallback(async () => {
    if (!addForm.dir1Block || !addForm.dir2Block) { setError("Block minutes for both directions are required"); return; }
    setSaving(true); setError("");
    try { await api.addBlockHour(cityPair._id, formToPayload(addForm)); setShowAdd(false); setAddForm({ ...emptyForm }); onRefresh?.(); }
    catch (err: any) { setError(err.message || "Failed"); }
    finally { setSaving(false); }
  }, [cityPair._id, addForm, onRefresh]);

  const handleEditSave = useCallback(async () => {
    if (!editId) return;
    setSaving(true); setError("");
    try { await api.updateBlockHour(cityPair._id, editId, formToPayload(editForm)); setEditId(null); onRefresh?.(); }
    catch (err: any) { setError(err.message || "Failed"); }
    finally { setSaving(false); }
  }, [cityPair._id, editId, editForm, onRefresh]);

  const handleDelete = useCallback(async (bhId: string) => {
    setSaving(true);
    try { await api.deleteBlockHour(cityPair._id, bhId); setConfirmDeleteId(null); onRefresh?.(); }
    catch (err: any) { setError(err.message || "Failed"); }
    finally { setSaving(false); }
  }, [cityPair._id, onRefresh]);

  const startEdit = (bh: BlockHourData) => {
    setEditId(bh._id);
    setEditForm({
      aircraftTypeIcao: bh.aircraftTypeIcao ?? "",
      seasonType: bh.seasonType,
      dir1Block: bh.dir1BlockMinutes.toString(),
      dir2Block: bh.dir2BlockMinutes.toString(),
      dir1Flight: bh.dir1FlightMinutes?.toString() ?? "",
      dir2Flight: bh.dir2FlightMinutes?.toString() ?? "",
      dir1Fuel: bh.dir1FuelKg?.toString() ?? "",
      dir2Fuel: bh.dir2FuelKg?.toString() ?? "",
      notes: bh.notes ?? "",
    });
  };

  return (
    <div className="px-6 pt-3 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ backgroundColor: "#1e40af" }} />
          <h3 className="text-[14px] font-bold">Block Hours by Aircraft Type</h3>
          <span className="text-[12px] text-hz-text-secondary">({blockHours.length})</span>
        </div>
        {!showAdd && !editId && (
          <button onClick={() => { setShowAdd(true); setAddForm({ ...emptyForm }); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors"
            style={{ backgroundColor: "#1e40af" }}>
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 flex items-center justify-between">
          <span className="text-[12px] text-red-600">{error}</span>
          <button onClick={() => setError("")}><X className="h-3 w-3 text-red-400" /></button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="p-4 rounded-xl border border-hz-border bg-hz-card space-y-3">
          <BlockHourFormFields form={addForm} setForm={setAddForm} label1={label1} label2={label2} />
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#1e40af" }}>
              <Check className="h-3 w-3" /> {saving ? "Adding…" : "Add"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30">Cancel</button>
          </div>
        </div>
      )}

      {/* Block hours list */}
      {blockHours.length === 0 && !showAdd ? (
        <div className="py-8 text-center text-[13px] text-hz-text-secondary">
          No block hours configured. Add entries for specific aircraft types and seasons.
        </div>
      ) : (
        <>
          {/* Edit inline form (shown above the table when editing) */}
          {editId && (
            <div className="mb-3 p-4 rounded-xl border-2 border-module-accent/30 bg-module-accent/[0.03] space-y-3">
              <BlockHourFormFields form={editForm} setForm={setEditForm} label1={label1} label2={label2} />
              <div className="flex items-center gap-2">
                <button onClick={handleEditSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#1e40af" }}>
                  <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditId(null)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30">Cancel</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-hz-border overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-hz-card/50 text-left">
                  <th className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary w-16">Type</th>
                  <th className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary w-16">Season</th>
                  <th className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary">Block {label1}→{label2}</th>
                  <th className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary">Block {label2}→{label1}</th>
                  <th className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary">Fuel {label1}→{label2}</th>
                  <th className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary">Fuel {label2}→{label1}</th>
                  <th className="px-2 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hz-border">
                {blockHours.map((bh, i) => (
                  <tr key={bh._id} className={`transition-colors hover:bg-hz-card/50 ${editId === bh._id ? "bg-module-accent/[0.04]" : i % 2 === 1 ? "bg-hz-card/30" : ""}`}>
                    <td className="px-4 py-2.5 font-bold">{bh.aircraftTypeIcao ?? "All"}</td>
                    <td className="px-4 py-2.5 text-hz-text-secondary capitalize">{bh.seasonType}</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums">{fmtBlock(bh.dir1BlockMinutes)}</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums">{fmtBlock(bh.dir2BlockMinutes)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-hz-text-secondary">{bh.dir1FuelKg != null ? `${bh.dir1FuelKg.toLocaleString()} kg` : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-hz-text-secondary">{bh.dir2FuelKg != null ? `${bh.dir2FuelKg.toLocaleString()} kg` : "—"}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(bh)} className="p-1 rounded-lg text-hz-text-secondary hover:bg-hz-border/30"><Pencil className="h-3 w-3" /></button>
                        {confirmDeleteId === bh._id ? (
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => handleDelete(bh._id)} className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white bg-red-500">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-1.5 py-0.5 rounded text-[10px] text-hz-text-secondary hover:bg-hz-border/30">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(bh._id)} className="p-1 rounded-lg text-hz-text-secondary/50 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Block Hour Form ── */
function BlockHourFormFields({ form, setForm, label1, label2 }: {
  form: any; setForm: (fn: (p: any) => any) => void; label1: string; label2: string;
}) {
  return (
    <>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Aircraft Type (ICAO)</label>
          <input type="text" value={form.aircraftTypeIcao} placeholder="e.g. A320 (or leave blank for all)"
            onChange={(e) => setForm((p: any) => ({ ...p, aircraftTypeIcao: e.target.value.toUpperCase() }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
        <div className="w-32">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Season</label>
          <select value={form.seasonType} onChange={(e) => setForm((p: any) => ({ ...p, seasonType: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text">
            <option value="annual">Annual</option>
            <option value="summer">Summer</option>
            <option value="winter">Winter</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Block {label1}→{label2} (min) *</label>
          <input type="number" value={form.dir1Block}
            onChange={(e) => setForm((p: any) => ({ ...p, dir1Block: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Block {label2}→{label1} (min) *</label>
          <input type="number" value={form.dir2Block}
            onChange={(e) => setForm((p: any) => ({ ...p, dir2Block: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Fuel {label1}→{label2} (kg)</label>
          <input type="number" value={form.dir1Fuel}
            onChange={(e) => setForm((p: any) => ({ ...p, dir1Fuel: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Fuel {label2}→{label1} (kg)</label>
          <input type="number" value={form.dir2Fuel}
            onChange={(e) => setForm((p: any) => ({ ...p, dir2Fuel: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
      </div>
    </>
  );
}
