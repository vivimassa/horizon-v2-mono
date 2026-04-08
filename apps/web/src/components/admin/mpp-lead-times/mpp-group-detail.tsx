"use client";

import { useState, useCallback } from "react";
import type { MppLeadTimeGroupRef, MppLeadTimeItemRef } from "@skyhub/api";
import { getOperatorId } from "@/stores/use-operator-store";
import {
  Pencil, Save, X, Trash2, Plus, Clock, FileText,
  PlaneTakeoff, UsersRound, Layers,
} from "lucide-react";

const CREW_TYPES: { key: MppLeadTimeGroupRef["crewType"]; label: string; icon: typeof PlaneTakeoff }[] = [
  { key: "cockpit", label: "Cockpit", icon: PlaneTakeoff },
  { key: "cabin", label: "Cabin", icon: UsersRound },
  { key: "other", label: "Other", icon: Layers },
];

interface Props {
  group: MppLeadTimeGroupRef;
  items: MppLeadTimeItemRef[];
  onSaveGroup: (id: string, data: Partial<MppLeadTimeGroupRef>) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onCreateGroup: (data: Partial<MppLeadTimeGroupRef>) => Promise<void>;
  onCreateItem: (data: Partial<MppLeadTimeItemRef>) => Promise<void>;
  onUpdateItem: (id: string, data: Partial<MppLeadTimeItemRef>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export function MppGroupDetail({
  group, items, onSaveGroup, onDeleteGroup, onCreateGroup,
  onCreateItem, onUpdateItem, onDeleteItem,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Partial<MppLeadTimeGroupRef>>({});
  const [errorMsg, setErrorMsg] = useState("");

  // Create group flow
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [createForm, setCreateForm] = useState({ label: "", description: "", code: "", color: "#7c3aed", crewType: "cockpit" as const });
  const [createError, setCreateError] = useState("");

  // Add item flow
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ label: "", valueMonths: 3, consumedBy: "" });

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleField = useCallback((key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true);
    try { await onSaveGroup(group._id, draft); setEditing(false); setDraft({}); }
    catch { setErrorMsg("Save failed"); }
    finally { setSaving(false); }
  }, [onSaveGroup, group._id, draft]);

  const handleDelete = useCallback(async () => {
    setSaving(true); setErrorMsg("");
    try { await onDeleteGroup(group._id); }
    catch (e: any) { setErrorMsg(e.message || "Delete failed"); }
    finally { setSaving(false); setConfirmDelete(false); }
  }, [onDeleteGroup, group._id]);

  const handleCreateGroup = useCallback(async () => {
    if (!createForm.label || !createForm.code) { setCreateError("Label and code are required"); return; }
    try {
      await onCreateGroup({ operatorId: getOperatorId(), ...createForm });
      setShowCreateGroup(false);
      setCreateForm({ label: "", description: "", code: "", color: "#7c3aed", crewType: "cockpit" });
      setCreateError("");
    } catch (e: any) { setCreateError(e.message || "Create failed"); }
  }, [onCreateGroup, createForm]);

  const handleAddItem = useCallback(async () => {
    if (!newItem.label) return;
    try {
      await onCreateItem({
        operatorId: getOperatorId(),
        groupId: group._id,
        label: newItem.label,
        valueMonths: newItem.valueMonths,
        consumedBy: newItem.consumedBy || null,
      });
      setNewItem({ label: "", valueMonths: 3, consumedBy: "" });
      setAddingItem(false);
    } catch (e: any) { setErrorMsg(e.message || "Failed to add item"); }
  }, [onCreateItem, group._id, newItem]);

