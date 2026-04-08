"use client";

import { useState, useCallback, useMemo } from "react";
import type { CabinClassRef, LopaConfigRef } from "@skyhub/api";
import { FieldRow } from "../airports/field-row";
import { SeatRowPreview } from "./seat-row-preview";
import { useTheme } from "@/components/theme-provider";
import { getOperatorId } from "@/stores/use-operator-store";
import { modeColor } from "@skyhub/ui/theme";
import {
  Info,
  LayoutGrid,
  Pencil,
  Save,
  X,
  Trash2,
  Plus,
  Zap,
  Monitor,
  Ruler,
  MoveHorizontal,
  Armchair,
  Star,
} from "lucide-react";

const TABS = [
  { key: "specs" as const, label: "Specifications", icon: Info },
  { key: "usage" as const, label: "Usage", icon: LayoutGrid },
];

type TabKey = (typeof TABS)[number]["key"];

const SEAT_TYPE_LABELS: Record<string, string> = {
  standard: "Standard",
  premium: "Premium",
  "lie-flat": "Lie-Flat",
  suite: "Suite",
};

interface SeatPreset {
  label: string;
  seatLayout: string;
  seatPitchIn: string;
  seatWidthIn: string;
  seatType: string;
  hasIfe: boolean;
  hasPower: boolean;
}

const SEAT_PRESETS: SeatPreset[] = [
  { label: "First / Suite",          seatLayout: "1-1", seatPitchIn: "82", seatWidthIn: "36", seatType: "suite",    hasIfe: true,  hasPower: true },
  { label: "Business / Lie-Flat",    seatLayout: "2-2", seatPitchIn: "42", seatWidthIn: "21", seatType: "lie-flat", hasIfe: true,  hasPower: true },
  { label: "Premium Economy",        seatLayout: "3-3", seatPitchIn: "34", seatWidthIn: "19", seatType: "premium",  hasIfe: true,  hasPower: true },
  { label: "Economy",                seatLayout: "3-3", seatPitchIn: "29", seatWidthIn: "17", seatType: "standard", hasIfe: false, hasPower: true },
  { label: "Economy (High Density)", seatLayout: "3-3", seatPitchIn: "28", seatWidthIn: "17", seatType: "standard", hasIfe: false, hasPower: false },
];

interface CabinClassDetailProps {
  cabinClass: CabinClassRef | null;
  lopaConfigs?: LopaConfigRef[];
  onSave?: (id: string, data: Partial<CabinClassRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: (data: Partial<CabinClassRef>) => Promise<void>;
  initialShowCreate?: boolean;
  onCancelCreate?: () => void;
}

// ── Alert ──
function Alert({ type, message, onDismiss }: { type: "error" | "warning" | "info" | "success"; message: string; onDismiss?: () => void }) {
  const c = { info: { bar: "#0063F7", bg: "rgba(0,99,247,0.08)" }, success: { bar: "#06C270", bg: "rgba(6,194,112,0.08)" }, error: { bar: "#E63535", bg: "rgba(255,59,59,0.08)" }, warning: { bar: "#FF8800", bg: "rgba(255,136,0,0.08)" } }[type];
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-hz-border/50" style={{ backgroundColor: c.bg }}>
      <div className="w-[3px] h-full min-h-[20px] rounded-full shrink-0 self-stretch" style={{ backgroundColor: c.bar }} />
      <span className="text-[13px] flex-1" style={{ color: c.bar }}>{message}</span>
      {onDismiss && <button onClick={onDismiss} className="shrink-0 p-0.5 rounded hover:bg-hz-border/30 transition-colors"><X size={13} style={{ color: c.bar }} /></button>}
    </div>
  );
}

// ── Delete Modal ──
function DeleteModal({ onConfirm, onCancel, saving }: { onConfirm: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-hz-card border border-hz-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,59,59,0.12)" }}>
            <Trash2 size={20} style={{ color: "#E63535" }} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold">Delete cabin class?</h3>
            <p className="text-[13px] text-hz-text-secondary mt-1">This will permanently remove this cabin class. This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onCancel} disabled={saving} className="px-4 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">No, Cancel</button>
          <button onClick={onConfirm} disabled={saving} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "#E63535" }}>{saving ? "Deleting..." : "Yes, Delete"}</button>
        </div>
      </div>
    </div>
  );
}

