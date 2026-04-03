"use client";

import { useState, useCallback } from "react";
import type { AirportRef, RunwayData } from "@skyhub/api";
import { api } from "@skyhub/api";
import { FieldRow } from "./field-row";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Check,
  Lightbulb,
  ArrowUpDown,
} from "lucide-react";

interface Props {
  airport: AirportRef;
  editing?: boolean;
  draft?: Partial<AirportRef>;
  onChange?: (key: string, value: string | number | boolean | null) => void;
  onRefresh?: () => void;
}

const SURFACE_OPTIONS = [
  "ASPHALT", "CONCRETE", "ASPHALT/CONCRETE", "GRAVEL", "GRASS", "DIRT", "WATER", "OTHER",
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "under-construction", label: "Under Construction" },
];

const ILS_OPTIONS = [
  "", "CAT I", "CAT II", "CAT IIIA", "CAT IIIB", "CAT IIIC",
];

type RunwayForm = {
  identifier: string;
  lengthFt: string;
  widthFt: string;
  surface: string;
  ilsCategory: string;
  lighting: boolean;
  status: string;
  notes: string;
};

const emptyForm: RunwayForm = {
  identifier: "", lengthFt: "", widthFt: "", surface: "ASPHALT",
  ilsCategory: "", lighting: false, status: "active", notes: "",
};