  const getVal = <K extends keyof MppLeadTimeGroupRef>(key: K): MppLeadTimeGroupRef[K] =>
    key in draft ? (draft as any)[key] : group[key];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-bold px-2.5 py-1 rounded text-white"
              style={{ backgroundColor: group.color }}>
              {group.code}
            </span>
            {/* Crew type badges */}
            {CREW_TYPES.map((ct) => {
              const active = group.crewType === ct.key;
              return (
                <span key={ct.key}
                  className={`text-[12px] px-2 py-0.5 rounded-full ${active ? "font-semibold" : "text-hz-text-tertiary"}`}
                  style={active ? { backgroundColor: `${group.color}15`, color: group.color } : undefined}>
                  {ct.label}
                </span>
              );
            })}
            <h1 className="text-xl font-semibold ml-1">{group.label}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={handleCancel} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-module-accent transition-colors">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-red-500 font-medium">Delete group & items?</span>
                    <button onClick={handleDelete} disabled={saving}
                      className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">Yes</button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button onClick={handleEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => { setShowCreateGroup(true); setCreateError(""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-module-accent transition-colors">
                  <Plus className="h-3.5 w-3.5" /> New Group
                </button>
              </>
            )}
          </div>
        </div>
        {group.description && (
          <p className="text-[13px] text-hz-text-secondary mt-1">{group.description}</p>
        )}
        <div className="text-[12px] text-hz-text-tertiary mt-1">{items.length} types</div>
        {errorMsg && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="text-[13px] text-red-700 dark:text-red-400 flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 shrink-0"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      {/* Create Group Panel */}
      {showCreateGroup && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Add New Group</span>
            <button onClick={() => setShowCreateGroup(false)} className="text-[13px] text-hz-text-secondary hover:text-hz-text">Cancel</button>
          </div>
          <div className="flex gap-3">
            <div className="w-24">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Code *</label>
              <input type="text" value={createForm.code} maxLength={6}
                onChange={(e) => setCreateForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Label *</label>
              <input type="text" value={createForm.label}
                onChange={(e) => setCreateForm(p => ({ ...p, label: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div className="w-28">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Crew Type</label>
              <select value={createForm.crewType}
                onChange={(e) => setCreateForm(p => ({ ...p, crewType: e.target.value as any }))}
                className="w-full mt-1 px-2 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none text-hz-text">
                {CREW_TYPES.map(ct => <option key={ct.key} value={ct.key}>{ct.label}</option>)}
              </select>
            </div>
            <div className="w-16">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Color</label>
              <input type="color" value={createForm.color}
                onChange={(e) => setCreateForm(p => ({ ...p, color: e.target.value }))}
                className="w-full mt-1 h-[34px] rounded-lg border border-hz-border cursor-pointer" />
            </div>
          </div>
          <button onClick={handleCreateGroup}
            className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white bg-module-accent transition-colors disabled:opacity-50">
            Add Group
          </button>
          {createError && <p className="text-[12px] text-red-500">{createError}</p>}
        </div>
      )}

      {/* Edit fields */}
      {editing && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Code</label>
              <input type="text" value={getVal("code")} maxLength={6}
                onChange={(e) => handleField("code", e.target.value.toUpperCase())}
                className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div className="col-span-2">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Label</label>
              <input type="text" value={getVal("label")}
                onChange={(e) => handleField("label", e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div>
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Crew Type</label>
              <select value={getVal("crewType")}
                onChange={(e) => handleField("crewType", e.target.value)}
                className="w-full mt-1 px-2 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none text-hz-text">
                {CREW_TYPES.map(ct => <option key={ct.key} value={ct.key}>{ct.label}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Description</label>
              <input type="text" value={getVal("description") ?? ""}
                onChange={(e) => handleField("description", e.target.value || null)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div>
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Color</label>
              <input type="color" value={getVal("color")}
                onChange={(e) => handleField("color", e.target.value)}
                className="w-full mt-1 h-[34px] rounded-lg border border-hz-border cursor-pointer" />
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-1">
          {items.map((item) => (
            <LeadTimeRow
              key={item._id}
              item={item}
              groupColor={group.color}
              onUpdate={onUpdateItem}
              onDelete={onDeleteItem}
            />
          ))}

          {/* Add item row */}
          {addingItem ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-hz-border">
              <input type="text" placeholder="Label" value={newItem.label}
                onChange={(e) => setNewItem(p => ({ ...p, label: e.target.value }))}
                className="flex-1 text-[13px] px-2 py-1.5 rounded-lg border border-hz-border bg-hz-bg outline-none text-hz-text" autoFocus />
              <input type="text" placeholder="Consumed by" value={newItem.consumedBy}
                onChange={(e) => setNewItem(p => ({ ...p, consumedBy: e.target.value }))}
                className="w-40 text-[13px] px-2 py-1.5 rounded-lg border border-hz-border bg-hz-bg outline-none text-hz-text" />
              <input type="number" min={1} max={120} value={newItem.valueMonths}
                onChange={(e) => setNewItem(p => ({ ...p, valueMonths: parseInt(e.target.value) || 1 }))}
                className="w-14 text-center text-[13px] font-mono font-bold rounded-lg border-2 bg-hz-bg text-hz-text outline-none"
                style={{ borderColor: group.color, color: group.color }} />
              <span className="text-[12px] text-hz-text-tertiary">mo</span>
              <button onClick={handleAddItem}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-module-accent">Add</button>
              <button onClick={() => setAddingItem(false)}
                className="text-[13px] text-hz-text-secondary hover:text-hz-text">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingItem(true)}
              className="w-full py-3 rounded-xl border border-dashed border-hz-border text-[13px] text-hz-text-secondary hover:text-hz-text hover:border-hz-text-secondary transition-colors">
              + Add lead time type to &ldquo;{group.label}&rdquo;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Lead Time Row ── */

function LeadTimeRow({
  item,
  groupColor,
  onUpdate,
  onDelete,
}: {
  item: MppLeadTimeItemRef;
  groupColor: string;
  onUpdate: (id: string, data: Partial<MppLeadTimeItemRef>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingMonths, setEditingMonths] = useState(false);
  const [draftMonths, setDraftMonths] = useState(item.valueMonths);
  const [showNotes, setShowNotes] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const commitMonths = async () => {
    setEditingMonths(false);
    if (draftMonths !== item.valueMonths && draftMonths >= 1) {
      await onUpdate(item._id, { valueMonths: draftMonths });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-hz-border/50 hover:border-hz-border transition-colors group">
        {/* Grip */}
        <div className="flex flex-col gap-0.5 opacity-20 group-hover:opacity-40 shrink-0">
          <div className="w-1 h-1 rounded-full bg-hz-text-secondary" />
          <div className="w-1 h-1 rounded-full bg-hz-text-secondary" />
          <div className="w-1 h-1 rounded-full bg-hz-text-secondary" />
        </div>

        {/* Label + consumed by */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-hz-text">{item.label}</div>
          {item.consumedBy && (
            <div className="text-[12px] text-hz-text-tertiary flex items-center gap-1">
              <FileText size={10} /> {item.consumedBy}
            </div>
          )}
        </div>

        {/* Month value */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock size={13} className="text-hz-text-tertiary" />
          {editingMonths ? (
            <input type="number" min={1} max={120} value={draftMonths} autoFocus
              onChange={(e) => setDraftMonths(parseInt(e.target.value) || 1)}
              onBlur={commitMonths}
              onKeyDown={(e) => { if (e.key === "Enter") commitMonths(); if (e.key === "Escape") setEditingMonths(false); }}
              className="w-12 h-7 text-center text-[14px] font-mono font-bold rounded-md border-2 outline-none bg-hz-bg"
              style={{ borderColor: groupColor, color: groupColor }} />
          ) : (
            <button onClick={() => { setDraftMonths(item.valueMonths); setEditingMonths(true); }}
              className="text-[14px] font-bold font-mono tabular-nums hover:underline"
              style={{ color: groupColor }}>
              {item.valueMonths}
            </button>
          )}
          <span className="text-[12px] text-hz-text-tertiary">mo</span>
        </div>

        {/* Notes toggle */}
        <button onClick={() => setShowNotes(!showNotes)}
          className={`px-2 py-1 rounded-lg text-[12px] font-medium transition-colors ${showNotes ? "bg-module-accent/10 text-module-accent" : "text-hz-text-secondary hover:bg-hz-border/30"}`}>
          Notes
        </button>

        {/* Delete */}
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button onClick={() => onDelete(item._id)}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-red-500">Yes</button>
            <button onClick={() => setConfirmDel(false)}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-hz-text-secondary">No</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)}
            className="opacity-0 group-hover:opacity-50 hover:!opacity-100 p-1.5 rounded-lg text-hz-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Notes panel */}
      {showNotes && (
        <div className="ml-8 mr-4 mt-1 mb-2 px-4 py-3 rounded-lg border border-hz-border/30 bg-hz-bg/50">
          <textarea
            rows={2}
            placeholder="Add notes..."
            defaultValue={item.note ?? ""}
            onBlur={(e) => {
              const val = e.target.value.trim() || null;
              if (val !== item.note) onUpdate(item._id, { note: val });
            }}
            className="w-full text-[13px] bg-transparent outline-none resize-none text-hz-text placeholder:text-hz-text-tertiary"
          />
        </div>
      )}
    </div>
  );
}