export function CabinClassDetail({ cabinClass, lopaConfigs = [], onSave, onDelete, onCreate, initialShowCreate, onCancelCreate }: CabinClassDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("specs");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [draft, setDraft] = useState<Partial<CabinClassRef>>({});
  const [errorMsg, setErrorMsg] = useState("");

  // Create flow
  const [showCreate, setShowCreate] = useState(initialShowCreate ?? false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({
    code: "", name: "", color: "#3b82f6", sortOrder: "0",
    seatLayout: "3-3", seatPitchIn: "29", seatWidthIn: "17", seatType: "standard", hasIfe: false, hasPower: true,
  });

  const resetCreate = useCallback(() => {
    setShowCreate(false);
    setCreateError("");
    setCreateForm({ code: "", name: "", color: "#3b82f6", sortOrder: "0", seatLayout: "3-3", seatPitchIn: "29", seatWidthIn: "17", seatType: "standard", hasIfe: false, hasPower: true });
    onCancelCreate?.();
  }, [onCancelCreate]);

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || "Failed";
    try {
      const match = msg.match(/API (\d+): (.+)/);
      if (match) {
        const parsed = JSON.parse(match[2]);
        if (Number(match[1]) === 409) return parsed.error || "This cabin class already exists.";
        return parsed.error || parsed.details?.join(", ") || msg;
      }
    } catch { /* use raw */ }
    return msg;
  }, []);

  const handleCreate = useCallback(async () => {
    if (!onCreate) return;
    if (!createForm.code || !createForm.name) { setCreateError("Code and name are required"); return; }
    setCreating(true); setCreateError("");
    try {
      await onCreate({
        operatorId: getOperatorId(),
        code: createForm.code.toUpperCase(),
        name: createForm.name,
        color: createForm.color || null,
        sortOrder: Number(createForm.sortOrder) || 0,
        seatLayout: createForm.seatLayout || null,
        seatPitchIn: createForm.seatPitchIn ? Number(createForm.seatPitchIn) : null,
        seatWidthIn: createForm.seatWidthIn ? Number(createForm.seatWidthIn) : null,
        seatType: (createForm.seatType as any) || null,
        hasIfe: createForm.hasIfe,
        hasPower: createForm.hasPower,
        isActive: true,
      } as Partial<CabinClassRef>);
      setShowCreate(false);
      setCreateForm({ code: "", name: "", color: "#3b82f6", sortOrder: "0", seatLayout: "3-3", seatPitchIn: "29", seatWidthIn: "17", seatType: "standard", hasIfe: false, hasPower: true });
    } catch (err: any) { setCreateError(friendlyError(err)); }
    finally { setCreating(false); }
  }, [onCreate, createForm, friendlyError]);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setShowDeleteModal(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave || !cabinClass || Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(cabinClass._id, draft); setEditing(false); setDraft({}); }
    catch (err) { console.error("Save failed:", err); }
    finally { setSaving(false); }
  }, [onSave, cabinClass, draft]);

  const handleDelete = useCallback(async () => {
    if (!onDelete || !cabinClass) return;
    setSaving(true); setErrorMsg("");
    try { await onDelete(cabinClass._id); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); setShowDeleteModal(false); }
  }, [onDelete, cabinClass, friendlyError]);

  const getVal = (key: keyof CabinClassRef) =>
    cabinClass ? (key in draft ? (draft as any)[key] : cabinClass[key]) : null;

  // Usage: LOPA configs that reference this cabin class
  const usage = useMemo(() => {
    if (!cabinClass) return [];
    return lopaConfigs.filter((lc) => lc.cabins.some((c) => c.classCode === cabinClass.code));
  }, [cabinClass, lopaConfigs]);

  const totalFleetSeats = useMemo(() => {
    return usage.reduce((sum, lc) => {
      const cabin = lc.cabins.find((c) => c.classCode === cabinClass?.code);
      return sum + (cabin?.seats ?? 0);
    }, 0);
  }, [usage, cabinClass]);

  // ── Standalone create mode ──
  if (!cabinClass) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-hz-border shrink-0">
          <h1 className="text-[20px] font-semibold">Add New Cabin Class</h1>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          {/* Preset selector */}
          <div>
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Start from Preset</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {SEAT_PRESETS.map((preset) => (
                <button key={preset.label}
                  onClick={() => setCreateForm(p => ({
                    ...p,
                    seatLayout: preset.seatLayout,
                    seatPitchIn: preset.seatPitchIn,
                    seatWidthIn: preset.seatWidthIn,
                    seatType: preset.seatType,
                    hasIfe: preset.hasIfe,
                    hasPower: preset.hasPower,
                  }))}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                    createForm.seatLayout === preset.seatLayout && createForm.seatType === preset.seatType
                      ? "border-module-accent bg-module-accent/[0.08] text-module-accent font-semibold"
                      : "border-hz-border hover:border-module-accent/40 hover:bg-module-accent/5"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <MiniInput label="Code *" value={createForm.code} maxLength={2}
              onChange={(v) => setCreateForm(p => ({ ...p, code: v.toUpperCase() }))} mono />
            <MiniInput label="Name *" value={createForm.name}
              onChange={(v) => setCreateForm(p => ({ ...p, name: v }))} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Color</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={createForm.color}
                  onChange={(e) => setCreateForm(p => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-hz-border cursor-pointer" />
                <input type="text" value={createForm.color}
                  onChange={(e) => setCreateForm(p => ({ ...p, color: e.target.value }))}
                  className="flex-1 px-3 py-2.5 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent transition-colors text-hz-text"
                  maxLength={7} />
              </div>
            </div>
            <MiniInput label="Sort Order" value={createForm.sortOrder} type="number"
              onChange={(v) => setCreateForm(p => ({ ...p, sortOrder: v }))} />
          </div>
          <div className="flex gap-3">
            <MiniInput label="Seat Layout" value={createForm.seatLayout}
              onChange={(v) => setCreateForm(p => ({ ...p, seatLayout: v }))} mono />
            <MiniInput label="Pitch (in)" value={createForm.seatPitchIn} type="number"
              onChange={(v) => setCreateForm(p => ({ ...p, seatPitchIn: v }))} />
            <MiniInput label="Width (in)" value={createForm.seatWidthIn} type="number"
              onChange={(v) => setCreateForm(p => ({ ...p, seatWidthIn: v }))} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Seat Type</label>
              <select value={createForm.seatType}
                onChange={(e) => setCreateForm(p => ({ ...p, seatType: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent transition-colors text-hz-text">
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="lie-flat">Lie-Flat</option>
                <option value="suite">Suite</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={resetCreate}
              className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={creating}
              className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent hover:opacity-90">
              {creating ? "Creating..." : "Add Cabin Class"}
            </button>
          </div>
          {createError && <Alert type="error" message={createError} onDismiss={() => setCreateError("")} />}
        </div>
      </div>
    );
  }

  // ── Normal detail view ──
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const classColor = modeColor(cabinClass.color || "#9ca3af", isDark);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          saving={saving}
        />
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full border border-hz-border/50 shrink-0"
              style={{ backgroundColor: classColor }} />
            <span className="text-[20px] font-bold font-mono">{cabinClass.code}</span>
            <span className="text-[16px] text-hz-text-secondary">—</span>
            <h1 className="text-[20px] font-semibold">{cabinClass.name}</h1>
            {cabinClass.isActive ? (
              <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-[rgba(6,194,112,0.12)] text-[#06C270] dark:bg-[rgba(57,217,138,0.15)] dark:text-[#39D98A]">Active</span>
            ) : (
              <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-[rgba(255,59,59,0.12)] text-[#E63535] dark:bg-[rgba(255,92,92,0.15)] dark:text-[#FF5C5C]">Inactive</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={handleCancel} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors bg-module-accent hover:opacity-90">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-1 p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete cabin class">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {onSave && (
                  <button onClick={handleEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {onCreate && (
                  <button onClick={() => { setCreateForm({ code: "", name: "", color: "#3b82f6", sortOrder: "0", seatLayout: "3-3", seatPitchIn: "29", seatWidthIn: "17", seatType: "standard", hasIfe: false, hasPower: true }); setCreateError(""); setShowCreate(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white transition-colors bg-module-accent hover:opacity-90">
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3">
            <Alert type="error" message={errorMsg} onDismiss={() => setErrorMsg("")} />
          </div>
        )}
      </div>

      {/* Inline create panel */}
      {showCreate && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Add New Cabin Class</span>
            <button onClick={resetCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">Cancel</button>
          </div>
          <div className="space-y-3">
            {/* Preset pills */}
            <div className="flex flex-wrap gap-1.5">
              {SEAT_PRESETS.map((preset) => (
                <button key={preset.label}
                  onClick={() => setCreateForm(p => ({
                    ...p,
                    seatLayout: preset.seatLayout,
                    seatPitchIn: preset.seatPitchIn,
                    seatWidthIn: preset.seatWidthIn,
                    seatType: preset.seatType,
                    hasIfe: preset.hasIfe,
                    hasPower: preset.hasPower,
                  }))}
                  className={`px-2.5 py-1 rounded-lg text-[13px] font-medium border transition-colors ${
                    createForm.seatLayout === preset.seatLayout && createForm.seatType === preset.seatType
                      ? "border-module-accent bg-module-accent/[0.08] text-module-accent font-semibold"
                      : "border-hz-border hover:border-module-accent/40"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <MiniInput label="Code *" value={createForm.code} maxLength={2} onChange={(v) => setCreateForm(p => ({ ...p, code: v.toUpperCase() }))} mono />
              <MiniInput label="Name *" value={createForm.name} onChange={(v) => setCreateForm(p => ({ ...p, name: v }))} />
              <MiniInput label="Layout" value={createForm.seatLayout} onChange={(v) => setCreateForm(p => ({ ...p, seatLayout: v }))} mono />
            </div>
            <button onClick={handleCreate} disabled={creating}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent hover:opacity-90">
              {creating ? "Creating..." : "Add Cabin Class"}
            </button>
          </div>
          {createError && <Alert type="error" message={createError} onDismiss={() => setCreateError("")} />}
        </div>
      )}

      {/* Hero: Seat Row Preview */}
      {cabinClass.seatLayout && (
        <div className="px-6 py-5 border-b border-hz-border shrink-0 flex justify-center">
          <SeatRowPreview
            seatLayout={cabinClass.seatLayout}
            color={classColor}
            seatType={cabinClass.seatType}
            pitchIn={cabinClass.seatPitchIn}
          />
        </div>
      )}

      {/* Spec metric cards */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex justify-center gap-6 flex-wrap">
          {cabinClass.seatPitchIn && (
            <MetricCard icon={Ruler} label="Pitch" value={`${cabinClass.seatPitchIn}"`} color={classColor} />
          )}
          {cabinClass.seatWidthIn && (
            <MetricCard icon={MoveHorizontal} label="Width" value={`${cabinClass.seatWidthIn}"`} color={classColor} />
          )}
          {cabinClass.seatType && (
            <MetricCard icon={Armchair} label="Type" value={SEAT_TYPE_LABELS[cabinClass.seatType] || cabinClass.seatType} color={classColor} />
          )}
          <MetricCard icon={Zap} label="Power" value={cabinClass.hasPower ? "Yes" : "No"} color={cabinClass.hasPower ? classColor : "#9ca3af"} />
          <MetricCard icon={Monitor} label="IFE" value={cabinClass.hasIfe ? "Yes" : "No"} color={cabinClass.hasIfe ? classColor : "#9ca3af"} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 border-b border-hz-border shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors shrink-0 ${
                active ? "text-module-accent" : "text-hz-text-secondary hover:text-hz-text"
              }`}>
              <Icon className="h-4 w-4" />
              {tab.label}
              {active && <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-module-accent" />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "specs" && (
          <div className="px-6 pt-3 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow label="Code" value={cabinClass.code}
                editing={editing} fieldKey="code" editValue={getVal("code")} onChange={handleFieldChange} />
              <FieldRow label="Name" value={cabinClass.name}
                editing={editing} fieldKey="name" editValue={getVal("name")} onChange={handleFieldChange} />
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">Color</div>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input type="color" value={getVal("color") || "#9ca3af"} onChange={(e) => handleFieldChange("color", e.target.value)}
                      className="w-8 h-8 rounded border border-hz-border cursor-pointer" />
                    <input type="text" value={getVal("color") || ""} onChange={(e) => handleFieldChange("color", e.target.value)}
                      className="flex-1 text-[13px] font-mono bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" maxLength={7} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full border border-hz-border/50" style={{ backgroundColor: classColor }} />
                    <span className="text-[13px] font-mono font-medium">{cabinClass.color || "—"}</span>
                  </div>
                )}
              </div>
              <FieldRow label="Sort Order" value={cabinClass.sortOrder}
                editing={editing} fieldKey="sortOrder" editValue={getVal("sortOrder")} onChange={handleFieldChange} inputType="number" />
              <FieldRow label="Seat Layout" value={cabinClass.seatLayout ?? null}
                editing={editing} fieldKey="seatLayout" editValue={getVal("seatLayout")} onChange={handleFieldChange} />
              <FieldRow label="Seat Pitch (in)" value={cabinClass.seatPitchIn ? `${cabinClass.seatPitchIn}"` : null}
                editing={editing} fieldKey="seatPitchIn" editValue={getVal("seatPitchIn")} onChange={handleFieldChange} inputType="number" />
              <FieldRow label="Seat Width (in)" value={cabinClass.seatWidthIn ? `${cabinClass.seatWidthIn}"` : null}
                editing={editing} fieldKey="seatWidthIn" editValue={getVal("seatWidthIn")} onChange={handleFieldChange} inputType="number" />
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">Seat Type</div>
                {editing ? (
                  <select
                    value={getVal("seatType") || ""}
                    onChange={(e) => handleFieldChange("seatType", e.target.value || null)}
                    className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
                  >
                    <option value="">—</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="lie-flat">Lie-Flat</option>
                    <option value="suite">Suite</option>
                  </select>
                ) : (
                  <div className="text-[13px] font-medium">{cabinClass.seatType ? SEAT_TYPE_LABELS[cabinClass.seatType] : "—"}</div>
                )}
              </div>
              <FieldRow label="IFE Screen"
                value={cabinClass.hasIfe ? <span className="font-semibold" style={{ color: "#06C270" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>}
                editing={editing} fieldKey="hasIfe" editValue={getVal("hasIfe")} onChange={handleFieldChange} inputType="toggle" />
              <FieldRow label="Power Outlet"
                value={cabinClass.hasPower ? <span className="font-semibold" style={{ color: "#06C270" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>}
                editing={editing} fieldKey="hasPower" editValue={getVal("hasPower")} onChange={handleFieldChange} inputType="toggle" />
              <FieldRow label="Active"
                value={cabinClass.isActive ? <span className="font-semibold" style={{ color: "#06C270" }}>Active</span> : <span className="font-semibold" style={{ color: "#E63535" }}>Inactive</span>}
                editing={editing} fieldKey="isActive" editValue={getVal("isActive")} onChange={handleFieldChange} inputType="toggle" />
            </div>
          </div>
        )}

        {activeTab === "usage" && (
          <div className="px-6 pt-3 pb-6">
            {usage.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(156,163,175,0.12)" }}>
                  <LayoutGrid className="h-6 w-6 text-hz-text-tertiary" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <div className="text-[14px] font-medium text-hz-text-secondary">No configurations yet</div>
                  <div className="text-[13px] text-hz-text-tertiary mt-0.5">This cabin class is not used in any LOPA configuration.</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {usage.map((lc) => {
                  const cabin = lc.cabins.find((c) => c.classCode === cabinClass.code);
                  return (
                    <div key={lc._id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-hz-border/50">
                      <span className="text-[13px] font-bold font-mono px-2 py-0.5 rounded-lg bg-hz-border/30">{lc.aircraftType}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium truncate">{lc.configName}</span>
                          {lc.isDefault && <Star className="h-3 w-3 shrink-0" style={{ color: "#E67A00" }} />}
                        </div>
                      </div>
                      <span className="text-[14px] font-semibold tabular-nums" style={{ color: classColor }}>
                        {cabin?.seats ?? 0}
                      </span>
                      <span className="text-[13px] text-hz-text-tertiary">seats</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-hz-border/50">
                  <span className="text-[13px] text-hz-text-secondary font-medium">
                    {usage.length} configuration{usage.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[14px] font-bold" style={{ color: classColor }}>
                    {totalFleetSeats.toLocaleString()} total seats
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Metric card ──
function MetricCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<any>; label: string; value: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-hz-border/50 shrink-0">
      <Icon className="h-4 w-4 shrink-0" style={{ color }} strokeWidth={1.8} />
      <div>
        <div className="text-[13px] text-hz-text-tertiary uppercase tracking-wider font-semibold leading-none">{label}</div>
        <div className="text-[14px] font-bold mt-0.5 leading-tight" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

// ── Mini input for create form ──
function MiniInput({ label, value, onChange, maxLength, mono, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  maxLength?: number; mono?: boolean; type?: string;
}) {
  return (
    <div className="flex-1">
      <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength}
        className={`w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent transition-colors text-hz-text ${mono ? "font-mono" : ""}`} />
    </div>
  );
}
