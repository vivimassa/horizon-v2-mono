"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, setApiBaseUrl, type CarrierCodeRef } from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { FieldRow } from "../airports/field-row";
import { getOperatorId } from "@/stores/use-operator-store";
import {
  Search, Plus, Pencil, Save, X, Trash2, Building2,
  Info, Phone, Settings2, Clock,
} from "lucide-react";

setApiBaseUrl("http://localhost:3002");

const CATEGORY_OPTIONS = ["Air", "Ground", "Other"] as const;

const TABS = [
  { key: "basic" as const, label: "Basic", icon: Info },
  { key: "contact" as const, label: "Contact", icon: Phone },
  { key: "times" as const, label: "Report & Debrief", icon: Clock },
  { key: "additional" as const, label: "Additional Info", icon: Settings2 },
];

type TabKey = (typeof TABS)[number]["key"];

// ── Time helpers ──

function minutesToHHMM(minutes: number | null | undefined): string {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hhmmToMinutes(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [hStr, mStr] = trimmed.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  const num = trimmed.replace(/\D/g, "");
  if (!num) return null;
  if (num.length >= 3) {
    const mins = parseInt(num.slice(-2), 10);
    const hrs = parseInt(num.slice(0, -2), 10);
    return hrs * 60 + mins;
  }
  return (parseInt(num, 10) || 0) * 60;
}

// ── Logo URL builder (uses public airline logo APIs) ──

function getAirlineLogoUrl(iataCode: string): string {
  // Tries pics.avs.io which has good coverage of airline logos
  return `https://pics.avs.io/200/80/${iataCode}.png`;
}

function getAirlineHeroUrl(iataCode: string): string {
  // Use a larger variant for the hero background
  return `https://pics.avs.io/800/200/${iataCode}@2x.png`;
}

export function CarrierCodesShell() {
  const [carriers, setCarriers] = useState<CarrierCodeRef[]>([]);
  const [selected, setSelected] = useState<CarrierCodeRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.getCarrierCodes()
      .then((data) => {
        setCarriers(data);
        setSelected((prev: CarrierCodeRef | null) => {
          if (prev) {
            const found = data.find((c) => c._id === prev._id);
            if (found) return found;
          }
          return data.length > 0 ? data[0] : null;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = useCallback(async (id: string, data: Partial<CarrierCodeRef>) => {
    await api.updateCarrierCode(id, data);
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteCarrierCode(id);
    setSelected(null);
    fetchData();
  }, [fetchData]);

  const handleCreate = useCallback(async (data: Partial<CarrierCodeRef>) => {
    const created = await api.createCarrierCode(data);
    fetchData();
    setTimeout(() => setSelected(created), 300);
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return carriers;
    return carriers.filter(c =>
      c.iataCode.toLowerCase().includes(q) ||
      (c.icaoCode?.toLowerCase().includes(q) ?? false) ||
      c.name.toLowerCase().includes(q)
    );
  }, [carriers, search]);

  return (
    <MasterDetailLayout
      left={
        <CarrierList
          carriers={filtered}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onCreateClick={() => setSelected(null)}
        />
      }
      center={
        <CarrierDetail
          carrier={selected}
          onSave={handleSave}
          onDelete={handleDelete}
          onCreate={handleCreate}
          onCancelCreate={() => { if (carriers.length > 0) setSelected(carriers[0]); }}
        />
      }
    />
  );
}

// ── List ──

function CarrierList({ carriers, selected, onSelect, search, onSearchChange, loading, onCreateClick }: {
  carriers: CarrierCodeRef[];
  selected: CarrierCodeRef | null;
  onSelect: (c: CarrierCodeRef) => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Carrier Codes</h2>
          <button onClick={onCreateClick}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold text-white transition-colors bg-module-accent">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input type="text" placeholder="Search code or name..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : carriers.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No carrier codes found</div>
        ) : (
          <div className="space-y-0.5">
            {carriers.map((c) => {
              const isSelected = selected?._id === c._id;
              return (
                <button key={c._id} onClick={() => onSelect(c)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                      : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                  }`}>
                  {/* Airline logo thumbnail */}
                  <div className="w-8 h-5 rounded overflow-hidden bg-hz-border/20 flex items-center justify-center shrink-0">
                    <img
                      src={getAirlineLogoUrl(c.iataCode)}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <span className="text-[14px] font-bold font-mono">{c.iataCode}</span>
                  {c.icaoCode && <span className="text-[12px] font-mono text-hz-text-tertiary">{c.icaoCode}</span>}
                  <span className="text-[13px] font-medium truncate">{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail ──

function CarrierDetail({ carrier, onSave, onDelete, onCreate, onCancelCreate }: {
  carrier: CarrierCodeRef | null;
  onSave?: (id: string, data: Partial<CarrierCodeRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: (data: Partial<CarrierCodeRef>) => Promise<void>;
  onCancelCreate?: () => void;
}) {
  const isCreateMode = !carrier;
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [editing, setEditing] = useState(isCreateMode);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(isCreateMode ? { iataCode: "", icaoCode: "", name: "", category: "Air", isActive: true } : {});
  const [errorMsg, setErrorMsg] = useState("");

  // Reset state when switching between create/edit
  useEffect(() => {
    if (isCreateMode) {
      setEditing(true);
      setDraft({ iataCode: "", icaoCode: "", name: "", category: "Air", isActive: true });
      setActiveTab("basic");
    } else {
      setEditing(false);
      setDraft({});
    }
  }, [isCreateMode, carrier?._id]);

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || "Failed";
    try {
      const match = msg.match(/API (\d+): (.+)/);
      if (match) {
        const parsed = JSON.parse(match[2]);
        if (Number(match[1]) === 409) return parsed.error || "This carrier code already exists.";
        return parsed.error || parsed.details?.join(", ") || msg;
      }
    } catch {}
    return msg;
  }, []);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => {
    if (isCreateMode && onCancelCreate) { onCancelCreate(); return; }
    setDraft({}); setEditing(false);
  }, [isCreateMode, onCancelCreate]);
  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleNestedChange = useCallback((path: string, value: string | number | boolean | null) => {
    const [parent, child] = path.split(".");
    setDraft((prev) => {
      const existing = (prev[parent] as Record<string, unknown>) || {};
      return { ...prev, [parent]: { ...existing, [child]: value } };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (isCreateMode) {
      // Create mode
      if (!onCreate) return;
      const d = draft as Record<string, any>;
      if (!d.iataCode || !d.name) { setErrorMsg("IATA code and name are required"); return; }
      setSaving(true); setErrorMsg("");
      try {
        const payload: Record<string, any> = { operatorId: getOperatorId() };
        for (const [k, v] of Object.entries(d)) {
          payload[k] = (v === "" || v === undefined) ? null : v;
        }
        if (payload.iataCode) payload.iataCode = (payload.iataCode as string).toUpperCase();
        if (payload.icaoCode) payload.icaoCode = (payload.icaoCode as string).toUpperCase();
        await onCreate(payload as Partial<CarrierCodeRef>);
      } catch (err: any) { setErrorMsg(friendlyError(err)); }
      finally { setSaving(false); }
      return;
    }
    // Edit mode
    if (!onSave || !carrier || Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true); setErrorMsg("");
    try { await onSave(carrier._id, draft as Partial<CarrierCodeRef>); setEditing(false); setDraft({}); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [isCreateMode, onCreate, onSave, carrier, draft, friendlyError]);

  const handleDelete = useCallback(async () => {
    if (!onDelete || !carrier) return;
    setSaving(true); setErrorMsg("");
    try { await onDelete(carrier._id); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); setConfirmDelete(false); }
  }, [onDelete, carrier, friendlyError]);

  const getVal = (key: keyof CarrierCodeRef) => {
    if (key in draft) return (draft as any)[key];
    return carrier ? carrier[key] : null;
  };

  const getNestedVal = (parent: keyof CarrierCodeRef, child: string) => {
    const draftParent = draft[parent] as Record<string, unknown> | undefined;
    if (draftParent && child in draftParent) return draftParent[child] as any;
    if (!carrier) return null;
    const orig = carrier[parent] as Record<string, unknown> | null;
    return orig?.[child] ?? null;
  };

  // Display values — from carrier or draft
  const displayIata = (getVal("iataCode") as string) || "";
  const displayIcao = (getVal("icaoCode") as string) || "";
  const displayName = (getVal("name") as string) || "";
  const displayCategory = (getVal("category") as string) || "Air";
  const [logoFailed, setLogoFailed] = useState(false);

  // Reset logo state when switching carriers
  useEffect(() => { setLogoFailed(false); }, [displayIata]);

  const accent = "var(--module-accent, #1e40af)";

  // ── Unified view (create + detail) ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero banner with airline branding */}
      <div
        className="relative shrink-0 h-[160px] overflow-hidden border-b border-hz-border"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 5%, transparent) 0%, transparent 60%)`,
        }}
      >
        <div className="absolute inset-0 flex items-center px-8 gap-8">
          {/* Airline logo in a clean card */}
          <div
            className="w-[140px] h-[90px] rounded-xl border border-hz-border/40 flex items-center justify-center shrink-0 overflow-hidden shadow-sm"
            style={{ background: `linear-gradient(145deg, white, color-mix(in srgb, ${accent} 6%, white))` }}
          >
            {displayIata && !logoFailed ? (
              <img
                src={getAirlineLogoUrl(displayIata)}
                alt={displayIata}
                className="w-[120px] h-[70px] object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <img
                src="/skyhub-logo.png"
                alt="SkyHub"
                className="w-[100px] h-[50px] object-contain opacity-40"
              />
            )}
          </div>
          {/* Thin vertical divider */}
          <div className="w-px h-16 shrink-0" style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }} />
          {/* Title info */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-3">
              {displayName ? (
                <span className="text-[24px] font-bold text-hz-text leading-tight">{displayName}</span>
              ) : (
                <span className="text-[24px] font-bold text-hz-text-tertiary leading-tight">New Carrier</span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {displayIata && (
                <span className="text-[13px] font-bold font-mono px-2 py-0.5 rounded-md text-hz-text" style={{ background: `color-mix(in srgb, ${accent} 8%, transparent)` }}>
                  {displayIata}
                </span>
              )}
              {displayIcao && (
                <span className="text-[13px] font-mono text-hz-text-secondary">
                  {displayIcao}
                </span>
              )}
              <span className="text-hz-border">|</span>
              {displayCategory && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">
                  {displayCategory}
                </span>
              )}
              {!isCreateMode && (carrier?.isActive ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(6,194,112,0.12)] text-[#06C270] dark:bg-[rgba(57,217,138,0.15)] dark:text-[#39D98A]">Active</span>
              ) : (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(255,59,59,0.12)] text-[#E63535] dark:bg-[rgba(255,92,92,0.15)] dark:text-[#FF5C5C]">Inactive</span>
              ))}
              {carrier?.defaultCurrency && (
                <span className="text-[11px] font-mono text-hz-text-tertiary">{carrier.defaultCurrency}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Header bar — Edit/Delete/Create controls */}
      <div className="px-6 py-2.5 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-end">
          {editing ? (
            <div className="flex items-center gap-2">
              <button onClick={handleCancel} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors bg-module-accent">
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : isCreateMode ? "Create Carrier" : "Save"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onDelete && carrier && (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium" style={{ color: "#E63535" }}>Delete?</span>
                    <button onClick={handleDelete} disabled={saving} className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white transition-colors" style={{ backgroundColor: "#E63535" }}>Yes</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )
              )}
              {onSave && carrier && (
                <button onClick={handleEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>
          )}
        </div>
        {errorMsg && (
          <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="text-[13px] text-red-700 dark:text-red-400">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 shrink-0 ml-auto"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-hz-border shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150 shrink-0 ${
                active ? "bg-module-accent/15 text-module-accent" : "text-hz-text-secondary hover:bg-hz-border/30 hover:text-hz-text"
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-3 pb-6">
          {activeTab === "basic" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow label="IATA Code" value={displayIata ? <span className="font-bold font-mono">{displayIata}</span> : null}
                editing={editing} fieldKey="iataCode" editValue={getVal("iataCode")} onChange={handleFieldChange} />
              <FieldRow label="ICAO Code" value={displayIcao ? <span className="font-mono">{displayIcao}</span> : null}
                editing={editing} fieldKey="icaoCode" editValue={getVal("icaoCode")} onChange={handleFieldChange} />
              <FieldRow label="Name" value={displayName || null}
                editing={editing} fieldKey="name" editValue={getVal("name")} onChange={handleFieldChange} />
              <FieldRow label="Category" value={displayCategory}
                editing={editing} fieldKey="category" editValue={getVal("category")} onChange={handleFieldChange}
                inputType="select" selectOptions={[...CATEGORY_OPTIONS]} />
              <FieldRow label="Vendor Number" value={getVal("vendorNumber") as string}
                editing={editing} fieldKey="vendorNumber" editValue={getVal("vendorNumber")} onChange={handleFieldChange} />
              <FieldRow label="Active"
                value={getVal("isActive") ? <span className="font-semibold" style={{ color: "#06C270" }}>Active</span> : <span className="font-semibold" style={{ color: "#E63535" }}>Inactive</span>}
                editing={editing} fieldKey="isActive" editValue={getVal("isActive")} onChange={handleFieldChange} inputType="toggle" />
            </div>
          )}

          {activeTab === "contact" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow label="Contact Name" value={getVal("contactName") as string}
                editing={editing} fieldKey="contactName" editValue={getVal("contactName")} onChange={handleFieldChange} />
              <FieldRow label="Position" value={getVal("contactPosition") as string}
                editing={editing} fieldKey="contactPosition" editValue={getVal("contactPosition")} onChange={handleFieldChange} />
              <FieldRow label="Phone" value={getVal("phone") as string}
                editing={editing} fieldKey="phone" editValue={getVal("phone")} onChange={handleFieldChange} />
              <FieldRow label="Email" value={getVal("email") as string}
                editing={editing} fieldKey="email" editValue={getVal("email")} onChange={handleFieldChange} />
              <FieldRow label="SITA" value={getVal("sita") ? <span className="font-mono">{getVal("sita") as string}</span> : null}
                editing={editing} fieldKey="sita" editValue={getVal("sita")} onChange={handleFieldChange} />
              <FieldRow label="Website" value={getVal("website") as string}
                editing={editing} fieldKey="website" editValue={getVal("website")} onChange={handleFieldChange} />
            </div>
          )}

          {activeTab === "times" && (
            <div className="space-y-6">
              <Section title="Report & Debrief Times">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-[13px] text-hz-text-secondary uppercase tracking-wider">
                        <th className="text-left py-2 pr-4 font-semibold w-28"></th>
                        <th className="text-center py-2 px-3 font-semibold">Report</th>
                        <th className="text-center py-2 px-3 font-semibold">Debrief</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-hz-border/50">
                        <td className="py-3 pr-4 text-[13px] font-medium text-hz-text-secondary uppercase">Cockpit</td>
                        <TimeCell
                          value={getNestedVal("cockpitTimes", "reportMinutes")}
                          editing={editing}
                          onChange={(v) => handleNestedChange("cockpitTimes.reportMinutes", v)}
                        />
                        <TimeCell
                          value={getNestedVal("cockpitTimes", "debriefMinutes")}
                          editing={editing}
                          onChange={(v) => handleNestedChange("cockpitTimes.debriefMinutes", v)}
                        />
                      </tr>
                      <tr className="border-t border-hz-border/50">
                        <td className="py-3 pr-4 text-[13px] font-medium text-hz-text-secondary uppercase">Cabin</td>
                        <TimeCell
                          value={getNestedVal("cabinTimes", "reportMinutes")}
                          editing={editing}
                          onChange={(v) => handleNestedChange("cabinTimes.reportMinutes", v)}
                        />
                        <TimeCell
                          value={getNestedVal("cabinTimes", "debriefMinutes")}
                          editing={editing}
                          onChange={(v) => handleNestedChange("cabinTimes.debriefMinutes", v)}
                        />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
              <Section title="Capacity">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <FieldRow label="Capacity (Passengers)" value={getVal("capacity") as number}
                    editing={editing} fieldKey="capacity" editValue={getVal("capacity")} onChange={handleFieldChange} inputType="number" />
                </div>
              </Section>
            </div>
          )}

          {activeTab === "additional" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow label="Default Currency" value={getVal("defaultCurrency") ? <span className="font-mono">{getVal("defaultCurrency") as string}</span> : null}
                editing={editing} fieldKey="defaultCurrency" editValue={getVal("defaultCurrency")} onChange={handleFieldChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Time cell (HH:MM display/edit for report & debrief table) ──

function TimeCell({ value, editing, onChange }: {
  value: number | null;
  editing: boolean;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(minutesToHHMM(value));

  // Sync text when value changes externally (e.g. switching carrier)
  useEffect(() => { setText(minutesToHHMM(value)); }, [value]);

  if (editing) {
    return (
      <td className="text-center py-3 px-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onChange(hhmmToMinutes(text))}
          placeholder="HH:MM"
          className="w-20 text-center text-[13px] font-mono font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text mx-auto"
        />
      </td>
    );
  }
  return (
    <td className="text-center py-3 px-3">
      <span className="text-[13px] font-mono font-medium">
        {value != null ? minutesToHHMM(value) : "—"}
      </span>
    </td>
  );
}

// ── Section wrapper ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[3px] h-4 rounded-full bg-module-accent" />
        <span className="text-[13px] font-semibold text-hz-text">{title}</span>
      </div>
      {children}
    </div>
  );
}

