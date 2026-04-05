"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type CrewPositionRef, type CrewPositionReferences } from "@skyhub/api";
import { useTheme } from "@/components/theme-provider";
import { accentTint } from "@skyhub/ui/theme";
import { FieldRow } from "../airports/field-row";
import { ACCENT } from "./crew-positions-shell";
import {
  Plus, Pencil, Save, X, Trash2, Shield, ArrowDownUp, Hash, Palette, AlertTriangle,
} from "lucide-react";

/* ─── Create / View+Edit Detail ─── */

interface DetailProps {
  /** null = create mode */
  position: CrewPositionRef | null;
  onCreate?: (data: Partial<CrewPositionRef>) => Promise<void>;
  onSave?: (id: string, data: Partial<CrewPositionRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onDeactivate?: (id: string) => Promise<void>;
  onCancel?: () => void;
}

export function CrewPositionDetail({ position, onCreate, onSave, onDelete, onDeactivate, onCancel }: DetailProps) {
  if (!position) {
    return <CreatePanel onCreate={onCreate!} onCancel={onCancel!} />;
  }
  return (
    <ViewEditPanel
      position={position}
      onSave={onSave!}
      onDelete={onDelete!}
      onDeactivate={onDeactivate!}
    />
  );
}

/* ─── Create Panel ─── */

function CreatePanel({ onCreate, onCancel }: { onCreate: (d: Partial<CrewPositionRef>) => Promise<void>; onCancel: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [form, setForm] = useState({
    code: "", name: "", category: "cockpit" as "cockpit" | "cabin",
    rankOrder: 1, isPic: false, canDownrank: false, color: "#4338ca", description: "",
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const set = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) { setErrorMsg("Code and Name are required"); return; }
    setSaving(true); setErrorMsg("");
    try {
      await onCreate({
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        category: form.category,
        rankOrder: form.rankOrder,
        isPic: form.isPic,
        canDownrank: form.canDownrank,
        color: form.color || null,
        description: form.description.trim() || null,
      });
    } catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: accentTint(ACCENT, isDark ? 0.15 : 0.1) }}>
              <Plus size={18} color={ACCENT} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold">New Crew Position</h1>
              <p className="text-[12px] text-hz-text-secondary">Define a new position for flight deck or cabin crew</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-[13px] text-hz-text-secondary hover:text-hz-text font-medium">Cancel</button>
        </div>
        {errorMsg && <ErrorBanner msg={errorMsg} onDismiss={() => setErrorMsg("")} />}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {/* Code */}
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Position Code *</label>
            <input type="text" value={form.code} maxLength={4} placeholder="e.g. CP"
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              className="w-full text-[13px] font-bold font-mono bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text uppercase" />
          </div>
          {/* Name */}
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Name *</label>
            <input type="text" value={form.name} placeholder="e.g. Captain"
              onChange={(e) => set("name", e.target.value)}
              className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" />
          </div>
          {/* Category */}
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Category *</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)}
              className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
              <option value="cockpit">Flight Deck</option>
              <option value="cabin">Cabin Crew</option>
            </select>
          </div>
          {/* Rank Order */}
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Rank Order</label>
            <input type="number" min={0} value={form.rankOrder}
              onChange={(e) => set("rankOrder", Number(e.target.value))}
              className="w-full text-[13px] font-mono bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" />
          </div>
        </div>

        {/* Toggles */}
        <div className="mt-4 rounded-2xl p-5"
          style={{ background: isDark ? accentTint(ACCENT, 0.06) : accentTint(ACCENT, 0.04), border: `1px solid ${accentTint(ACCENT, isDark ? 0.15 : 0.15)}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} color={isDark ? "#e0e0e0" : ACCENT} strokeWidth={1.8} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: isDark ? "#e0e0e0" : ACCENT }}>Position Properties</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <ToggleField label="Pilot in Command (PIC)" value={form.isPic} onChange={(v) => set("isPic", v)}
              description="This position is responsible as Pilot in Command" />
            <ToggleField label="Can Downrank" value={form.canDownrank} onChange={(v) => set("canDownrank", v)}
              description="Crew can be assigned at a lower rank" />
          </div>
        </div>

        {/* Color + Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-4">
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color}
                onChange={(e) => set("color", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
              <input type="text" value={form.color} maxLength={7}
                onChange={(e) => set("color", e.target.value)}
                className="text-[13px] font-mono bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text w-24" />
            </div>
          </div>
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Description</label>
            <input type="text" value={form.description} placeholder="Optional description"
              onChange={(e) => set("description", e.target.value)}
              className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" />
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex justify-end">
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}>
            <Plus className="h-4 w-4" /> {saving ? "Creating..." : "Create Position"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── View / Edit Panel ─── */

function ViewEditPanel({ position, onSave, onDelete, onDeactivate }: {
  position: CrewPositionRef;
  onSave: (id: string, data: Partial<CrewPositionRef>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<CrewPositionRef>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refs, setRefs] = useState<CrewPositionReferences | null>(null);
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    setEditing(false); setDraft({}); setConfirmDelete(false); setErrorMsg(""); setRefs(null);
  }, [position._id]);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (Object.keys(draft).length === 0) { setEditing(false); return; }
    // Normalize code if changed
    const payload = { ...draft };
    if (typeof payload.code === "string") payload.code = payload.code.toUpperCase().trim();
    setSaving(true); setErrorMsg("");
    try { await onSave(position._id, payload); setEditing(false); setDraft({}); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [onSave, position._id, draft]);

  const handleDeleteClick = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const r = await api.getCrewPositionReferences(position._id);
      setRefs(r);
      setConfirmDelete(true);
    } catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setLoadingRefs(false); }
  }, [position._id]);

  const handleConfirmDelete = useCallback(async () => {
    setSaving(true); setErrorMsg("");
    try { await onDelete(position._id); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); setConfirmDelete(false); }
  }, [onDelete, position._id]);

  const handleDeactivate = useCallback(async () => {
    setSaving(true); setErrorMsg("");
    try { await onDeactivate(position._id); setConfirmDelete(false); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [onDeactivate, position._id]);

  const getVal = (key: keyof CrewPositionRef) =>
    key in draft ? (draft as any)[key] : position[key];

  const totalRefs = refs ? refs.expiryCodes : 0;
  const categoryLabel = position.category === "cockpit" ? "Flight Deck" : "Cabin Crew";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[24px] font-extrabold font-mono px-3 py-1 rounded-lg"
              style={{ backgroundColor: accentTint(position.color ?? ACCENT, isDark ? 0.15 : 0.1), color: position.color ?? ACCENT }}>
              {position.code}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              position.category === "cockpit" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
            }`}>
              {categoryLabel}
            </span>
            <div>
              <h1 className="text-[18px] font-semibold">{position.name}</h1>
              <p className="text-[12px] text-hz-text-secondary">
                Rank {position.rankOrder}{position.isPic ? " \u00b7 Pilot in Command" : ""}
                {!position.isActive ? " \u00b7 Inactive" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={handleCancel} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: ACCENT }}>
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button onClick={handleEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            )}
          </div>
        </div>
        {errorMsg && <ErrorBanner msg={errorMsg} onDismiss={() => setErrorMsg("")} />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        {/* Position Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: ACCENT }} />
            <span className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary">Position Information</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <FieldRow label="Position Code" value={<span className="font-mono font-bold">{position.code}</span>}
              editing={editing} fieldKey="code" editValue={getVal("code")} onChange={handleFieldChange} />
            <FieldRow label="Name" value={position.name}
              editing={editing} fieldKey="name" editValue={getVal("name")} onChange={handleFieldChange} />
            <FieldRow label="Category" value={
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                position.category === "cockpit" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
              }`}>{categoryLabel}</span>
            } />
            <FieldRow label="Rank Order" value={<span className="font-mono">{position.rankOrder}</span>}
              editing={editing} fieldKey="rankOrder" editValue={getVal("rankOrder")} onChange={handleFieldChange} inputType="number" />
          </div>
        </div>

        {/* Properties */}
        <div className="rounded-2xl p-5 mb-6"
          style={{
            background: isDark ? accentTint(ACCENT, 0.06) : accentTint(ACCENT, 0.04),
            border: `1px solid ${accentTint(ACCENT, isDark ? 0.15 : 0.15)}`,
          }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} color={isDark ? "#e0e0e0" : ACCENT} strokeWidth={1.8} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: isDark ? "#e0e0e0" : ACCENT }}>
              Position Properties
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <FieldRow label="Pilot in Command (PIC)"
              value={position.isPic
                ? <span className="text-amber-600 dark:text-amber-400 font-semibold">Yes</span>
                : <span className="text-hz-text-secondary">No</span>}
              editing={editing} fieldKey="isPic" editValue={getVal("isPic")} onChange={handleFieldChange} inputType="toggle" />
            <FieldRow label="Can Downrank"
              value={position.canDownrank
                ? <span className="text-green-600 dark:text-green-400 font-semibold">Yes</span>
                : <span className="text-hz-text-secondary">No</span>}
              editing={editing} fieldKey="canDownrank" editValue={getVal("canDownrank")} onChange={handleFieldChange} inputType="toggle" />
            <FieldRow label="Active"
              value={position.isActive
                ? <span className="text-green-600 dark:text-green-400 font-semibold">Active</span>
                : <span className="text-red-500 font-semibold">Inactive</span>}
              editing={editing} fieldKey="isActive" editValue={getVal("isActive")} onChange={handleFieldChange} inputType="toggle" />
          </div>
        </div>

        {/* Color + Description */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: ACCENT }} />
            <span className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary">Appearance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <FieldRow label="Color" value={
              position.color ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: position.color }} />
                  <span className="font-mono text-[12px]">{position.color}</span>
                </span>
              ) : <span className="text-hz-text-secondary">None</span>
            } />
            <FieldRow label="Description" value={position.description || <span className="text-hz-text-secondary">No description</span>}
              editing={editing} fieldKey="description" editValue={getVal("description")} onChange={handleFieldChange} />
          </div>
        </div>

        {/* Delete / Deactivate */}
        <div className="rounded-2xl p-5 border border-red-200 dark:border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 size={14} className="text-red-500" strokeWidth={1.8} />
            <span className="text-[12px] font-bold uppercase tracking-wider text-red-500">Danger Zone</span>
          </div>
          <p className="text-[13px] text-hz-text-secondary mb-3">
            Deleting a position is only possible if it is not referenced by any expiry codes, crew members, or complements.
            If referenced, you can deactivate it instead.
          </p>
          {confirmDelete ? (
            totalRefs > 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[13px] text-amber-700 dark:text-amber-400">
                    This position is referenced by <strong>{refs?.expiryCodes}</strong> expiry code{(refs?.expiryCodes ?? 0) !== 1 ? "s" : ""}.
                    It cannot be deleted but can be deactivated.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleDeactivate} disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50">
                    {saving ? "Deactivating..." : "Deactivate Instead"}
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-red-500 font-medium">Are you sure? This cannot be undone.</span>
                <button onClick={handleConfirmDelete} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50">
                  {saving ? "Deleting..." : "Yes, Delete"}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30">Cancel</button>
              </div>
            )
          ) : (
            <button onClick={handleDeleteClick} disabled={loadingRefs}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-red-500 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {loadingRefs ? "Checking..." : "Delete Position"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Helpers ─── */

function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
      <span className="text-[13px] text-red-700 dark:text-red-400">{msg}</span>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600 shrink-0 ml-auto"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function ToggleField({ label, value, onChange, description }: {
  label: string; value: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <div className="py-2.5 border-b border-hz-border/50">
      <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1">{label}</div>
      <button onClick={() => onChange(!value)}
        className="text-[13px] font-medium px-2.5 py-1 rounded-lg transition-colors"
        style={{
          backgroundColor: value ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
          color: value ? "#16a34a" : "#dc2626",
        }}>
        {value ? "Yes" : "No"}
      </button>
      {description && <p className="text-[11px] text-hz-text-secondary mt-1">{description}</p>}
    </div>
  );
}

function friendlyError(err: any): string {
  const msg = err?.message || "Failed";
  try {
    const m = msg.match(/API (\d+): (.+)/);
    if (m) { const p = JSON.parse(m[2]); return p.error || p.details?.join(", ") || msg; }
  } catch {}
  return msg;
}
