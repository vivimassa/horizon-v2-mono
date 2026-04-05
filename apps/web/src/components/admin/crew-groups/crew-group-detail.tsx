"use client";

import { useEffect, useState, useCallback } from "react";
import type { CrewGroupRef } from "@skyhub/api";
import { useTheme } from "@/components/theme-provider";
import { accentTint } from "@skyhub/ui/theme";
import { FieldRow } from "../airports/field-row";
import { ACCENT } from "./crew-groups-shell";
import {
  Plus, Pencil, Save, X, Trash2, Users, Hash, AlertTriangle,
} from "lucide-react";

interface DetailProps {
  group: CrewGroupRef | null;
  onCreate?: (data: Partial<CrewGroupRef>) => Promise<void>;
  onSave?: (id: string, data: Partial<CrewGroupRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCancel?: () => void;
}

export function CrewGroupDetail({ group, onCreate, onSave, onDelete, onCancel }: DetailProps) {
  if (!group) {
    return <CreatePanel onCreate={onCreate!} onCancel={onCancel!} />;
  }
  return (
    <ViewEditPanel
      group={group}
      onSave={onSave!}
      onDelete={onDelete!}
    />
  );
}

/* ─── Create Panel ─── */

function CreatePanel({ onCreate, onCancel }: { onCreate: (d: Partial<CrewGroupRef>) => Promise<void>; onCancel: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [form, setForm] = useState({ name: "", description: "", sortOrder: 10 });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const set = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErrorMsg("Name is required"); return; }
    setSaving(true); setErrorMsg("");
    try {
      await onCreate({
        name: form.name.trim(),
        description: form.description.trim() || null,
        sortOrder: form.sortOrder,
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
              <h1 className="text-[18px] font-semibold">New Crew Group</h1>
              <p className="text-[12px] text-hz-text-secondary">Define a new group for crew classification</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-[13px] text-hz-text-secondary hover:text-hz-text font-medium">Cancel</button>
        </div>
        {errorMsg && <ErrorBanner msg={errorMsg} onDismiss={() => setErrorMsg("")} />}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div className="py-2.5 border-b border-hz-border/50 col-span-2">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Name *</label>
            <input type="text" value={form.name} placeholder="e.g. Management Pilots - AFS"
              onChange={(e) => set("name", e.target.value)}
              className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" />
          </div>
          <div className="py-2.5 border-b border-hz-border/50 col-span-2">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Description</label>
            <input type="text" value={form.description} placeholder="Optional description"
              onChange={(e) => set("description", e.target.value)}
              className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" />
          </div>
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Sort Order</label>
            <input type="number" min={0} value={form.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value))}
              className="w-full text-[13px] font-mono bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}>
            <Plus className="h-4 w-4" /> {saving ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── View / Edit Panel ─── */

function ViewEditPanel({ group, onSave, onDelete }: {
  group: CrewGroupRef;
  onSave: (id: string, data: Partial<CrewGroupRef>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<CrewGroupRef>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditing(false); setDraft({}); setConfirmDelete(false); setErrorMsg("");
  }, [group._id]);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true); setErrorMsg("");
    try { await onSave(group._id, draft); setEditing(false); setDraft({}); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [onSave, group._id, draft]);

  const handleConfirmDelete = useCallback(async () => {
    setSaving(true); setErrorMsg("");
    try { await onDelete(group._id); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); setConfirmDelete(false); }
  }, [onDelete, group._id]);

  const getVal = (key: keyof CrewGroupRef) =>
    key in draft ? (draft as any)[key] : group[key];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: accentTint(ACCENT, isDark ? 0.15 : 0.1) }}>
              <Users size={18} color={ACCENT} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold">{group.name}</h1>
              <p className="text-[12px] text-hz-text-secondary">
                Sort order {group.sortOrder}{!group.isActive ? " · Inactive" : ""}
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
        {/* Group Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: ACCENT }} />
            <span className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary">Group Information</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <FieldRow label="Name" value={group.name}
              editing={editing} fieldKey="name" editValue={getVal("name")} onChange={handleFieldChange} />
            <FieldRow label="Sort Order" value={<span className="font-mono">{group.sortOrder}</span>}
              editing={editing} fieldKey="sortOrder" editValue={getVal("sortOrder")} onChange={handleFieldChange} inputType="number" />
            <FieldRow label="Description" value={group.description || <span className="text-hz-text-secondary">No description</span>}
              editing={editing} fieldKey="description" editValue={getVal("description")} onChange={handleFieldChange} />
            <FieldRow label="Active"
              value={group.isActive
                ? <span className="text-green-600 dark:text-green-400 font-semibold">Active</span>
                : <span className="text-red-500 font-semibold">Inactive</span>}
              editing={editing} fieldKey="isActive" editValue={getVal("isActive")} onChange={handleFieldChange} inputType="toggle" />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl p-5 border border-red-200 dark:border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 size={14} className="text-red-500" strokeWidth={1.8} />
            <span className="text-[12px] font-bold uppercase tracking-wider text-red-500">Danger Zone</span>
          </div>
          <p className="text-[13px] text-hz-text-secondary mb-3">
            Deleting a crew group removes it permanently. Crew members assigned to this group will be unlinked.
          </p>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-red-500 font-medium">Are you sure? This cannot be undone.</span>
              <button onClick={handleConfirmDelete} disabled={saving}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50">
                {saving ? "Deleting..." : "Yes, Delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-red-500 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              Delete Group
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

function friendlyError(err: any): string {
  const msg = err?.message || "Failed";
  try {
    const m = msg.match(/API (\d+): (.+)/);
    if (m) { const p = JSON.parse(m[2]); return p.error || p.details?.join(", ") || msg; }
  } catch {}
  return msg;
}
