"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { AirportRef, AirportLookupResult, CountryRef } from "@skyhub/api";
import { api } from "@skyhub/api";
import { AirportMap } from "./airport-map";
import { AirportBasicTab } from "./airport-basic-tab";
import { AirportRunwayTab } from "./airport-runway-tab";
import { AirportOperationsTab } from "./airport-operations-tab";
import { AirportCrewTab } from "./airport-crew-tab";
import {
  Info,
  Plane,
  Radio,
  Users,
  Pencil,
  Save,
  X,
  Trash2,
  Plus,
  Globe,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { CountryFlag } from "@/components/ui/country-flag";

const TIMEZONE_LIST = Intl.supportedValuesOf("timeZone");

const TABS = [
  { key: "basic", label: "Basic", icon: Info },
  { key: "runway", label: "Runway & Facilities", icon: Plane },
  { key: "operations", label: "Operations", icon: Radio },
  { key: "crew", label: "Crew", icon: Users },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface AirportDetailProps {
  airport: AirportRef;
  onSave?: (id: string, data: Partial<AirportRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: (data: Partial<AirportRef>) => Promise<void>;
}

export function AirportDetail({ airport, onSave, onDelete, onCreate }: AirportDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Partial<AirportRef>>({});
  const [errorMsg, setErrorMsg] = useState("");

  // Create flow
  const [showCreate, setShowCreate] = useState(false);
  const [lookupCode, setLookupCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<AirportLookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [manualForm, setManualForm] = useState({ icaoCode: "", iataCode: "", name: "", city: "", countryId: "", timezone: "", latitude: "", longitude: "", elevationFt: "" });
  const [countries, setCountries] = useState<CountryRef[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [tzSearch, setTzSearch] = useState("");
  const [tzOpen, setTzOpen] = useState(false);

  useEffect(() => {
    if (showCreate && countries.length === 0) {
      api.getCountries().then(setCountries).catch(console.error);
    }
  }, [showCreate, countries.length]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    const list = q ? countries.filter(c => c.name.toLowerCase().includes(q) || c.isoCode2.toLowerCase().includes(q)) : countries;
    return list.slice(0, 30);
  }, [countries, countrySearch]);

  const filteredTimezones = useMemo(() => {
    const q = tzSearch.toLowerCase();
    return (q ? TIMEZONE_LIST.filter(tz => tz.toLowerCase().includes(q)) : TIMEZONE_LIST).slice(0, 30);
  }, [tzSearch]);

  const selectedCountry = countries.find(c => c._id === manualForm.countryId);

  const resetCreate = useCallback(() => {
    setShowCreate(false); setLookupCode(""); setLookupResult(null); setNotFound(false);
    setManualMode(false); setCreateError("");
    setManualForm({ icaoCode: "", iataCode: "", name: "", city: "", countryId: "", timezone: "", latitude: "", longitude: "", elevationFt: "" });
  }, []);

  const handleLookup = useCallback(async () => {
    if (!lookupCode.trim()) return;
    setLookupLoading(true); setCreateError(""); setLookupResult(null); setNotFound(false);
    try {
      setLookupResult(await api.lookupAirport(lookupCode.trim()));
    } catch { setNotFound(true); }
    finally { setLookupLoading(false); }
  }, [lookupCode]);

  const friendlyCreateError = useCallback((err: any) => {
    const msg = err.message || "Create failed";
    try {
      const match = msg.match(/API (\d+): (.+)/);
      if (match) {
        const parsed = JSON.parse(match[2]);
        if (Number(match[1]) === 409) {
          return `This airport already exists in the database. You can find it using the search on the left panel.`;
        }
        return parsed.error || parsed.details?.join(", ") || msg;
      }
    } catch { /* use raw msg */ }
    return msg;
  }, []);

  const handleCreateFromLookup = useCallback(async () => {
    if (!onCreate || !lookupResult) return;
    setCreating(true);
    try {
      await onCreate({ icaoCode: lookupResult.icaoCode ?? undefined, iataCode: lookupResult.iataCode, name: lookupResult.name ?? "Unknown", city: lookupResult.city, timezone: lookupResult.timezone ?? "UTC", latitude: lookupResult.latitude, longitude: lookupResult.longitude, elevationFt: lookupResult.elevationFt, numberOfRunways: lookupResult.numberOfRunways, longestRunwayFt: lookupResult.longestRunwayFt, isActive: true } as Partial<AirportRef>);
      resetCreate();
    } catch (err: any) { setCreateError(friendlyCreateError(err)); }
    finally { setCreating(false); }
  }, [onCreate, lookupResult, resetCreate, friendlyCreateError]);

  const handleManualCreate = useCallback(async () => {
    if (!onCreate) return;
    if (!manualForm.icaoCode || !manualForm.name || !manualForm.timezone) { setCreateError("ICAO, name, and timezone are required"); return; }
    setCreating(true); setCreateError("");
    try {
      const country = countries.find(c => c._id === manualForm.countryId);
      await onCreate({ icaoCode: manualForm.icaoCode.toUpperCase(), iataCode: manualForm.iataCode ? manualForm.iataCode.toUpperCase() : null, name: manualForm.name, city: manualForm.city || null, countryId: manualForm.countryId || null, countryName: country?.name ?? null, countryIso2: country?.isoCode2 ?? null, countryFlag: country?.flagEmoji ?? null, timezone: manualForm.timezone, latitude: manualForm.latitude ? Number(manualForm.latitude) : null, longitude: manualForm.longitude ? Number(manualForm.longitude) : null, elevationFt: manualForm.elevationFt ? Number(manualForm.elevationFt) : null, isActive: true } as Partial<AirportRef>);
      resetCreate();
    } catch (err: any) { setCreateError(friendlyCreateError(err)); }
    finally { setCreating(false); }
  }, [onCreate, manualForm, countries, resetCreate, friendlyCreateError]);

  const hasCoords = airport.latitude != null && airport.longitude != null;

  const handleEdit = useCallback(() => {
    setDraft({});
    setEditing(true);
    setConfirmDelete(false);
  }, []);

  const handleCancel = useCallback(() => {
    setDraft({});
    setEditing(false);
  }, []);

  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave || Object.keys(draft).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(airport._id, draft);
      setEditing(false);
      setDraft({});
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [onSave, airport._id, draft]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    setSaving(true);
    setErrorMsg("");
    try {
      await onDelete(airport._id);
    } catch (err: any) {
      // Extract server error message (e.g. "Cannot delete EDDF — 42 flights reference this airport")
      const msg = err.message || "Delete failed";
      const match = msg.match(/API \d+: (.+)/);
      try {
        const parsed = JSON.parse(match?.[1] ?? "{}");
        setErrorMsg(parsed.error || msg);
      } catch {
        setErrorMsg(match?.[1] || msg);
      }
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }, [onDelete, airport._id]);

  // Merged data: airport fields + draft overrides
  const getVal = (key: keyof AirportRef) =>
    key in draft ? (draft as any)[key] : airport[key];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          {/* Name + Active badge */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{airport.name}</h1>
            {airport.isActive ? (
              <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                Active
              </span>
            ) : (
              <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-red-50 text-red-600">
                Inactive
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors"
                  style={{ backgroundColor: "#1e40af" }}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  confirmDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] text-red-500 font-medium">Delete?</span>
                      <button
                        onClick={handleDelete}
                        disabled={saving}
                        className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1 p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete airport"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
                {onSave && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
                {onCreate && (
                  <button
                    onClick={() => { resetCreate(); setShowCreate(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white transition-colors"
                    style={{ backgroundColor: "#1e40af" }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {airport.isCrewBase && !editing && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-[13px] font-medium text-purple-700 dark:bg-purple-500/15 dark:border-purple-500/25 dark:text-purple-400">
              <Users className="h-3 w-3" />
              Crew Base
            </span>
          </div>
        )}

        {/* Error message (e.g. cannot delete due to flights) */}
        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="text-[13px] text-red-700 dark:text-red-400">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 shrink-0 ml-auto">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Create Airport Panel ── */}
      {showCreate && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3 overflow-y-auto max-h-[50vh]">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Add New Airport</span>
            <button onClick={resetCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">Cancel</button>
          </div>

          {!manualMode ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Enter ICAO code (e.g. VVTS)" value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  className="flex-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text font-mono"
                  maxLength={4}
                />
                <button onClick={handleLookup} disabled={lookupLoading || lookupCode.length < 3}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "#0f766e" }}>
                  {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  Lookup
                </button>
              </div>

              {notFound && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
                        Could not locate airport <span className="font-mono font-bold">{lookupCode}</span> in the Master Airport Database.
                      </p>
                      <p className="text-[12px] text-amber-700/70 dark:text-amber-400/60 mt-1">
                        This may be a new or unregistered airport. You can add it manually with the details you have.
                      </p>
                      <button onClick={() => { setManualMode(true); setNotFound(false); setManualForm(p => ({ ...p, icaoCode: lookupCode.toUpperCase() })); }}
                        className="mt-3 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
                        style={{ backgroundColor: "#1e40af" }}>
                        Proceed Adding Manually
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {lookupResult && (
                <div className="rounded-lg border border-hz-border bg-hz-bg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold">{lookupResult.name}</span>
                    <span className="text-[11px] text-hz-text-secondary px-2 py-0.5 rounded bg-hz-border/50">{lookupResult.source}</span>
                  </div>
                  <div className="text-[13px] text-hz-text-secondary space-y-1">
                    <div>ICAO: <span className="font-mono font-bold text-hz-text">{lookupResult.icaoCode}</span> · IATA: <span className="font-mono font-bold text-hz-text">{lookupResult.iataCode ?? "—"}</span></div>
                    <div>{[lookupResult.city, lookupResult.country].filter(Boolean).join(" · ")}</div>
                    <div>Timezone: {lookupResult.timezone} · Elevation: {lookupResult.elevationFt ?? "—"} ft</div>
                    {lookupResult.latitude != null && <div>Coordinates: {lookupResult.latitude.toFixed(4)}, {lookupResult.longitude?.toFixed(4)}</div>}
                  </div>
                  <button onClick={handleCreateFromLookup} disabled={creating}
                    className="w-full mt-2 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#1e40af" }}>
                    {creating ? "Creating…" : "Add to Database"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <MiniInput label="ICAO Code *" value={manualForm.icaoCode} maxLength={4} mono
                  onChange={(v) => setManualForm(p => ({ ...p, icaoCode: v.toUpperCase() }))} />
                <MiniInput label="IATA Code" value={manualForm.iataCode} maxLength={3} mono
                  onChange={(v) => setManualForm(p => ({ ...p, iataCode: v.toUpperCase() }))} />
              </div>
              <MiniInput label="Airport Name *" value={manualForm.name}
                onChange={(v) => setManualForm(p => ({ ...p, name: v }))} />
              <MiniInput label="City" value={manualForm.city}
                onChange={(v) => setManualForm(p => ({ ...p, city: v }))} />

              {/* Country dropdown */}
              <div className="relative">
                <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold">Country</label>
                <button onClick={() => { setCountryOpen(!countryOpen); setTzOpen(false); }}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] text-left border border-hz-border bg-hz-bg text-hz-text flex items-center justify-between">
                  <span>{selectedCountry ? `${selectedCountry.name} (${selectedCountry.isoCode2})` : "Select country…"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-hz-text-secondary" />
                </button>
                {countryOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-hz-border bg-white dark:bg-[#1e1e22] shadow-lg max-h-[200px] overflow-y-auto">
                    <input type="text" placeholder="Search…" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] border-b border-hz-border bg-transparent outline-none text-hz-text" autoFocus />
                    {filteredCountries.map(c => (
                      <button key={c._id} onClick={() => { setManualForm(p => ({ ...p, countryId: c._id })); setCountryOpen(false); setCountrySearch(""); }}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-hz-border/30 transition-colors flex items-center justify-between">
                        <span>{c.name}</span>
                        <span className="text-[11px] text-hz-text-secondary font-mono">{c.isoCode2}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Timezone dropdown */}
              <div className="relative">
                <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold">Timezone *</label>
                <button onClick={() => { setTzOpen(!tzOpen); setCountryOpen(false); }}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] text-left border border-hz-border bg-hz-bg text-hz-text flex items-center justify-between">
                  <span>{manualForm.timezone || "Select timezone…"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-hz-text-secondary" />
                </button>
                {tzOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-hz-border bg-white dark:bg-[#1e1e22] shadow-lg max-h-[200px] overflow-y-auto">
                    <input type="text" placeholder="Search timezone…" value={tzSearch} onChange={(e) => setTzSearch(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] border-b border-hz-border bg-transparent outline-none text-hz-text" autoFocus />
                    {filteredTimezones.map(tz => (
                      <button key={tz} onClick={() => { setManualForm(p => ({ ...p, timezone: tz })); setTzOpen(false); setTzSearch(""); }}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-hz-border/30 transition-colors font-mono">{tz}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <MiniInput label="Latitude" value={manualForm.latitude} type="number"
                  onChange={(v) => setManualForm(p => ({ ...p, latitude: v }))} />
                <MiniInput label="Longitude" value={manualForm.longitude} type="number"
                  onChange={(v) => setManualForm(p => ({ ...p, longitude: v }))} />
                <MiniInput label="Elevation (ft)" value={manualForm.elevationFt} type="number"
                  onChange={(v) => setManualForm(p => ({ ...p, elevationFt: v }))} />
              </div>

              <button onClick={handleManualCreate} disabled={creating}
                className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#1e40af" }}>
                {creating ? "Creating…" : "Add to Database"}
              </button>
            </div>
          )}

          {createError && <p className="text-[12px] text-red-500">{createError}</p>}
        </div>
      )}

      {/* Map with code overlay */}
      {hasCoords && (
        <div className="h-[300px] shrink-0 border-b border-hz-border relative">
          <AirportMap
            latitude={airport.latitude!}
            longitude={airport.longitude!}
            name={airport.name}
          />
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.82)",
                border: "0.5px solid rgba(0,0,0,0.08)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <span style={{ color: "#666" }}>IATA:</span>
              <span className="font-bold" style={{ color: "#111" }}>{airport.iataCode ?? "—"}</span>
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.82)",
                border: "0.5px solid rgba(0,0,0,0.08)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <span style={{ color: "#666" }}>ICAO:</span>
              <span className="font-bold" style={{ color: "#111" }}>{airport.icaoCode}</span>
            </span>
            {airport.countryIso2 && (
              <span
                className="inline-flex items-center justify-center px-1.5 py-1 rounded-lg backdrop-blur-md"
                style={{
                  background: "rgba(255,255,255,0.82)",
                  border: "0.5px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <CountryFlag iso2={airport.countryIso2} size={28} />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-hz-border shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium transition-colors duration-150 shrink-0 ${
                active
                  ? "bg-module-accent/15 text-module-accent"
                  : "text-hz-text-secondary hover:bg-hz-border/30 hover:text-hz-text"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "basic" && (
          <AirportBasicTab airport={airport} editing={editing} draft={draft} onChange={handleFieldChange} />
        )}
        {activeTab === "runway" && (
          <AirportRunwayTab airport={airport} editing={editing} draft={draft} onChange={handleFieldChange} />
        )}
        {activeTab === "operations" && (
          <AirportOperationsTab airport={airport} editing={editing} draft={draft} onChange={handleFieldChange} />
        )}
        {activeTab === "crew" && (
          <AirportCrewTab airport={airport} editing={editing} draft={draft} onChange={handleFieldChange} />
        )}
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
      <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength}
        className={`w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text ${mono ? "font-mono" : ""}`} />
    </div>
  );
}
