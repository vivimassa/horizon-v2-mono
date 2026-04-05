"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type ExpiryCodeRef, type ExpiryCodeCategoryRef, type CrewPositionRef } from "@skyhub/api";
import { EXPIRY_FORMULAS, SEVERITY_DEFINITIONS } from "@skyhub/logic";
import { useTheme } from "@/components/theme-provider";
import { accentTint } from "@skyhub/ui/theme";
import { FieldRow } from "../airports/field-row";
import { ACCENT } from "./expiry-codes-shell";
import { FormulaSection } from "./expiry-formula-section";
import { SeveritySection } from "./expiry-severity-section";
import { PositionsSection } from "./expiry-positions-section";
import {
  Plus, Pencil, Save, X, Trash2, Settings, ShieldAlert, Users, Beaker, FileText,
} from "lucide-react";

/* ─── Props ─── */

interface DetailProps {
  code: ExpiryCodeRef | null;
  categories: ExpiryCodeCategoryRef[];
  onCreate?: (data: Partial<ExpiryCodeRef>) => Promise<void>;
  onSave?: (id: string, data: Partial<ExpiryCodeRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onDeactivate?: (id: string) => Promise<void>;
  onCancel?: () => void;
}

export function ExpiryCodeDetail({ code, categories, onCreate, onSave, onDelete, onDeactivate, onCancel }: DetailProps) {
  if (!code) {
    return <CreatePanel onCreate={onCreate!} onCancel={onCancel!} categories={categories} />;
  }
  return (
    <ViewEditPanel
      code={code} categories={categories}
      onSave={onSave!} onDelete={onDelete!} onDeactivate={onDeactivate!}
    />
  );
}

/* ─── Create Panel ─── */

function CreatePanel({ onCreate, onCancel, categories }: {
  onCreate: (d: Partial<ExpiryCodeRef>) => Promise<void>;
  onCancel: () => void;
  categories: ExpiryCodeCategoryRef[];
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [positions, setPositions] = useState<CrewPositionRef[]>([]);
  const [form, setForm] = useState({
    code: "", name: "", description: "",
    categoryId: categories[0]?._id ?? "",
    crewCategory: "both" as "both" | "cockpit" | "cabin",
    formula: "fixed_validity",
    formulaParams: {} as Record<string, any>,
    acTypeScope: "none" as "none" | "family" | "variant",
    linkedTrainingCode: "",
    warningDays: 30 as number | null,
    severity: [] as string[],
    applicablePositions: [] as string[],
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    api.getCrewPositions("horizon").then(setPositions).catch(console.error);
  }, []);

  const set = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) { setErrorMsg("Code and Name are required"); return; }
    if (!form.categoryId) { setErrorMsg("Category is required"); return; }
    setSaving(true); setErrorMsg("");
    try {
      await onCreate({
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        categoryId: form.categoryId,
        crewCategory: form.crewCategory,
        formula: form.formula,
        formulaParams: form.formulaParams,
        acTypeScope: form.acTypeScope,
        linkedTrainingCode: form.linkedTrainingCode.trim() || null,
        warningDays: form.warningDays != null ? form.warningDays : null,
        severity: form.severity,
        applicablePositions: form.applicablePositions,
        notes: form.notes.trim() || null,
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
              <h1 className="text-[18px] font-semibold">New Expiry Code</h1>
              <p className="text-[12px] text-hz-text-secondary">Define a new qualification tracking rule</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-[13px] text-hz-text-secondary hover:text-hz-text font-medium">Cancel</button>
        </div>
        {errorMsg && <ErrorBanner msg={errorMsg} onDismiss={() => setErrorMsg("")} />}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <FormField label="Code *" value={form.code} placeholder="e.g. OPC"
            onChange={(v) => set("code", v.toUpperCase())} mono maxLength={10} />
          <FormField label="Name *" value={form.name} placeholder="e.g. Operator Proficiency Check"
            onChange={(v) => set("name", v)} />
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Category *</label>
            <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}
              className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
              {categories.map(c => <option key={c._id} value={c._id}>{c.label}</option>)}
            </select>
          </div>
          <div className="py-2.5 border-b border-hz-border/50">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Crew Category</label>
            <select value={form.crewCategory} onChange={(e) => set("crewCategory", e.target.value)}
              className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
              <option value="both">Both (Flight Deck + Cabin)</option>
              <option value="cockpit">Flight Deck Only</option>
              <option value="cabin">Cabin Crew Only</option>
            </select>
          </div>
          <FormField label="Description" value={form.description} placeholder="Optional description"
            onChange={(v) => set("description", v)} />
          <FormField label="Warning Days" value={form.warningDays != null ? String(form.warningDays) : ""} type="number"
            onChange={(v) => set("warningDays", v === "" ? null : Number(v))} />
        </div>

        <FormulaSection formula={form.formula} formulaParams={form.formulaParams} acTypeScope={form.acTypeScope}
          onFormulaChange={(f) => { set("formula", f); set("formulaParams", {}); }}
          onParamsChange={(p) => set("formulaParams", p)}
          onAcTypeScopeChange={(s) => set("acTypeScope", s)} isDark={isDark} />

        <SeveritySection severity={form.severity} onChange={(s) => set("severity", s)} isDark={isDark} />

        <PositionsSection selected={form.applicablePositions} positions={positions}
          crewCategory={form.crewCategory} onChange={(p) => set("applicablePositions", p)} isDark={isDark} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <FormField label="Linked Training Code" value={form.linkedTrainingCode} placeholder="e.g. LPC"
            onChange={(v) => set("linkedTrainingCode", v)} />
          <FormField label="Notes" value={form.notes} placeholder="Internal notes"
            onChange={(v) => set("notes", v)} />
        </div>

        <div className="flex justify-end">
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}>
            <Plus className="h-4 w-4" /> {saving ? "Creating..." : "Create Expiry Code"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── View / Edit Panel ─── */

function ViewEditPanel({ code, categories, onSave, onDelete, onDeactivate }: {
  code: ExpiryCodeRef;
  categories: ExpiryCodeCategoryRef[];
  onSave: (id: string, data: Partial<ExpiryCodeRef>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<ExpiryCodeRef>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [positions, setPositions] = useState<CrewPositionRef[]>([]);

  useEffect(() => {
    api.getCrewPositions("horizon").then(setPositions).catch(console.error);
  }, []);

  useEffect(() => {
    setEditing(false); setDraft({}); setConfirmDelete(false); setErrorMsg("");
  }, [code._id]);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);

  const handleSave = useCallback(async () => {
    if (Object.keys(draft).length === 0) { setEditing(false); return; }
    const payload = { ...draft };
    if (typeof payload.code === "string") payload.code = payload.code.toUpperCase().trim();
    setSaving(true); setErrorMsg("");
    try { await onSave(code._id, payload); setEditing(false); setDraft({}); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [onSave, code._id, draft]);

  const handleConfirmDelete = useCallback(async () => {
    setSaving(true); setErrorMsg("");
    try { await onDelete(code._id); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); setConfirmDelete(false); }
  }, [onDelete, code._id]);

  const handleDeactivate = useCallback(async () => {
    setSaving(true); setErrorMsg("");
    try { await onDeactivate(code._id); setConfirmDelete(false); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [onDeactivate, code._id]);

  const getVal = <K extends keyof ExpiryCodeRef>(key: K): ExpiryCodeRef[K] =>
    key in draft ? (draft as any)[key] : code[key];

  const setField = useCallback((key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const formulaDef = EXPIRY_FORMULAS.find(f => f.id === getVal("formula"));
  const category = categories.find(c => c._id === getVal("categoryId"));

  const crewCatLabels: Record<string, string> = { both: "Both (FD + CC)", cockpit: "Flight Deck", cabin: "Cabin Crew" };
  const crewCategoryLabel = crewCatLabels[getVal("crewCategory")] ?? getVal("crewCategory");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[24px] font-extrabold font-mono px-3 py-1 rounded-lg"
              style={{ backgroundColor: accentTint(category?.color ?? ACCENT, isDark ? 0.15 : 0.1), color: category?.color ?? ACCENT }}>
              {code.code}
            </span>
            {category && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: accentTint(category.color, isDark ? 0.12 : 0.08), color: category.color }}>
                {category.label}
              </span>
            )}
            <div>
              <h1 className="text-[18px] font-semibold">{code.name}</h1>
              <p className="text-[12px] text-hz-text-secondary">
                {formulaDef?.label ?? code.formula}
                {!code.isActive ? " \u00b7 Inactive" : ""}
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
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-6">
        {/* Code Information */}
        <div>
          <SectionHeader icon={<Settings size={14} />} label="Code Information" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <FieldRow label="Code" value={<span className="font-mono font-bold">{code.code}</span>}
              editing={editing} fieldKey="code" editValue={getVal("code")} onChange={setField} />
            <FieldRow label="Name" value={code.name}
              editing={editing} fieldKey="name" editValue={getVal("name")} onChange={setField} />
            {/* Category — show dropdown in edit mode, badge in view mode */}
            {editing ? (
              <div className="py-2.5 border-b border-hz-border/50">
                <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Category</label>
                <select value={getVal("categoryId")} onChange={(e) => setField("categoryId", e.target.value)}
                  className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
                  {categories.map(c => <option key={c._id} value={c._id}>{c.label}</option>)}
                </select>
              </div>
            ) : (
              <FieldRow label="Category" value={
                category ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: accentTint(category.color, isDark ? 0.12 : 0.08), color: category.color }}>
                    {category.label}
                  </span>
                ) : <span className="text-hz-text-secondary">Unknown</span>
              } />
            )}
            {/* Crew Category — show dropdown in edit mode, badge in view mode */}
            {editing ? (
              <div className="py-2.5 border-b border-hz-border/50">
                <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Crew Category</label>
                <select value={getVal("crewCategory")} onChange={(e) => setField("crewCategory", e.target.value)}
                  className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
                  <option value="both">Both (Flight Deck + Cabin)</option>
                  <option value="cockpit">Flight Deck Only</option>
                  <option value="cabin">Cabin Crew Only</option>
                </select>
              </div>
            ) : (
              <FieldRow label="Crew Category" value={
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                  getVal("crewCategory") === "cockpit" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                  : getVal("crewCategory") === "cabin" ? "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400"
                }`}>{crewCategoryLabel}</span>
              } />
            )}
            <FieldRow label="Description" value={code.description || <span className="text-hz-text-secondary">No description</span>}
              editing={editing} fieldKey="description" editValue={getVal("description") ?? ""} onChange={setField} />
            <FieldRow label="Warning Days" value={code.warningDays != null ? <span className="font-mono">{code.warningDays} days</span> : <span className="text-hz-text-secondary">Not set</span>}
              editing={editing} fieldKey="warningDays" editValue={getVal("warningDays")} onChange={(k, v) => setField(k, v === "" || v == null ? null : Number(v))} inputType="number" />
          </div>
        </div>

        {/* Formula */}
        {editing ? (
          <FormulaSection formula={getVal("formula")} formulaParams={getVal("formulaParams")} acTypeScope={getVal("acTypeScope")}
            onFormulaChange={(f) => { setField("formula", f); setField("formulaParams", {}); }}
            onParamsChange={(p) => setField("formulaParams", p)}
            onAcTypeScopeChange={(s) => setField("acTypeScope", s)} isDark={isDark} />
        ) : (
          <div>
            <SectionHeader icon={<Beaker size={14} />} label="Formula Configuration" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <FieldRow label="Formula Type" value={<span className="font-medium">{formulaDef?.label ?? code.formula}</span>} />
              {formulaDef && formulaDef.fields.map(field => (
                <FieldRow key={field.key} label={field.label} value={
                  code.formulaParams?.[field.key] != null
                    ? <span className="font-mono">{code.formulaParams[field.key]}{field.unit ? ` ${field.unit}` : ""}</span>
                    : <span className="text-hz-text-secondary">Not set</span>
                } />
              ))}
              <FieldRow label="AC Type Scope" value={
                code.acTypeScope === "none" ? <span className="text-hz-text-secondary">Not type-specific</span>
                : <span className="font-medium capitalize">{code.acTypeScope}</span>
              } />
              <FieldRow label="Linked Training Code" value={
                code.linkedTrainingCode ? <span className="font-mono font-bold">{code.linkedTrainingCode}</span>
                : <span className="text-hz-text-secondary">None</span>
              } />
            </div>
          </div>
        )}

        {/* Severity */}
        {editing ? (
          <SeveritySection severity={getVal("severity")} onChange={(s) => setField("severity", s)} isDark={isDark} />
        ) : (
          <div>
            <SectionHeader icon={<ShieldAlert size={14} />} label="Enforcement" />
            {code.severity.length === 0 ? (
              <p className="text-[13px] text-hz-text-secondary">No enforcement rules configured</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {code.severity.map(key => {
                  const def = SEVERITY_DEFINITIONS.find(s => s.key === key);
                  if (!def) return null;
                  return (
                    <span key={key} className={`text-[12px] font-semibold px-2.5 py-1 rounded-lg ${
                      def.isDestructive ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                      : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                    }`}>{def.label}</span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Positions */}
        {editing ? (
          <PositionsSection selected={getVal("applicablePositions")} positions={positions}
            crewCategory={getVal("crewCategory")} onChange={(p) => setField("applicablePositions", p)} isDark={isDark} />
        ) : (
          <div>
            <SectionHeader icon={<Users size={14} />} label="Applicable Positions" />
            {code.applicablePositions.length === 0 ? (
              <p className="text-[13px] text-hz-text-secondary">Applies to all positions in crew category</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {code.applicablePositions.map(pos => (
                  <span key={pos} className="text-[12px] font-bold font-mono px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-300">{pos}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {(code.notes || editing) && (
          <div>
            <SectionHeader icon={<FileText size={14} />} label="Notes" />
            {editing ? (
              <textarea value={getVal("notes") ?? ""} onChange={(e) => setField("notes", e.target.value || null)}
                rows={2} placeholder="Internal notes..."
                className="w-full text-[13px] font-medium bg-transparent border border-hz-border/50 rounded-lg outline-none focus:border-hz-accent p-2 text-hz-text resize-none" />
            ) : (
              <p className="text-[13px] text-hz-text-secondary">{code.notes}</p>
            )}
          </div>
        )}

        {/* Active + linked training in edit mode */}
        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <FieldRow label="Active"
              value={code.isActive ? <span className="text-green-600 dark:text-green-400 font-semibold">Active</span> : <span className="text-red-500 font-semibold">Inactive</span>}
              editing={editing} fieldKey="isActive" editValue={getVal("isActive")} onChange={setField} inputType="toggle" />
            <FieldRow label="Linked Training Code" value={code.linkedTrainingCode ?? ""}
              editing={editing} fieldKey="linkedTrainingCode" editValue={getVal("linkedTrainingCode") ?? ""} onChange={(k, v) => setField(k, v === "" ? null : v)} />
          </div>
        )}

        {/* Danger Zone */}
        {!editing && (
          <div className="rounded-2xl p-5 border border-red-200 dark:border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 size={14} className="text-red-500" strokeWidth={1.8} />
              <span className="text-[12px] font-bold uppercase tracking-wider text-red-500">Danger Zone</span>
            </div>
            <p className="text-[13px] text-hz-text-secondary mb-3">
              Deleting an expiry code removes it permanently. If crew members have active records for this code, consider deactivating instead.
            </p>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-red-500 font-medium">Are you sure? This cannot be undone.</span>
                <button onClick={handleConfirmDelete} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50">
                  {saving ? "Deleting..." : "Yes, Delete"}
                </button>
                <button onClick={handleDeactivate} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50">
                  Deactivate Instead
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-red-500 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                Delete Expiry Code
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Shared Helpers ─── */

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1 h-5 rounded-full" style={{ backgroundColor: ACCENT }} />
      <span className="text-hz-text-secondary">{icon}</span>
      <span className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary">{label}</span>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text", mono, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean; maxLength?: number;
}) {
  return (
    <div className="py-2.5 border-b border-hz-border/50">
      <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">{label}</label>
      <input type={type} value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-[13px] ${mono ? "font-bold font-mono uppercase" : "font-medium"} bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text`} />
    </div>
  );
}

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
