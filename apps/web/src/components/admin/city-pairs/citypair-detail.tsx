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
  AlertCircle,
  XCircle,
  AlertTriangle,
  Fuel,
} from "lucide-react";

function fmtBlock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const TABS = [
  { key: "general", label: "General", icon: Info },
  { key: "block-hours", label: "Block Hours", icon: Clock },
  { key: "fuel", label: "Fuel", icon: Fuel },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ROUTE_TYPE_OPTIONS = [
  "domestic", "regional", "international", "long-haul", "ultra-long-haul", "unknown",
];

// ── Route type → badge semantic mapping ──
const ROUTE_BADGE: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  domestic:         { bg: "rgba(6,194,112,0.12)", text: "#06C270", darkBg: "rgba(57,217,138,0.15)", darkText: "#39D98A" },
  regional:         { bg: "rgba(0,99,247,0.12)", text: "#0063F7", darkBg: "rgba(91,141,239,0.15)", darkText: "#5B8DEF" },
  international:    { bg: "rgba(255,136,0,0.12)", text: "#E67A00", darkBg: "rgba(253,172,66,0.15)", darkText: "#FDAC42" },
  "long-haul":      { bg: "rgba(190,24,93,0.12)", text: "#be185d", darkBg: "rgba(190,24,93,0.15)", darkText: "#f472b6" },
  "ultra-long-haul": { bg: "rgba(102,0,204,0.10)", text: "#6600CC", darkBg: "rgba(172,93,217,0.15)", darkText: "#AC5DD9" },
  unknown:          { bg: "rgba(143,144,166,0.12)", text: "#555770", darkBg: "rgba(85,87,112,0.15)", darkText: "#8F90A6" },
};

// ── Reusable Alert component (XD pattern) ──
function Alert({ type, message, onDismiss }: { type: "info" | "success" | "error" | "warning"; message: string; onDismiss?: () => void }) {
  const config = {
    info:    { bar: "#0063F7", icon: AlertCircle, text: "#0063F7", bg: "rgba(0,99,247,0.08)" },
    success: { bar: "#06C270", icon: Check,       text: "#06C270", bg: "rgba(6,194,112,0.08)" },
    error:   { bar: "#E63535", icon: XCircle,      text: "#E63535", bg: "rgba(255,59,59,0.08)" },
    warning: { bar: "#FF8800", icon: AlertTriangle,text: "#E67A00", bg: "rgba(255,136,0,0.08)" },
  }[type];
  const Icon = config.icon;
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-hz-border/50" style={{ backgroundColor: config.bg }}>
      <div className="w-[3px] h-full min-h-[20px] rounded-full shrink-0 self-stretch" style={{ backgroundColor: config.bar }} />
      <Icon size={15} className="shrink-0 mt-0.5" style={{ color: config.bar }} />
      <span className="text-[13px] flex-1" style={{ color: config.text }}>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 p-0.5 rounded hover:bg-hz-border/30 transition-colors">
          <X size={13} style={{ color: config.text }} />
        </button>
      )}
    </div>
  );
}

