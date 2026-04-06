"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, setApiBaseUrl, type DelayCodeRef } from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { useTheme } from "@/components/theme-provider";
import { accentTint } from "@skyhub/ui/theme";
import { FieldRow } from "../airports/field-row";
import {
  Search, Plus, Pencil, Save, X, Trash2, ChevronRight, Link, HelpCircle,
} from "lucide-react";

setApiBaseUrl("http://localhost:3002");

// ── Category config ──
const CATEGORY_COLORS: Record<string, string> = {
  "Airline Internal": "#6b7280",
  "Passenger & Baggage": "#3b82f6",
  "Cargo & Mail": "#10b981",
  "Aircraft Handling": "#f59e0b",
  "Technical": "#ef4444",
  "Damage & EDP": "#e11d48",
  "Operations & Crew": "#8b5cf6",
  "Weather": "#0ea5e9",
  "ATC & Airport": "#6366f1",
  "Reactionary & Misc": "#a855f7",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_COLORS);

export function DelayCodesShell() {
  const [codes, setCodes] = useState<DelayCodeRef[]>([]);
  const [selected, setSelected] = useState<DelayCodeRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.getDelayCodes()
      .then((data) => {
        setCodes(data);
        setSelected((prev: DelayCodeRef | null) => {
          if (prev) { const f = data.find(d => d._id === prev._id); if (f) return f; }
          return data.length > 0 ? data[0] : null;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = useCallback(async (id: string, data: Partial<DelayCodeRef>) => {
    await api.updateDelayCode(id, data);
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteDelayCode(id);
    setSelected(null);
    fetchData();
  }, [fetchData]);

  const handleCreate = useCallback(async (data: Partial<DelayCodeRef>) => {
    const created = await api.createDelayCode(data);
    fetchData();
    setTimeout(() => setSelected(created), 300);
  }, [fetchData]);

  // Group by category
  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? codes.filter(c =>
          c.code.toLowerCase().includes(q) ||
          (c.alphaCode?.toLowerCase().includes(q) ?? false) ||
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
        )
      : codes;

    const map = new Map<string, DelayCodeRef[]>();
    for (const c of filtered) {
      const arr = map.get(c.category);
      if (arr) arr.push(c);
      else map.set(c.category, [c]);
    }
    const groups = Array.from(map.entries()).sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return { filtered, groups };
  }, [codes, search]);

  return (
    <MasterDetailLayout
      left={
        <DelayCodeList
          groups={groups}
          selected={selected}
          onSelect={(c) => { setSelected(c); setShowHelp(false); }}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onCreateClick={() => { setSelected(null); setShowHelp(false); }}
          onHelpClick={() => { setShowHelp(true); setSelected(null); }}
        />
      }
      center={
        showHelp ? (
          <AHM732HelpPanel onClose={() => { setShowHelp(false); if (codes.length > 0) setSelected(codes[0]); }} />
        ) : selected ? (
          <DelayCodeDetail
            delayCode={selected}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        ) : (
          <DelayCodeDetail
            delayCode={null}
            onCreate={handleCreate}
            onCancelCreate={() => { if (codes.length > 0) setSelected(codes[0]); }}
          />
        )
      }
    />
  );
}

// ── List ──

function DelayCodeList({ groups, selected, onSelect, search, onSearchChange, loading, onCreateClick, onHelpClick }: {
  groups: [string, DelayCodeRef[]][];
  selected: DelayCodeRef | null;
  onSelect: (c: DelayCodeRef) => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
  onCreateClick: () => void;
  onHelpClick: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"legacy" | "ahm732">("legacy");
  const toggle = (cat: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Delay Codes</h2>
          <button onClick={onCreateClick}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold text-white transition-colors bg-module-accent">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        {/* AHM toggle */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-1 rounded-lg border border-hz-border overflow-hidden">
            <button onClick={() => setViewMode("legacy")}
              className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${viewMode === "legacy" ? "text-white bg-module-accent" : "text-hz-text-secondary hover:text-hz-text"}`}>
              AHM 730/731
            </button>
            <button onClick={() => setViewMode("ahm732")}
              className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${viewMode === "ahm732" ? "text-white bg-module-accent" : "text-hz-text-secondary hover:text-hz-text"}`}>
              AHM 732
            </button>
          </div>
          <button onClick={onHelpClick}
            className="p-1 rounded-lg text-hz-text-secondary/50 hover:text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
            title="What is AHM 732?">
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input type="text" placeholder="Search code, name..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No delay codes found</div>
        ) : (
          groups.map(([category, items]) => {
            const catColor = CATEGORY_COLORS[category] || "#6b7280";
            return (
              <div key={category}>
                <button onClick={() => toggle(category)}
                  className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors">
                  <ChevronRight className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${!collapsed.has(category) ? "rotate-90" : ""}`} />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-hz-text-secondary/70">{category}</span>
                  <span className="text-[11px] text-hz-text-secondary/40">({items.length})</span>
                  <div className="flex-1 h-px bg-hz-border/50 ml-1" />
                </button>
                {!collapsed.has(category) && (
                  <div className="space-y-0.5">
                    {items.map(c => {
                      const isSel = selected?._id === c._id;
                      const ahm732 = c.ahm732Process && c.ahm732Reason && c.ahm732Stakeholder
                        ? `${c.ahm732Process}-${c.ahm732Reason}-${c.ahm732Stakeholder}` : null;
                      return (
                        <button key={c._id} onClick={() => onSelect(c)}
                          className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 ${
                            isSel ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]" : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                          }`}>
                          {viewMode === "legacy" ? (
                            <>
                              <span className="text-[14px] font-bold font-mono w-6">{c.code}</span>
                              {c.alphaCode && (
                                <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: catColor + "18", color: catColor }}>{c.alphaCode}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-[12px] font-bold font-mono px-1.5 py-0.5 rounded tracking-wider bg-module-accent/10 text-module-accent">
                              {ahm732 || "—"}
                            </span>
                          )}
                          <span className="text-[13px] font-medium truncate flex-1">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Detail ──

function DelayCodeDetail({ delayCode, onSave, onDelete, onCreate, onCancelCreate }: {
  delayCode: DelayCodeRef | null;
  onSave?: (id: string, data: Partial<DelayCodeRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: (data: Partial<DelayCodeRef>) => Promise<void>;
  onCancelCreate?: () => void;
}) {
  const { theme, moduleTheme } = useTheme();
  const isDark = theme === "dark";
  const accent = moduleTheme?.accent || "#1e40af";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Partial<DelayCodeRef>>({});
  const [errorMsg, setErrorMsg] = useState("");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({ code: "", alphaCode: "", name: "", category: "Airline Internal", description: "", color: "#6b7280" });

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || "Failed";
    try { const m = msg.match(/API (\d+): (.+)/); if (m) { const p = JSON.parse(m[2]); return p.error || p.details?.join(", ") || msg; } } catch {}
    return msg;
  }, []);

  const handleCreate = useCallback(async () => {
    if (!onCreate) return;
    if (!createForm.code || !createForm.name) { setCreateError("Code and name are required"); return; }
    setCreating(true); setCreateError("");
    try {
      await onCreate({
        operatorId: "horizon", code: createForm.code, alphaCode: createForm.alphaCode || null,
        name: createForm.name, category: createForm.category, description: createForm.description || null,
        color: createForm.color || null, isActive: true, isIataStandard: false,
      } as Partial<DelayCodeRef>);
      setCreateForm({ code: "", alphaCode: "", name: "", category: "Airline Internal", description: "", color: "#6b7280" });
    } catch (err: any) { setCreateError(friendlyError(err)); }
    finally { setCreating(false); }
  }, [onCreate, createForm, friendlyError]);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave || !delayCode || Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true); setErrorMsg("");
    try { await onSave(delayCode._id, draft); setEditing(false); setDraft({}); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [onSave, delayCode, draft, friendlyError]);

  const handleDelete = useCallback(async () => {
    if (!onDelete || !delayCode) return;
    setSaving(true); setErrorMsg("");
    try { await onDelete(delayCode._id); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); setConfirmDelete(false); }
  }, [onDelete, delayCode, friendlyError]);

  const getVal = (key: keyof DelayCodeRef) =>
    delayCode ? (key in draft ? (draft as any)[key] : delayCode[key]) : null;

  // ── Create ──
  if (!delayCode) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-hz-border shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-semibold">Add Delay Code</h1>
            {onCancelCreate && <button onClick={onCancelCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">Cancel</button>}
          </div>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="flex gap-3">
            <MiniInput label="Code *" value={createForm.code} maxLength={3} onChange={(v) => setCreateForm(p => ({ ...p, code: v }))} mono />
            <MiniInput label="Alpha Sub-Code" value={createForm.alphaCode} maxLength={2} onChange={(v) => setCreateForm(p => ({ ...p, alphaCode: v.toUpperCase() }))} mono />
            <MiniInput label="Name *" value={createForm.name} onChange={(v) => setCreateForm(p => ({ ...p, name: v }))} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Category</label>
              <select value={createForm.category} onChange={(e) => setCreateForm(p => ({ ...p, category: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text">
                {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Color</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={createForm.color} onChange={(e) => setCreateForm(p => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-hz-border cursor-pointer" />
                <input type="text" value={createForm.color} onChange={(e) => setCreateForm(p => ({ ...p, color: e.target.value }))}
                  className="flex-1 px-3 py-2.5 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none text-hz-text" maxLength={7} />
              </div>
            </div>
          </div>
          <MiniInput label="Description" value={createForm.description} onChange={(v) => setCreateForm(p => ({ ...p, description: v }))} />
          <div className="flex gap-3 pt-2">
            {onCancelCreate && <button onClick={onCancelCreate} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">Cancel</button>}
            <button onClick={handleCreate} disabled={creating} className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent">
              {creating ? "Creating..." : "Add Delay Code"}
            </button>
          </div>
          {createError && <p className="text-[13px]" style={{ color: "#E63535" }}>{createError}</p>}
        </div>
      </div>
    );
  }

  // ── Detail ──
  const catColor = CATEGORY_COLORS[delayCode.category] || "#6b7280";
  const has732 = delayCode.ahm732Process || delayCode.ahm732Reason || delayCode.ahm732Stakeholder;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[24px] font-extrabold font-mono px-3 py-1 rounded-lg bg-hz-border/30">{delayCode.code}</span>
            {delayCode.alphaCode && (
              <span className="text-[14px] font-bold font-mono px-2.5 py-1 rounded-lg" style={{ backgroundColor: catColor + "18", color: catColor }}>{delayCode.alphaCode}</span>
            )}
            <h1 className="text-[20px] font-semibold">{delayCode.name}</h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: catColor + "18", color: catColor }}>{delayCode.category}</span>
            {delayCode.isActive ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(6,194,112,0.12)] text-[#06C270] dark:bg-[rgba(57,217,138,0.15)] dark:text-[#39D98A]">Active</span>
            ) : (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(255,59,59,0.12)] text-[#E63535] dark:bg-[rgba(255,92,92,0.15)] dark:text-[#FF5C5C]">Inactive</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={handleCancel} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30"><X className="h-3.5 w-3.5" /> Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-module-accent"><Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}</button>
              </>
            ) : (
              <>
                {onDelete && (confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium" style={{ color: "#E63535" }}>Delete?</span>
                    <button onClick={handleDelete} disabled={saving} className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white" style={{ backgroundColor: "#E63535" }}>Yes</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
                ))}
                {onSave && <button onClick={handleEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30"><Pencil className="h-3.5 w-3.5" /> Edit</button>}
              </>
            )}
          </div>
        </div>
        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="text-[13px] text-red-700 dark:text-red-400">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 shrink-0 ml-auto"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-4 pb-6">
          {/* AHM 732 Card */}
          <div className="rounded-2xl p-5 mb-6"
            style={{
              background: isDark ? accentTint(accent, 0.06) : accentTint(accent, 0.05),
              border: `1px solid ${accentTint(accent, isDark ? 0.15 : 0.2)}`,
            }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isDark ? "#e0e0e0" : accent }} />
              <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: isDark ? "#e0e0e0" : accent }}>AHM 732 Equivalent</span>
            </div>
            {has732 ? (
              <>
                <div className="flex gap-3 items-stretch">
                  <TripleBox label="Process" letter={delayCode.ahm732Process} desc="" editing={editing} fieldKey="ahm732Process" onChange={handleFieldChange} getVal={getVal} isDark={isDark} accent={accent} />
                  <div className="flex items-center text-lg font-light" style={{ color: accentTint(accent, isDark ? 0.5 : 0.3) }}>–</div>
                  <TripleBox label="Reason" letter={delayCode.ahm732Reason} desc="" editing={editing} fieldKey="ahm732Reason" onChange={handleFieldChange} getVal={getVal} isDark={isDark} accent={accent} />
                  <div className="flex items-center text-lg font-light" style={{ color: accentTint(accent, isDark ? 0.5 : 0.3) }}>–</div>
                  <TripleBox label="Stakeholder" letter={delayCode.ahm732Stakeholder} desc="" editing={editing} fieldKey="ahm732Stakeholder" onChange={handleFieldChange} getVal={getVal} isDark={isDark} accent={accent} />
                </div>
                <div className="text-center mt-4 pt-4" style={{ borderTop: `1px solid ${accentTint(accent, isDark ? 0.15 : 0.2)}` }}>
                  <span className="text-[20px] font-extrabold font-mono tracking-[4px]" style={{ color: isDark ? "#f0f0f0" : accent }}>
                    {getVal("ahm732Process") || "?"} – {getVal("ahm732Reason") || "?"} – {getVal("ahm732Stakeholder") || "?"}
                  </span>
                  <div className="text-[11px] text-hz-text-tertiary mt-1">AHM 732 Triple-A Code</div>
                </div>
              </>
            ) : editing ? (
              <div className="flex gap-3 items-stretch">
                <TripleBox label="Process" letter={null} desc="" editing={true} fieldKey="ahm732Process" onChange={handleFieldChange} getVal={getVal} isDark={isDark} accent={accent} />
                <div className="flex items-center text-lg font-light" style={{ color: accentTint(accent, isDark ? 0.5 : 0.3) }}>–</div>
                <TripleBox label="Reason" letter={null} desc="" editing={true} fieldKey="ahm732Reason" onChange={handleFieldChange} getVal={getVal} isDark={isDark} accent={accent} />
                <div className="flex items-center text-lg font-light" style={{ color: accentTint(accent, isDark ? 0.5 : 0.3) }}>–</div>
                <TripleBox label="Stakeholder" letter={null} desc="" editing={true} fieldKey="ahm732Stakeholder" onChange={handleFieldChange} getVal={getVal} isDark={isDark} accent={accent} />
              </div>
            ) : (
              <div className="text-[13px] text-hz-text-secondary py-2">
                No AHM 732 mapping yet — click Edit to add Process, Reason, and Stakeholder codes.
              </div>
            )}
          </div>

          {/* Legacy fields */}
          <div className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary mb-3">Legacy Code (AHM 730/731)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
            <FieldRow label="Numeric Code" value={<span className="font-bold font-mono">{delayCode.code}</span>}
              editing={editing} fieldKey="code" editValue={getVal("code")} onChange={handleFieldChange} />
            <FieldRow label="Alpha Sub-Code" value={delayCode.alphaCode ? <span className="font-bold font-mono">{delayCode.alphaCode}</span> : null}
              editing={editing} fieldKey="alphaCode" editValue={getVal("alphaCode")} onChange={handleFieldChange} />
            <FieldRow label="Name" value={delayCode.name}
              editing={editing} fieldKey="name" editValue={getVal("name")} onChange={handleFieldChange} />
            {/* Category */}
            <div className="py-2.5 border-b border-hz-border/50">
              <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">Category</div>
              {editing ? (
                <select value={getVal("category") || ""} onChange={(e) => handleFieldChange("category", e.target.value)}
                  className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
                  {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: catColor }} />
                  <span className="text-[13px] font-medium">{delayCode.category}</span>
                </div>
              )}
            </div>
            {/* Color */}
            <div className="py-2.5 border-b border-hz-border/50">
              <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">Color</div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <input type="color" value={getVal("color") || "#6b7280"} onChange={(e) => handleFieldChange("color", e.target.value)}
                    className="w-8 h-8 rounded border border-hz-border cursor-pointer" />
                  <input type="text" value={getVal("color") || ""} onChange={(e) => handleFieldChange("color", e.target.value)}
                    className="flex-1 text-[13px] font-mono bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" maxLength={7} />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border border-hz-border/50" style={{ backgroundColor: delayCode.color || "#6b7280" }} />
                  <span className="text-[13px] font-mono font-medium">{delayCode.color || "—"}</span>
                </div>
              )}
            </div>
            <FieldRow label="Active"
              value={delayCode.isActive ? <span className="font-semibold" style={{ color: "#06C270" }}>Active</span> : <span className="font-semibold" style={{ color: "#E63535" }}>Inactive</span>}
              editing={editing} fieldKey="isActive" editValue={getVal("isActive")} onChange={handleFieldChange} inputType="toggle" />
          </div>

          {/* Description */}
          <div className="mt-4">
            <FieldRow label="Description" value={delayCode.description}
              editing={editing} fieldKey="description" editValue={getVal("description")} onChange={handleFieldChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Triple-A box ──
function TripleBox({ label, letter, desc, editing, fieldKey, onChange, getVal, isDark, accent }: {
  label: string; letter: string | null; desc: string;
  editing: boolean; fieldKey: string;
  onChange: (key: string, value: string | number | boolean | null) => void;
  getVal: (key: keyof DelayCodeRef) => any;
  isDark: boolean;
  accent: string;
}) {
  const val = getVal(fieldKey as keyof DelayCodeRef);
  return (
    <div className="flex-1 rounded-xl p-4 text-center transition-all duration-200 hover:scale-[1.01] cursor-default"
      style={{
        background: isDark ? accentTint(accent, 0.08) : accentTint(accent, 0.04),
        border: `1px solid ${accentTint(accent, isDark ? 0.15 : 0.15)}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 10px ${accentTint(accent, isDark ? 0.25 : 0.2)}`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
      <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: isDark ? "#e0e0e0" : accent }}>{label}</div>
      {editing ? (
        <input type="text" value={val || ""} maxLength={1}
          onChange={(e) => onChange(fieldKey, e.target.value.toUpperCase() || null)}
          className="w-full text-center text-[28px] font-extrabold font-mono bg-transparent outline-none py-1"
          style={{
            color: isDark ? "#f0f0f0" : accent,
            borderBottom: `2px solid ${isDark ? "rgba(255,255,255,0.2)" : accentTint(accent, 0.3)}`,
          }}
          placeholder="?" />
      ) : (
        <div className="text-[28px] font-extrabold font-mono" style={{ color: isDark ? "#f0f0f0" : accent }}>
          {letter || "—"}
        </div>
      )}
    </div>
  );
}

// ── Mini input ──
// ── AHM 732 Help Panel (right panel) ──
function AHM732HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-module-accent" />
            <h1 className="text-[20px] font-semibold">Delay Code Standards</h1>
          </div>
          <button onClick={onClose} className="text-[13px] text-hz-text-secondary hover:text-hz-text transition-colors">Close</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Overview */}
        <div className="space-y-3 text-[13px] text-hz-text-secondary leading-relaxed">
          <div>
            <span className="font-bold text-hz-text text-[14px]">AHM 730/731 (Legacy)</span>
            <p className="mt-1">The current IATA standard using 2-digit numeric codes (00–99) organized into 10 categories, with optional 2-letter alpha sub-codes. Used by the majority of airlines worldwide.</p>
          </div>
          <div>
            <span className="font-bold text-hz-text text-[14px]">AHM 732 (Triple-A Framework)</span>
            <p className="mt-1">The new IATA standard introduced in the 42nd edition of AHM. Replaces numeric codes with 3-letter combinations that provide richer context about each delay:</p>
          </div>
        </div>

        {/* Triple-A explanation */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-4 text-center bg-module-accent/10 border border-module-accent/20">
            <div className="text-[11px] font-bold uppercase tracking-wider text-module-accent mb-1">Process</div>
            <div className="text-[24px] font-extrabold font-mono text-module-accent">P</div>
            <div className="text-[11px] text-hz-text-secondary mt-1">Which part of the turn</div>
          </div>
          <div className="rounded-xl p-4 text-center bg-module-accent/10 border border-module-accent/20">
            <div className="text-[11px] font-bold uppercase tracking-wider text-module-accent mb-1">Reason</div>
            <div className="text-[24px] font-extrabold font-mono text-module-accent">R</div>
            <div className="text-[11px] text-hz-text-secondary mt-1">The specific cause</div>
          </div>
          <div className="rounded-xl p-4 text-center bg-module-accent/10 border border-module-accent/20">
            <div className="text-[11px] font-bold uppercase tracking-wider text-module-accent mb-1">Stakeholder</div>
            <div className="text-[24px] font-extrabold font-mono text-module-accent">S</div>
            <div className="text-[11px] text-hz-text-secondary mt-1">Who was responsible</div>
          </div>
        </div>

        {/* Code legends */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-hz-border/50 p-4">
            <div className="text-[12px] font-bold text-hz-text mb-3 uppercase tracking-wider">Process Codes</div>
            <div className="space-y-1.5 text-[12px]">
              {[
                ["A","Arrival"],["B","Boarding"],["C","Cargo"],["D","Departure"],
                ["F","Fuelling"],["G","Ground Handling"],["L","Loading"],["M","Maintenance"],
                ["N","Navigation"],["P","Passenger"],["S","Security"],["T","Turnaround"],
              ].map(([k,v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-module-accent/15 text-module-accent text-[11px] font-bold flex items-center justify-center shrink-0 font-mono">{k}</span>
                  <span className="text-hz-text-secondary">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-hz-border/50 p-4">
            <div className="text-[12px] font-bold text-hz-text mb-3 uppercase tracking-wider">Reason Codes</div>
            <div className="space-y-1.5 text-[12px]">
              {[
                ["A","Absence"],["B","Breakdown"],["C","Congestion"],["D","Defect"],
                ["E","Error"],["F","Late Delivery"],["G","Government"],["I","Industrial"],
                ["K","Configuration"],["L","Late"],["M","Missing"],["N","Not Available"],
                ["O","Oversale"],["P","Planning"],["R","Restriction"],["S","Special"],
                ["T","Technical"],["U","Unscheduled"],["W","Weather"],
              ].map(([k,v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-module-accent/15 text-module-accent text-[11px] font-bold flex items-center justify-center shrink-0 font-mono">{k}</span>
                  <span className="text-hz-text-secondary">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-hz-border/50 p-4">
            <div className="text-[12px] font-bold text-hz-text mb-3 uppercase tracking-wider">Stakeholder Codes</div>
            <div className="space-y-1.5 text-[12px]">
              {[
                ["A","Airline"],["C","Crew"],["G","Ground Handler"],["H","Airport/Authority"],
                ["M","Maintenance"],["N","Service Provider"],["P","Passenger"],["S","Security"],
                ["W","Weather"],["X","External"],
              ].map(([k,v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-module-accent/15 text-module-accent text-[11px] font-bold flex items-center justify-center shrink-0 font-mono">{k}</span>
                  <span className="text-hz-text-secondary">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Example */}
        <div className="rounded-xl border border-hz-border/50 p-4">
          <div className="text-[12px] font-bold text-hz-text mb-2 uppercase tracking-wider">Example</div>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="text-[18px] font-extrabold font-mono text-module-accent tracking-[3px]">M – D – A</span>
            <span className="text-hz-text-secondary">= Maintenance process, Defect found, Airline responsible</span>
          </div>
          <div className="text-[12px] text-hz-text-secondary mt-1">Legacy equivalent: <span className="font-mono font-bold">41</span> <span className="font-mono font-bold text-module-accent">TD</span> (Aircraft Defects)</div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl bg-hz-border/10 border border-hz-border/30 p-4">
          <div className="text-[12px] font-bold text-hz-text mb-2">Migration Timeline</div>
          <div className="space-y-2 text-[12px] text-hz-text-secondary">
            <div className="flex gap-3"><span className="font-mono font-bold text-hz-text shrink-0">42nd ed.</span> AHM 732 introduced — coexists with legacy 730/731</div>
            <div className="flex gap-3"><span className="font-mono font-bold text-hz-text shrink-0">43rd ed.</span> Last edition containing AHM 730/731</div>
            <div className="flex gap-3"><span className="font-mono font-bold text-hz-text shrink-0">44th ed.</span> AHM 732 becomes the sole standard (~2027)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniInput({ label, value, onChange, maxLength, mono, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  maxLength?: number; mono?: boolean; type?: string;
}) {
  return (
    <div className="flex-1">
      <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength}
        className={`w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text ${mono ? "font-mono" : ""}`} />
    </div>
  );
}
