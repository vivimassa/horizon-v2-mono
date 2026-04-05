"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, setApiBaseUrl, type AirportRef } from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { useTheme } from "@/components/theme-provider";
import { accentTint } from "@skyhub/ui/theme";
import { FieldRow } from "../airports/field-row";
import { AirportMap } from "../airports/airport-map";
import {
  Search, Plus, Pencil, Save, X, Trash2, ChevronRight, MapPin, Clock, Building2,
} from "lucide-react";

setApiBaseUrl("http://localhost:3002");

const ACCENT = "#7c3aed"; // Crew Ops purple

// ── Shell ──

export function CrewBasesShell() {
  const [bases, setBases] = useState<AirportRef[]>([]);
  const [selected, setSelected] = useState<AirportRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddPicker, setShowAddPicker] = useState(false);

  const fetchBases = useCallback(() => {
    setLoading(true);
    api.getAirports({ crewBase: true })
      .then((data) => {
        setBases(data);
        setSelected((prev: AirportRef | null) => {
          if (prev) { const f = data.find(a => a._id === prev._id); if (f) return f; }
          return data.length > 0 ? data[0] : null;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBases(); }, [fetchBases]);

  const handleSave = useCallback(async (id: string, data: Partial<AirportRef>) => {
    await api.updateAirport(id, data);
    fetchBases();
  }, [fetchBases]);

  const handleRemoveBase = useCallback(async (id: string) => {
    await api.updateAirport(id, { isCrewBase: false } as Partial<AirportRef>);
    setSelected(null);
    fetchBases();
  }, [fetchBases]);

  const handleAddBase = useCallback(async (airport: AirportRef) => {
    await api.updateAirport(airport._id, { isCrewBase: true } as Partial<AirportRef>);
    setShowAddPicker(false);
    fetchBases();
    setTimeout(() => {
      setBases(prev => {
        const added = prev.find(a => a._id === airport._id);
        if (added) setSelected(added);
        return prev;
      });
    }, 400);
  }, [fetchBases]);

  // Group by country
  const { groups, totalCount } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? bases.filter(a =>
          a.icaoCode.toLowerCase().includes(q) ||
          (a.iataCode?.toLowerCase().includes(q) ?? false) ||
          a.name.toLowerCase().includes(q) ||
          (a.city?.toLowerCase().includes(q) ?? false) ||
          (a.countryName?.toLowerCase().includes(q) ?? false)
        )
      : bases;

    const map = new Map<string, AirportRef[]>();
    for (const a of filtered) {
      const key = a.countryName ?? a.country ?? "Unknown";
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    const groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return { groups, totalCount: filtered.length };
  }, [bases, search]);

  const handleSelect = useCallback((airport: AirportRef) => {
    setSelected(airport);
    setShowAddPicker(false);
  }, []);

  return (
    <MasterDetailLayout
      left={
        <CrewBaseList
          groups={groups}
          totalCount={totalCount}
          selected={selected}
          onSelect={handleSelect}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onAddClick={() => { setShowAddPicker(true); setSelected(null); }}
        />
      }
      center={
        showAddPicker ? (
          <AddBasePanel
            existingBases={bases}
            onAdd={handleAddBase}
            onCancel={() => { setShowAddPicker(false); if (bases.length > 0) setSelected(bases[0]); }}
          />
        ) : selected ? (
          <CrewBaseDetail
            airport={selected}
            onSave={handleSave}
            onRemove={handleRemoveBase}
          />
        ) : !loading && bases.length === 0 ? (
          <EmptyState onAdd={() => setShowAddPicker(true)} />
        ) : null
      }
    />
  );
}

// ── Empty State ──

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentTint(ACCENT, 0.1) }}>
        <MapPin size={24} color={ACCENT} strokeWidth={1.8} />
      </div>
      <div className="text-center">
        <h2 className="text-[17px] font-semibold text-hz-text mb-1">No Crew Bases Configured</h2>
        <p className="text-[13px] text-hz-text-secondary max-w-sm">
          Crew bases define which airports serve as home bases for your crew. Add your first base to get started.
        </p>
      </div>
      <button onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90"
        style={{ backgroundColor: ACCENT }}>
        <Plus className="h-4 w-4" /> Add First Base
      </button>
    </div>
  );
}

// ── List ──