// ── Stat Box ──
function StatBox({ label, value, unit, color }: { label: string; value: string | number | null; unit?: string; color?: string }) {
  return (
    <div className="text-center px-4">
      <div className="text-[11px] text-hz-text-tertiary uppercase tracking-wider font-medium mb-0.5">{label}</div>
      <div className="text-[18px] font-bold font-mono tabular-nums" style={color ? { color } : undefined}>
        {value ?? "—"}
        {unit && <span className="text-[12px] font-medium text-hz-text-tertiary ml-1">{unit}</span>}
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ──
function DeleteModal({ onConfirm, onCancel, saving }: { onConfirm: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-hz-card border border-hz-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,59,59,0.12)" }}>
            <Trash2 size={20} style={{ color: "#E63535" }} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold">Delete city pair?</h3>
            <p className="text-[13px] text-hz-text-secondary mt-1">This will permanently remove the city pair and all associated block hour data. This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">
            No, Cancel
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#E63535" }}>
            {saving ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setShowDeleteModal(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave || Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(cityPair._id, draft); setEditing(false); setDraft({}); }
    catch { setErrorMsg("Save failed"); }
    finally { setSaving(false); }
  }, [onSave, cityPair._id, draft]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    setSaving(true); setErrorMsg("");
    try { await onDelete(cityPair._id); setShowDeleteModal(false); }
    catch (err: any) {
      const msg = err.message || "Delete failed";
      const match = msg.match(/API \d+: (.+)/);
      try { setErrorMsg(JSON.parse(match?.[1] ?? "{}").error || msg); } catch { setErrorMsg(match?.[1] || msg); }
      setShowDeleteModal(false);
    } finally { setSaving(false); }
  }, [onDelete, cityPair._id]);

  const getVal = (key: keyof CityPairRef) => key in draft ? (draft as any)[key] : cityPair[key];

  const label1 = cityPair.station1Iata || cityPair.station1Icao;
  const label2 = cityPair.station2Iata || cityPair.station2Icao;
  const hasCoords = cityPair.station1Lat != null && cityPair.station1Lon != null && cityPair.station2Lat != null && cityPair.station2Lon != null;
  const badge = ROUTE_BADGE[cityPair.routeType] ?? ROUTE_BADGE.unknown;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteModal onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} saving={saving} />
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cityPair.station1CountryIso2 && <CountryFlag iso2={cityPair.station1CountryIso2} size={22} />}
            <h1 className="text-xl font-semibold">{label1}</h1>
            <Plane size={16} className="text-hz-text-tertiary" style={{ transform: "rotate(45deg)" }} />
            <h1 className="text-xl font-semibold">{label2}</h1>
            {cityPair.station2CountryIso2 && <CountryFlag iso2={cityPair.station2CountryIso2} size={22} />}
            {/* Route type badge — semantic variant */}
            <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full capitalize dark:hidden"
              style={{ backgroundColor: badge.bg, color: badge.text }}>
              {cityPair.routeType}
            </span>
            <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full capitalize hidden dark:inline"
              style={{ backgroundColor: badge.darkBg, color: badge.darkText }}>
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors bg-module-accent">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  <button onClick={() => setShowDeleteModal(true)}
                    className="p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {onSave && (
                  <button onClick={handleEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {onCreate && (
                  <button onClick={() => { resetCreate(); setShowCreate(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white transition-colors bg-module-accent">
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {errorMsg && <div className="mt-2"><Alert type="error" message={errorMsg} onDismiss={() => setErrorMsg("")} /></div>}
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Add New City Pair</span>
            <button onClick={resetCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">Cancel</button>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Station 1 ICAO *</label>
              <input type="text" value={createForm.station1} maxLength={4} placeholder="e.g. VVTS"
                onChange={(e) => setCreateForm(p => ({ ...p, station1: e.target.value.toUpperCase() }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent text-hz-text transition-colors" />
            </div>
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Station 2 ICAO *</label>
              <input type="text" value={createForm.station2} maxLength={4} placeholder="e.g. RJTT"
                onChange={(e) => setCreateForm(p => ({ ...p, station2: e.target.value.toUpperCase() }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent text-hz-text transition-colors" />
            </div>
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Block Minutes</label>
              <input type="number" value={createForm.blockMinutes} placeholder="Optional"
                onChange={(e) => setCreateForm(p => ({ ...p, blockMinutes: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent text-hz-text transition-colors" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent">
            {creating ? "Creating..." : "Add City Pair"}
          </button>
          {createError && <div className="mt-1"><Alert type="error" message={createError} onDismiss={() => setCreateError("")} /></div>}
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

      {/* Tabs — underline style */}
      <div className="flex items-center gap-0 px-4 border-b border-hz-border shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors duration-150 shrink-0 ${
                active ? "text-module-accent" : "text-hz-text-secondary hover:text-hz-text"
              }`}>
              <Icon className="h-4 w-4" /> {tab.label}
              {/* Underline indicator */}
              {active && <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-module-accent" />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "general" && (
          <div className="px-6 pt-3 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow label="Station 1 (ICAO)" value={cityPair.station1Icao} />
              <FieldRow label="Station 1 (IATA)" value={cityPair.station1Iata ?? "—"} />
              <FieldRow label="Station 1 City" value={cityPair.station1City} />
              <FieldRow label="Station 2 (ICAO)" value={cityPair.station2Icao} />
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
                value={cityPair.isEtops ? <span className="font-semibold" style={{ color: "#E67A00" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>}
                editing={editing} fieldKey="isEtops" editValue={getVal("isEtops")} onChange={handleFieldChange} inputType="toggle" />
              <FieldRow label="Overwater"
                value={cityPair.isOverwater ? <span className="font-semibold" style={{ color: "#0063F7" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>}
                editing={editing} fieldKey="isOverwater" editValue={getVal("isOverwater")} onChange={handleFieldChange} inputType="toggle" />
            </div>
          </div>
        )}
        {activeTab === "block-hours" && (
          <BlockHoursTab cityPair={cityPair} onRefresh={onRefresh} mode="block" />
        )}
        {activeTab === "fuel" && (
          <BlockHoursTab cityPair={cityPair} onRefresh={onRefresh} mode="fuel" />
        )}
      </div>
    </div>
  );
}

/* ── Block Hours / Fuel Tab ── */
function BlockHoursTab({ cityPair, onRefresh, mode }: { cityPair: CityPairRef; onRefresh?: () => void; mode: "block" | "fuel" }) {
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

  const title = mode === "block" ? "Block Hours by Aircraft Type" : "Fuel Data by Aircraft Type";
  const icon = mode === "block" ? Clock : Fuel;
  const IconComp = icon;

  return (
    <div className="px-6 pt-4 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-[3px] h-5 rounded-full bg-module-accent" />
          <IconComp size={15} className="text-module-accent" />
          <h3 className="text-[15px] font-bold">{title}</h3>
        </div>
        {!showAdd && !editId && (
          <button onClick={() => { setShowAdd(true); setAddForm({ ...emptyForm }); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors bg-module-accent">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError("")} />}

      {/* Add form */}
      {showAdd && (
        <div className="p-4 rounded-xl border border-hz-border bg-hz-card space-y-3">
          <BlockHourFormFields form={addForm} setForm={setAddForm} label1={label1} label2={label2} mode={mode} />
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 bg-module-accent">
              <Check className="h-3.5 w-3.5" /> {saving ? "Adding..." : "Add"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {blockHours.length === 0 && !showAdd ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-module-accent/10">
            <IconComp size={24} className="text-module-accent" />
          </div>
          <p className="text-[14px] font-medium text-hz-text-secondary">No {mode === "block" ? "block hours" : "fuel data"} configured</p>
          <p className="text-[13px] text-hz-text-tertiary max-w-sm text-center">Add entries for specific aircraft types and seasons to track {mode === "block" ? "block and flight times" : "fuel consumption"} per direction.</p>
          <button onClick={() => { setShowAdd(true); setAddForm({ ...emptyForm }); setError(""); }}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-module-accent transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add First Entry
          </button>
        </div>
      ) : blockHours.length > 0 && (
        <>
          {/* Edit inline form */}
          {editId && (
            <div className="p-4 rounded-xl border-2 border-module-accent/30 bg-module-accent/[0.03] space-y-3">
              <BlockHourFormFields form={editForm} setForm={setEditForm} label1={label1} label2={label2} mode={mode} />
              <div className="flex items-center gap-2">
                <button onClick={handleEditSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 bg-module-accent">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditId(null)} className="px-3 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-hz-border overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-hz-bg">
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">Type</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">Season</th>
                  {mode === "block" ? (
                    <>
                      <th className="px-4 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">{label1}→{label2}</th>
                      <th className="px-4 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">{label2}→{label1}</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">Fuel {label1}→{label2}</th>
                      <th className="px-4 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">Fuel {label2}→{label1}</th>
                    </>
                  )}
                  <th className="px-2 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hz-border/50">
                {blockHours.map((bh, i) => (
                  <tr key={bh._id} className={`transition-colors hover:bg-hz-border/20 ${editId === bh._id ? "bg-module-accent/[0.04]" : i % 2 === 1 ? "bg-hz-border/[0.04]" : ""}`}>
                    <td className="px-4 py-2.5 font-bold">{bh.aircraftTypeIcao ?? "All"}</td>
                    <td className="px-4 py-2.5 text-hz-text-secondary capitalize">{bh.seasonType}</td>
                    {mode === "block" ? (
                      <>
                        <td className="px-4 py-2.5 font-medium font-mono tabular-nums">{fmtBlock(bh.dir1BlockMinutes)}</td>
                        <td className="px-4 py-2.5 font-medium font-mono tabular-nums">{fmtBlock(bh.dir2BlockMinutes)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-mono tabular-nums text-hz-text-secondary">{bh.dir1FuelKg != null ? `${bh.dir1FuelKg.toLocaleString()} kg` : "—"}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums text-hz-text-secondary">{bh.dir2FuelKg != null ? `${bh.dir2FuelKg.toLocaleString()} kg` : "—"}</td>
                      </>
                    )}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(bh)} className="p-1.5 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                        {confirmDeleteId === bh._id ? (
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => handleDelete(bh._id)} className="px-2 py-1 rounded-lg text-[11px] font-semibold text-white" style={{ backgroundColor: "#E63535" }}>Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 rounded-lg text-[11px] text-hz-text-secondary hover:bg-hz-border/30">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(bh._id)} className="p-1.5 rounded-lg text-hz-text-secondary/40 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[13px] text-hz-text-tertiary">
            Showing {blockHours.length} {blockHours.length === 1 ? "entry" : "entries"}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Block Hour Form ── */
function BlockHourFormFields({ form, setForm, label1, label2, mode }: {
  form: any; setForm: (fn: (p: any) => any) => void; label1: string; label2: string; mode: "block" | "fuel";
}) {
  const inputClass = "w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent text-hz-text transition-colors";
  return (
    <>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Aircraft Type (ICAO)</label>
          <input type="text" value={form.aircraftTypeIcao} placeholder="e.g. A320 (or blank for all)"
            onChange={(e) => setForm((p: any) => ({ ...p, aircraftTypeIcao: e.target.value.toUpperCase() }))}
            className={inputClass} />
        </div>
        <div className="w-32">
          <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Season</label>
          <select value={form.seasonType} onChange={(e) => setForm((p: any) => ({ ...p, seasonType: e.target.value }))}
            className={inputClass}>
            <option value="annual">Annual</option>
            <option value="summer">Summer</option>
            <option value="winter">Winter</option>
          </select>
        </div>
      </div>
      {mode === "block" ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Block {label1}→{label2} (min) *</label>
            <input type="number" value={form.dir1Block}
              onChange={(e) => setForm((p: any) => ({ ...p, dir1Block: e.target.value }))}
              className={inputClass} />
          </div>
          <div className="flex-1">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Block {label2}→{label1} (min) *</label>
            <input type="number" value={form.dir2Block}
              onChange={(e) => setForm((p: any) => ({ ...p, dir2Block: e.target.value }))}
              className={inputClass} />
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Fuel {label1}→{label2} (kg)</label>
            <input type="number" value={form.dir1Fuel}
              onChange={(e) => setForm((p: any) => ({ ...p, dir1Fuel: e.target.value }))}
              className={inputClass} />
          </div>
          <div className="flex-1">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Fuel {label2}→{label1} (kg)</label>
            <input type="number" value={form.dir2Fuel}
              onChange={(e) => setForm((p: any) => ({ ...p, dir2Fuel: e.target.value }))}
              className={inputClass} />
          </div>
        </div>
      )}
    </>
  );
}