export function AirportRunwayTab({ airport, editing, draft = {}, onChange, onRefresh }: Props) {
  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport[key]);
  const runways = airport.runways ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<RunwayForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RunwayForm>({ ...emptyForm });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const formToPayload = (form: RunwayForm) => {
    const lengthFt = form.lengthFt ? Number(form.lengthFt) : null;
    const widthFt = form.widthFt ? Number(form.widthFt) : null;
    return {
      identifier: form.identifier,
      lengthFt,
      lengthM: lengthFt ? Math.round(lengthFt * 0.3048) : null,
      widthFt,
      widthM: widthFt ? Math.round(widthFt * 0.3048) : null,
      surface: form.surface || null,
      ilsCategory: form.ilsCategory || null,
      lighting: form.lighting,
      status: form.status,
      notes: form.notes || null,
    };
  };

  const handleAdd = useCallback(async () => {
    if (!addForm.identifier.trim()) { setError("Identifier is required"); return; }
    setSaving(true); setError("");
    try {
      await api.addRunway(airport._id, formToPayload(addForm));
      setShowAdd(false);
      setAddForm({ ...emptyForm });
      onRefresh?.();
    } catch (err: any) { setError(err.message || "Failed to add runway"); }
    finally { setSaving(false); }
  }, [airport._id, addForm, onRefresh]);

  const handleEditSave = useCallback(async () => {
    if (!editId) return;
    setSaving(true); setError("");
    try {
      await api.updateRunway(airport._id, editId, formToPayload(editForm));
      setEditId(null);
      onRefresh?.();
    } catch (err: any) { setError(err.message || "Failed to update runway"); }
    finally { setSaving(false); }
  }, [airport._id, editId, editForm, onRefresh]);

  const handleDelete = useCallback(async (rwId: string) => {
    setSaving(true); setError("");
    try {
      await api.deleteRunway(airport._id, rwId);
      setConfirmDeleteId(null);
      onRefresh?.();
    } catch (err: any) { setError(err.message || "Failed to delete runway"); }
    finally { setSaving(false); }
  }, [airport._id, onRefresh]);

  const startEdit = (rw: RunwayData) => {
    setEditId(rw._id);
    setEditForm({
      identifier: rw.identifier,
      lengthFt: rw.lengthFt?.toString() ?? "",
      widthFt: rw.widthFt?.toString() ?? "",
      surface: rw.surface ?? "ASPHALT",
      ilsCategory: rw.ilsCategory ?? "",
      lighting: rw.lighting,
      status: rw.status,
      notes: rw.notes ?? "",
    });
  };

  return (
    <div className="px-6 pt-3 pb-6 space-y-6">
      {/* ── Runways Section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: "#1e40af" }} />
            <h3 className="text-[14px] font-bold">Runways</h3>
            <span className="text-[12px] text-hz-text-secondary">({runways.length})</span>
          </div>
          {!showAdd && !editId && (
            <button
              onClick={() => { setShowAdd(true); setAddForm({ ...emptyForm }); setError(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors"
              style={{ backgroundColor: "#1e40af" }}
            >
              <Plus className="h-3 w-3" />
              Add Runway
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 flex items-center justify-between">
            <span className="text-[12px] text-red-600 dark:text-red-400">{error}</span>
            <button onClick={() => setError("")}><X className="h-3 w-3 text-red-400" /></button>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="mb-4 p-4 rounded-xl border border-hz-border bg-hz-card space-y-3">
            <div className="text-[13px] font-semibold">New Runway</div>
            <RunwayFormFields form={addForm} setForm={setAddForm} />
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleAdd} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#1e40af" }}>
                <Check className="h-3 w-3" />
                {saving ? "Adding…" : "Add"}
              </button>
              <button onClick={() => { setShowAdd(false); setError(""); }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Runway list */}
        {runways.length === 0 && !showAdd ? (
          <div className="py-8 text-center text-[13px] text-hz-text-secondary">
            No runway data available. Add runways manually or re-create this airport via ICAO lookup to auto-populate.
          </div>
        ) : (
          <div className="space-y-2">
            {runways.map((rw) => {
              const isEditing = editId === rw._id;

              if (isEditing) {
                return (
                  <div key={rw._id} className="p-4 rounded-xl border-2 border-module-accent/30 bg-module-accent/[0.03] space-y-3">
                    <RunwayFormFields form={editForm} setForm={setEditForm} />
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={handleEditSave} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "#1e40af" }}>
                        <Save className="h-3 w-3" />
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => { setEditId(null); setError(""); }}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={rw._id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border border-hz-border bg-hz-card hover:border-hz-border/80 transition-colors">
                  {/* Identifier */}
                  <div className="w-24 shrink-0">
                    <div className="text-[14px] font-bold">{rw.identifier}</div>
                    <div className="text-[11px] text-hz-text-secondary mt-0.5">
                      {rw.status === "active" ? (
                        <span className="text-green-600 dark:text-green-400">Active</span>
                      ) : rw.status === "closed" ? (
                        <span className="text-red-500">Closed</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Construction</span>
                      )}
                    </div>
                  </div>

                  {/* Dimensions */}
                  <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1">
                    <Field label="Length" value={rw.lengthFt ? `${rw.lengthFt.toLocaleString()} ft` : "—"} sub={rw.lengthM ? `${rw.lengthM.toLocaleString()} m` : undefined} />
                    <Field label="Width" value={rw.widthFt ? `${rw.widthFt.toLocaleString()} ft` : "—"} sub={rw.widthM ? `${rw.widthM.toLocaleString()} m` : undefined} />
                    <Field label="Surface" value={rw.surface ?? "—"} />
                    <Field label="ILS" value={rw.ilsCategory ?? "None"} />
                  </div>

                  {/* Lighting indicator */}
                  <div className="shrink-0" title={rw.lighting ? "Lighted" : "No lighting"}>
                    <Lightbulb className={`h-4 w-4 ${rw.lighting ? "text-amber-500" : "text-hz-text-secondary/30"}`} />
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1">
                    <button onClick={() => startEdit(rw)}
                      className="p-1.5 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                      title="Edit runway">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDeleteId === rw._id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(rw._id)} disabled={saving}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                          Yes
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(rw._id)}
                        className="p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Delete runway">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Facilities Section ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full" style={{ backgroundColor: "#1e40af" }} />
          <h3 className="text-[14px] font-bold">Facilities</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <FieldRow label="Number of Gates" value={airport.numberOfGates}
            editing={editing} fieldKey="numberOfGates" editValue={get("numberOfGates")} onChange={onChange} inputType="number" />
          <FieldRow label="Fire Category" value={airport.fireCategory}
            editing={editing} fieldKey="fireCategory" editValue={get("fireCategory")} onChange={onChange} inputType="number" />
          <FieldRow label="Fuel Available"
            value={airport.hasFuelAvailable ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>}
            editing={editing} fieldKey="hasFuelAvailable" editValue={get("hasFuelAvailable")} onChange={onChange} inputType="toggle" />
          <FieldRow label="Crew Facilities"
            value={airport.hasCrewFacilities ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>}
            editing={editing} fieldKey="hasCrewFacilities" editValue={get("hasCrewFacilities")} onChange={onChange} inputType="toggle" />
        </div>
      </div>
    </div>
  );
}

/* ── Reusable runway form fields ── */
function RunwayFormFields({ form, setForm }: { form: RunwayForm; setForm: (fn: (prev: RunwayForm) => RunwayForm) => void }) {
  return (
    <>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Identifier *</label>
          <input type="text" value={form.identifier} placeholder="e.g. 08L/26R"
            onChange={(e) => setForm(p => ({ ...p, identifier: e.target.value.toUpperCase() }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Surface</label>
          <select value={form.surface}
            onChange={(e) => setForm(p => ({ ...p, surface: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text">
            {SURFACE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Status</label>
          <select value={form.status}
            onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text">
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Length (ft)</label>
          <input type="number" value={form.lengthFt}
            onChange={(e) => setForm(p => ({ ...p, lengthFt: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">Width (ft)</label>
          <input type="number" value={form.widthFt}
            onChange={(e) => setForm(p => ({ ...p, widthFt: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-semibold">ILS Category</label>
          <select value={form.ilsCategory}
            onChange={(e) => setForm(p => ({ ...p, ilsCategory: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text">
            {ILS_OPTIONS.map(s => <option key={s} value={s}>{s || "None"}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.lighting}
            onChange={(e) => setForm(p => ({ ...p, lighting: e.target.checked }))}
            className="rounded border-hz-border" />
          <span className="text-[13px]">Lighted</span>
        </label>
        <div className="flex-1">
          <input type="text" value={form.notes} placeholder="Notes (optional)"
            onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
        </div>
      </div>
    </>
  );
}

/* ── Small field display for runway row ── */
function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] text-hz-text-secondary uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-[13px] font-medium">{value}</div>
      {sub && <div className="text-[11px] text-hz-text-secondary">{sub}</div>}
    </div>
  );
}