function CrewBaseList({ groups, totalCount, selected, onSelect, search, onSearchChange, loading, onAddClick }: {
  groups: [string, AirportRef[]][];
  totalCount: number;
  selected: AirportRef | null;
  onSelect: (a: AirportRef) => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
  onAddClick: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold">Crew Bases</h2>
            <span className="text-[11px] text-hz-text-secondary">{totalCount} base{totalCount !== 1 ? "s" : ""}</span>
          </div>
          <button onClick={onAddClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: ACCENT }}>
            <Plus className="h-3 w-3" /> Add Base
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input type="text" placeholder="Search IATA, ICAO, name, city..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No crew bases found</div>
        ) : (
          groups.map(([country, airports]) => (
            <div key={country}>
              <button onClick={() => toggle(country)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors">
                <ChevronRight className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${!collapsed.has(country) ? "rotate-90" : ""}`} />
                {airports[0]?.countryFlag && <span className="text-[13px]">{airports[0].countryFlag}</span>}
                <span className="text-[11px] font-bold uppercase tracking-wider text-hz-text-secondary/70">{country}</span>
                <span className="text-[10px] text-hz-text-secondary/40">({airports.length})</span>
                <div className="flex-1 h-px bg-hz-border/50 ml-1" />
              </button>
              {!collapsed.has(country) && (
                <div className="space-y-0.5">
                  {airports.map(a => {
                    const isSel = selected?._id === a._id;
                    return (
                      <button key={a._id} onClick={() => onSelect(a)}
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSel ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]" : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                        }`}>
                        <span className="text-[14px] font-bold font-mono w-10 shrink-0" style={{ color: ACCENT }}>
                          {a.iataCode || a.icaoCode}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">{a.name}</div>
                          <div className="text-[11px] text-hz-text-secondary truncate">{a.city}</div>
                        </div>
                        {a.hasCrewFacilities && (
                          <Building2 className="h-3 w-3 text-green-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Detail ──

function CrewBaseDetail({ airport, onSave, onRemove }: {
  airport: AirportRef;
  onSave: (id: string, data: Partial<AirportRef>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [draft, setDraft] = useState<Partial<AirportRef>>({});
  const [errorMsg, setErrorMsg] = useState("");

  // Reset edit state when selecting a different base
  useEffect(() => {
    setEditing(false);
    setDraft({});
    setConfirmRemove(false);
    setErrorMsg("");
  }, [airport._id]);

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || "Failed";
    try { const m = msg.match(/API (\d+): (.+)/); if (m) { const p = JSON.parse(m[2]); return p.error || p.details?.join(", ") || msg; } } catch {}
    return msg;
  }, []);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmRemove(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true); setErrorMsg("");
    try { await onSave(airport._id, draft); setEditing(false); setDraft({}); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [onSave, airport._id, draft, friendlyError]);

  const handleRemove = useCallback(async () => {
    setSaving(true); setErrorMsg("");
    try { await onRemove(airport._id); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); setConfirmRemove(false); }
  }, [onRemove, airport._id, friendlyError]);

  const getVal = (key: keyof AirportRef) =>
    key in draft ? (draft as any)[key] : airport[key];

  const utcOffset = airport.utcOffsetHours != null
    ? `UTC${airport.utcOffsetHours >= 0 ? "+" : ""}${airport.utcOffsetHours}`
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[24px] font-extrabold font-mono px-3 py-1 rounded-lg"
              style={{ backgroundColor: accentTint(ACCENT, isDark ? 0.15 : 0.1), color: ACCENT }}>
              {airport.iataCode || airport.icaoCode}
            </span>
            <span className="text-[12px] font-bold font-mono px-2 py-0.5 rounded-lg bg-hz-border/30 text-hz-text-secondary">
              {airport.icaoCode}
            </span>
            <div>
              <h1 className="text-[18px] font-semibold">{airport.name}</h1>
              <p className="text-[12px] text-hz-text-secondary">
                {[airport.city, airport.countryName].filter(Boolean).join(", ")}
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
        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="text-[13px] text-red-700 dark:text-red-400">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 shrink-0 ml-auto"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      {/* Map */}
      {airport.latitude != null && airport.longitude != null && (
        <div className="shrink-0 border-b border-hz-border" style={{ height: 250 }}>
          <AirportMap latitude={airport.latitude} longitude={airport.longitude} name={airport.name} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-4 pb-6">
          {/* Airport Info — read-only */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-5 rounded-full" style={{ backgroundColor: ACCENT }} />
              <span className="text-[12px] font-bold uppercase tracking-wider text-hz-text-secondary">Airport Information</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <FieldRow label="IATA Code" value={airport.iataCode ? <span className="font-mono font-bold">{airport.iataCode}</span> : null} />
              <FieldRow label="ICAO Code" value={<span className="font-mono font-bold">{airport.icaoCode}</span>} />
              <FieldRow label="City" value={airport.city} />
              <FieldRow label="Country" value={
                airport.countryName ? (
                  <span className="flex items-center gap-2">
                    {airport.countryFlag && <span>{airport.countryFlag}</span>}
                    {airport.countryName}
                  </span>
                ) : null
              } />
              <FieldRow label="Timezone" value={airport.timezone} />
              <FieldRow label="UTC Offset" value={utcOffset} />
            </div>
          </div>

          {/* Crew Base Config — editable */}
          <div className="rounded-2xl p-5 mb-6"
            style={{
              background: isDark ? accentTint(ACCENT, 0.06) : accentTint(ACCENT, 0.05),
              border: `1px solid ${accentTint(ACCENT, isDark ? 0.15 : 0.2)}`,
            }}>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} color={isDark ? "#e0e0e0" : ACCENT} strokeWidth={1.8} />
              <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: isDark ? "#e0e0e0" : ACCENT }}>
                Crew Base Configuration
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <FieldRow label="Crew Reporting Time (min)"
                value={airport.crewReportingTimeMinutes != null ? <span className="font-mono">{airport.crewReportingTimeMinutes} min</span> : null}
                editing={editing} fieldKey="crewReportingTimeMinutes" editValue={getVal("crewReportingTimeMinutes")} onChange={handleFieldChange} inputType="number" />
              <FieldRow label="Crew Debrief Time (min)"
                value={airport.crewDebriefTimeMinutes != null ? <span className="font-mono">{airport.crewDebriefTimeMinutes} min</span> : null}
                editing={editing} fieldKey="crewDebriefTimeMinutes" editValue={getVal("crewDebriefTimeMinutes")} onChange={handleFieldChange} inputType="number" />
              <FieldRow label="Crew Facilities"
                value={airport.hasCrewFacilities
                  ? <span className="text-green-600 dark:text-green-400 font-semibold">Available</span>
                  : <span className="text-hz-text-secondary">Not Available</span>}
                editing={editing} fieldKey="hasCrewFacilities" editValue={getVal("hasCrewFacilities")} onChange={handleFieldChange} inputType="toggle" />
            </div>
          </div>

          {/* Remove Base */}
          <div className="rounded-2xl p-5 border border-red-200 dark:border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 size={14} className="text-red-500" strokeWidth={1.8} />
              <span className="text-[12px] font-bold uppercase tracking-wider text-red-500">Remove Crew Base</span>
            </div>
            <p className="text-[13px] text-hz-text-secondary mb-3">
              This will remove crew base status from this airport. The airport record will not be deleted.
            </p>
            {confirmRemove ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-red-500 font-medium">Are you sure?</span>
                <button onClick={handleRemove} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50">
                  {saving ? "Removing..." : "Yes, Remove"}
                </button>
                <button onClick={() => setConfirmRemove(false)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmRemove(true)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-red-500 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                Remove Base
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Base Panel ──

function AddBasePanel({ existingBases, onAdd, onCancel }: {
  existingBases: AirportRef[];
  onAdd: (airport: AirportRef) => Promise<void>;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [allAirports, setAllAirports] = useState<AirportRef[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    api.getAirports()
      .then(setAllAirports)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const baseIds = useMemo(() => new Set(existingBases.map(b => b._id)), [existingBases]);

  const available = useMemo(() => {
    const nonBases = allAirports.filter(a => !baseIds.has(a._id) && a.isActive);
    if (!search.trim()) return nonBases.slice(0, 50);
    const q = search.toLowerCase().trim();
    return nonBases.filter(a =>
      a.icaoCode.toLowerCase().includes(q) ||
      (a.iataCode?.toLowerCase().includes(q) ?? false) ||
      a.name.toLowerCase().includes(q) ||
      (a.city?.toLowerCase().includes(q) ?? false) ||
      (a.countryName?.toLowerCase().includes(q) ?? false)
    ).slice(0, 50);
  }, [allAirports, baseIds, search]);

  const handleAdd = useCallback(async (airport: AirportRef) => {
    setAdding(airport._id);
    try { await onAdd(airport); }
    catch { setAdding(null); }
  }, [onAdd]);

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
              <h1 className="text-[18px] font-semibold">Add Crew Base</h1>
              <p className="text-[12px] text-hz-text-secondary">Select an airport to designate as a crew base</p>
            </div>
          </div>
          <button onClick={onCancel}
            className="text-[13px] text-hz-text-secondary hover:text-hz-text font-medium">
            Cancel
          </button>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-hz-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input type="text" placeholder="Search airports by IATA, ICAO, name, city, country..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-6 py-4">Loading airports...</div>
        ) : available.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-6 py-4">
            {search ? "No matching airports found" : "All airports are already crew bases"}
          </div>
        ) : (
          <div className="divide-y divide-hz-border/50">
            {available.map(a => (
              <div key={a._id} className="flex items-center gap-3 px-6 py-3 hover:bg-hz-border/20 transition-colors">
                <span className="text-[14px] font-bold font-mono w-10 shrink-0" style={{ color: ACCENT }}>
                  {a.iataCode || a.icaoCode}
                </span>
                <span className="text-[12px] font-mono text-hz-text-secondary w-10 shrink-0">{a.icaoCode}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{a.name}</div>
                  <div className="text-[11px] text-hz-text-secondary truncate">
                    {[a.city, a.countryName].filter(Boolean).join(", ")}
                  </div>
                </div>
                <div className="text-[11px] text-hz-text-secondary shrink-0">{a.timezone}</div>
                <button
                  onClick={() => handleAdd(a)}
                  disabled={adding === a._id}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shrink-0 hover:opacity-90 disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: ACCENT }}>
                  {adding === a._id ? "Adding..." : "Set as Base"}
                </button>
              </div>
            ))}
            {!search && available.length >= 50 && (
              <div className="px-6 py-3 text-[12px] text-hz-text-secondary">
                Showing first 50 results. Use search to find specific airports.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
