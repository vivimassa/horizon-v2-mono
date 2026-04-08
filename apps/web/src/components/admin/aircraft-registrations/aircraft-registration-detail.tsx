"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { AircraftRegistrationRef, AircraftTypeRef, LopaConfigRef, CabinClassRef } from "@skyhub/api";
import { api } from "@skyhub/api";
import { FieldRow } from "../airports/field-row";
import { AircraftSeatMap } from "../lopa/aircraft-seat-map";
import { getOperatorId } from "@/stores/use-operator-store";
import {
  Info,
  Gauge,
  Armchair,
  Package,
  Users,
  CloudRain,
  MapPin,
  Wrench,
  Pencil,
  Save,
  X,
  Trash2,
  Star,
  AlertTriangle,
  Camera,
} from "lucide-react";

// ── Constants ──

const STATUSES: Record<string, string> = {
  active: "Active",
  maintenance: "Maintenance",
  stored: "Stored",
  retired: "Retired",
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-[rgba(6,194,112,0.12)]", text: "text-[#06C270] dark:text-[#39D98A]" },
  maintenance: { bg: "bg-amber-50 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-400" },
  stored: { bg: "bg-gray-100 dark:bg-gray-500/15", text: "text-gray-600 dark:text-gray-400" },
  retired: { bg: "bg-[rgba(255,59,59,0.12)]", text: "text-[#E63535] dark:text-[#FF5C5C]" },
};

const TABS = [
  { key: "basic" as const, label: "Basic", icon: Info },
  { key: "performance" as const, label: "Performance", icon: Gauge },
  { key: "config" as const, label: "Seating", icon: Armchair },
  { key: "cargo" as const, label: "Cargo", icon: Package },
  { key: "crew" as const, label: "Crew & Rest", icon: Users },
  { key: "weather" as const, label: "Weather", icon: CloudRain },
  { key: "location" as const, label: "Location", icon: MapPin },
  { key: "maintenance" as const, label: "Maintenance", icon: Wrench },
];

type TabKey = (typeof TABS)[number]["key"];

// ── Helpers ──

function isLeaseExpiringSoon(date: string | null): "expired" | "warning" | null {
  if (!date) return null;
  const expiry = new Date(date);
  const now = new Date();
  if (expiry < now) return "expired";
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  if (expiry < sixMonths) return "warning";
  return null;
}

// ── Props ──

interface AircraftRegistrationDetailProps {
  registration: AircraftRegistrationRef | null;
  aircraftTypes: AircraftTypeRef[];
  typeMap: Map<string, AircraftTypeRef>;
  onSave?: (id: string, data: Partial<AircraftRegistrationRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: (data: Partial<AircraftRegistrationRef>) => Promise<void>;
  onCancelCreate?: () => void;
}

export function AircraftRegistrationDetail({
  registration, aircraftTypes, typeMap, onSave, onDelete, onCreate, onCancelCreate,
}: AircraftRegistrationDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Create form
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({
    registration: "",
    aircraftTypeId: "",
    serialNumber: "",
    variant: "",
    status: "active",
    homeBaseIcao: "",
  });

  // Configuration tab — LOPA configs
  const [lopaConfigs, setLopaConfigs] = useState<LopaConfigRef[]>([]);
  const [cabinClasses, setCabinClasses] = useState<CabinClassRef[]>([]);

  const regId = registration?._id;
  const regAcTypeId = registration?.aircraftTypeId;

  useEffect(() => {
    if (!regAcTypeId) return;
    const acType = typeMap.get(regAcTypeId);
    if (acType) {
      api.getLopaConfigs(getOperatorId(), acType.icaoType).then(setLopaConfigs).catch(() => {});
    }
    api.getCabinClasses(getOperatorId()).then(setCabinClasses).catch(() => {});
  }, [regId, regAcTypeId, typeMap]);

  // Set default aircraftTypeId for create form
  useEffect(() => {
    if (!registration && aircraftTypes.length > 0 && !createForm.aircraftTypeId) {
      setCreateForm(p => ({ ...p, aircraftTypeId: aircraftTypes[0]._id }));
    }
  }, [registration, aircraftTypes, createForm.aircraftTypeId]);

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || "Failed";
    try {
      const match = msg.match(/API (\d+): (.+)/);
      if (match) {
        const parsed = JSON.parse(match[2]);
        if (Number(match[1]) === 409) return parsed.error || "This registration already exists.";
        return parsed.error || parsed.details?.join(", ") || msg;
      }
    } catch { /* use raw */ }
    return msg;
  }, []);

  const handleCreate = useCallback(async () => {
    if (!onCreate) return;
    if (!createForm.registration || !createForm.aircraftTypeId) {
      setCreateError("Registration and aircraft type are required"); return;
    }
    setCreating(true); setCreateError("");
    try {
      await onCreate({
        operatorId: getOperatorId(),
        registration: createForm.registration.toUpperCase(),
        aircraftTypeId: createForm.aircraftTypeId,
        serialNumber: createForm.serialNumber || null,
        variant: createForm.variant || null,
        status: createForm.status,
        homeBaseIcao: createForm.homeBaseIcao ? createForm.homeBaseIcao.toUpperCase() : null,
        isActive: true,
      } as Partial<AircraftRegistrationRef>);
      setCreateForm({ registration: "", aircraftTypeId: aircraftTypes[0]?._id || "", serialNumber: "", variant: "", status: "active", homeBaseIcao: "" });
    } catch (err: any) { setCreateError(friendlyError(err)); }
    finally { setCreating(false); }
  }, [onCreate, createForm, aircraftTypes, friendlyError]);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);

  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave || !registration || Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true); setErrorMsg("");
    try {
      await onSave(registration._id, draft as Partial<AircraftRegistrationRef>);
      setEditing(false); setDraft({});
    } catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); }
  }, [onSave, registration, draft, friendlyError]);

  const handleDelete = useCallback(async () => {
    if (!onDelete || !registration) return;
    setSaving(true); setErrorMsg("");
    try { await onDelete(registration._id); }
    catch (err: any) { setErrorMsg(friendlyError(err)); }
    finally { setSaving(false); setConfirmDelete(false); }
  }, [onDelete, registration, friendlyError]);

  const getVal = (key: keyof AircraftRegistrationRef) =>
    registration ? (key in draft ? (draft as any)[key] : registration[key]) : null;

  const acType = registration ? typeMap.get(registration.aircraftTypeId) : null;
  const leaseStatus = registration ? isLeaseExpiringSoon(registration.leaseExpiryDate) : null;

  // ── Create mode ──
  if (!registration) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-hz-border shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-semibold">Add New Registration</h1>
            {onCancelCreate && (
              <button onClick={onCancelCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text transition-colors">Cancel</button>
            )}
          </div>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="flex gap-3">
            <MiniInput label="Registration *" value={createForm.registration} maxLength={10}
              onChange={(v) => setCreateForm(p => ({ ...p, registration: v.toUpperCase() }))} mono />
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Aircraft Type *</label>
              <select value={createForm.aircraftTypeId}
                onChange={(e) => setCreateForm(p => ({ ...p, aircraftTypeId: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text">
                {aircraftTypes.map(t => <option key={t._id} value={t._id}>{t.icaoType} — {t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <MiniInput label="Serial Number (MSN)" value={createForm.serialNumber}
              onChange={(v) => setCreateForm(p => ({ ...p, serialNumber: v }))} mono />
            <MiniInput label="Variant" value={createForm.variant}
              onChange={(v) => setCreateForm(p => ({ ...p, variant: v }))} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Status</label>
              <select value={createForm.status}
                onChange={(e) => setCreateForm(p => ({ ...p, status: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text">
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <MiniInput label="Home Base (ICAO)" value={createForm.homeBaseIcao} maxLength={4}
              onChange={(v) => setCreateForm(p => ({ ...p, homeBaseIcao: v.toUpperCase() }))} mono />
          </div>
          <div className="flex gap-3 pt-2">
            {onCancelCreate && (
              <button onClick={onCancelCreate}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">
                Cancel
              </button>
            )}
            <button onClick={handleCreate} disabled={creating}
              className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent">
              {creating ? "Creating..." : "Add Registration"}
            </button>
          </div>
          {createError && <p className="text-[12px] text-red-500">{createError}</p>}
        </div>
      </div>
    );
  }

  // ── Detail view ──
  const statusStyle = STATUS_STYLES[registration.status] || STATUS_STYLES.active;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[20px] font-semibold font-mono px-3 py-1 rounded-lg bg-hz-border/30">
              {registration.registration}
            </span>
            {acType && (
              <span className="text-[13px] font-medium text-hz-text-secondary">
                {acType.icaoType} — {acType.name}
              </span>
            )}
            <span className={`text-[13px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
              {STATUSES[registration.status] || registration.status}
            </span>
            {leaseStatus && (
              <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                leaseStatus === "expired"
                  ? "bg-[rgba(255,59,59,0.12)] text-[#E63535] dark:bg-[rgba(255,92,92,0.15)] dark:text-[#FF5C5C]"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              }`}>
                <AlertTriangle className="h-3 w-3" />
                {leaseStatus === "expired" ? "Lease Expired" : "Lease Expiring"}
              </span>
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors bg-module-accent">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  confirmDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-medium" style={{ color: "#E63535" }}>Delete?</span>
                      <button onClick={handleDelete} disabled={saving} className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white transition-colors" style={{ backgroundColor: "#E63535" }}>Yes</button>
                      <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
                {onSave && (
                  <button onClick={handleEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
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

      {/* Aircraft image — always visible above tabs, with drag-drop upload */}
      {acType && (
        <ImageDropZone
          registration={registration}
          acType={acType}
          onSave={onSave}
        />
      )}

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
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-6 pt-3 pb-6">
          {activeTab === "basic" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow label="Registration" value={<span className="font-bold font-mono">{registration.registration}</span>}
                editing={editing} fieldKey="registration" editValue={getVal("registration")} onChange={handleFieldChange} />
              {/* Aircraft Type */}
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">Aircraft Type</div>
                {editing ? (
                  <select value={getVal("aircraftTypeId") || ""}
                    onChange={(e) => handleFieldChange("aircraftTypeId", e.target.value)}
                    className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
                    {aircraftTypes.map(t => <option key={t._id} value={t._id}>{t.icaoType} — {t.name}</option>)}
                  </select>
                ) : (
                  <div className="text-[13px] font-medium">{acType ? `${acType.icaoType} — ${acType.name}` : "—"}</div>
                )}
              </div>
              <FieldRow label="Serial Number (MSN)" value={registration.serialNumber ? <span className="font-mono">{registration.serialNumber}</span> : null}
                editing={editing} fieldKey="serialNumber" editValue={getVal("serialNumber")} onChange={handleFieldChange} />
              <FieldRow label="Variant" value={registration.variant}
                editing={editing} fieldKey="variant" editValue={getVal("variant")} onChange={handleFieldChange} />
              {/* Status */}
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">Status</div>
                {editing ? (
                  <select value={getVal("status") || "active"}
                    onChange={(e) => handleFieldChange("status", e.target.value)}
                    className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                ) : (
                  <div className={`text-[13px] font-semibold capitalize ${STATUS_STYLES[registration.status]?.text || ""}`}>
                    {STATUSES[registration.status] || registration.status}
                  </div>
                )}
              </div>
              <FieldRow label="Home Base (ICAO)" value={registration.homeBaseIcao ? <span className="font-mono">{registration.homeBaseIcao}</span> : null}
                editing={editing} fieldKey="homeBaseIcao" editValue={getVal("homeBaseIcao")} onChange={handleFieldChange} />
              <FieldRow label="SELCAL" value={registration.selcal ? <span className="font-mono">{registration.selcal}</span> : null}
                editing={editing} fieldKey="selcal" editValue={getVal("selcal")} onChange={handleFieldChange} />
              <FieldRow label="Date of Manufacture" value={registration.dateOfManufacture}
                editing={editing} fieldKey="dateOfManufacture" editValue={getVal("dateOfManufacture")} onChange={handleFieldChange} />
              <FieldRow label="Date of Delivery" value={registration.dateOfDelivery}
                editing={editing} fieldKey="dateOfDelivery" editValue={getVal("dateOfDelivery")} onChange={handleFieldChange} />
              {/* Lease expiry with warning */}
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">Lease Expiry</div>
                {editing ? (
                  <input type="text" value={getVal("leaseExpiryDate") ?? ""}
                    onChange={(e) => handleFieldChange("leaseExpiryDate", e.target.value || null)}
                    placeholder="YYYY-MM-DD"
                    className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text" />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{registration.leaseExpiryDate || "—"}</span>
                    {leaseStatus === "expired" && <span className="text-[11px] font-semibold" style={{ color: "#E63535" }}>Expired</span>}
                    {leaseStatus === "warning" && <span className="text-[11px] font-semibold" style={{ color: "#E67A00" }}>Expiring soon</span>}
                  </div>
                )}
              </div>
              <FieldRow label="Notes" value={registration.notes}
                editing={editing} fieldKey="notes" editValue={getVal("notes")} onChange={handleFieldChange} />
              <FieldRow label="Active"
                value={registration.isActive ? <span className="font-semibold" style={{ color: "#06C270" }}>Active</span> : <span className="font-semibold" style={{ color: "#E63535" }}>Inactive</span>}
                editing={editing} fieldKey="isActive" editValue={getVal("isActive")} onChange={handleFieldChange} inputType="toggle" />
            </div>
          )}

          {activeTab === "config" && (() => {
            const currentLopaId = registration.lopaConfigId;

            const handleLopaSelect = async (configId: string) => {
              if (!onSave) return;
              const newId = configId === currentLopaId ? null : configId;
              try {
                await onSave(registration._id, { lopaConfigId: newId } as Partial<AircraftRegistrationRef>);
              } catch (err) { console.error("Failed to update LOPA:", err); }
            };

            return (
              <div className="space-y-4">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">
                  Select Seating Configuration
                </div>

                {lopaConfigs.length === 0 ? (
                  <div className="text-[13px] text-hz-text-secondary py-4">
                    No LOPA configurations found for {acType?.icaoType || "this type"}. Create them in the LOPA Database.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lopaConfigs.map((lc) => {
                      const isSelected = lc._id === currentLopaId;
                      return (
                        <button
                          key={lc._id}
                          onClick={() => handleLopaSelect(lc._id)}
                          className={`w-full text-left rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                            isSelected
                              ? "border-module-accent shadow-md"
                              : "border-hz-border/30 opacity-50 hover:opacity-75 hover:border-hz-border"
                          }`}
                        >
                          {/* Config header */}
                          <div className={`flex items-center gap-3 px-4 py-2.5 ${isSelected ? "bg-module-accent/10" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[13px] font-semibold ${isSelected ? "text-module-accent" : "text-hz-text-secondary"}`}>
                                  {lc.configName}
                                </span>
                                {lc.isDefault && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {lc.cabins.map((c, i) => {
                                  const cc = cabinClasses.find(cls => cls.code === c.classCode);
                                  return (
                                    <span key={i} className="text-[13px] text-hz-text-secondary">
                                      <span className="font-bold font-mono" style={{ color: cc?.color || "#9ca3af" }}>{c.classCode}</span>: {c.seats}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <span className={`text-[15px] font-bold tabular-nums ${isSelected ? "text-module-accent" : ""}`}>
                              {lc.totalSeats}
                            </span>
                            <span className="text-[13px] text-hz-text-tertiary">seats</span>
                          </div>
                          {/* Half-size seat map — crop to show fuselage center */}
                          <div className="px-2 pb-2 flex items-center justify-center" style={{ height: 150, overflow: "hidden" }}>
                            <AircraftSeatMap
                              cabins={lc.cabins}
                              cabinClasses={cabinClasses}
                              aircraftType={acType?.icaoType}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Info */}
                {lopaConfigs.length > 0 && (
                  <div className="px-4 py-3 rounded-xl bg-hz-border/10 border border-hz-border/30">
                    <p className="text-[12px] text-hz-text-secondary">
                      <Armchair className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                      Click a configuration to assign it. Click again to unassign. Manage configs in the LOPA Database.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === "performance" && (() => {
            const perf = registration?.performance;
            return (
            <div className="space-y-6">
              {!perf ? (
                <div className="text-[13px] text-hz-text-secondary py-4">
                  No performance data available for this aircraft.
                </div>
              ) : (
                <>
                  <TypeSection title="Weights">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8">
                      <FieldRow label="MTOW (kg)" value={perf.mtowKg?.toLocaleString() ?? null} />
                      <FieldRow label="MLW (kg)" value={perf.mlwKg?.toLocaleString() ?? null} />
                      <FieldRow label="MZFW (kg)" value={perf.mzfwKg?.toLocaleString() ?? null} />
                      <FieldRow label="OEW (kg)" value={perf.oewKg?.toLocaleString() ?? null} />
                    </div>
                  </TypeSection>
                  <TypeSection title="Fuel">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                      <FieldRow label="Max Fuel Capacity (kg)" value={perf.maxFuelCapacityKg?.toLocaleString() ?? null} />
                      <FieldRow label="Fuel Burn Rate (kg/hr)" value={registration.fuelBurnRateKgPerHour?.toLocaleString() ?? null} />
                    </div>
                  </TypeSection>
                  <TypeSection title="Speed & Range">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8">
                      <FieldRow label="Cruising Speed (kts)" value={perf.cruisingSpeedKts ?? null} />
                      <FieldRow label="Max Range (NM)" value={perf.maxRangeNm?.toLocaleString() ?? null} />
                      <FieldRow label="Ceiling (FL)" value={perf.ceilingFl ?? null} />
                    </div>
                  </TypeSection>
                  <TypeSection title="ETOPS">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                      <FieldRow label="ETOPS Capable" value={registration.etopsCapable ? <span className="font-semibold" style={{ color: "#06C270" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>} />
                      <FieldRow label="ETOPS Rating (min)" value={registration.etopsRatingMinutes ?? null} />
                    </div>
                  </TypeSection>
                  <TypeSection title="Classifications">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                      <FieldRow label="Noise Category" value={registration.noiseCategory ?? null} />
                      <FieldRow label="Emissions Category" value={registration.emissionsCategory ?? null} />
                    </div>
                  </TypeSection>
                </>
              )}
            </div>
            );
          })()}

          {activeTab === "cargo" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <FieldRow label="Max Cargo Weight (kg)" value={acType?.cargo?.maxCargoWeightKg?.toLocaleString() ?? null} />
                <FieldRow label="Cargo Positions (ULD)" value={acType?.cargo?.cargoPositions ?? null} />
                <FieldRow label="Bulk Hold Capacity (kg)" value={acType?.cargo?.bulkHoldCapacityKg?.toLocaleString() ?? null} />
                <FieldRow label="ULD Types Accepted" value={acType?.cargo?.uldTypesAccepted?.join(", ") || null} />
              </div>
              <div className="px-4 py-3 rounded-xl bg-hz-border/10 border border-hz-border/30">
                <p className="text-[12px] text-hz-text-secondary">
                  <Package className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Cargo data is inherited from the aircraft type ({acType?.icaoType}). Edit it in the Aircraft Types Database.
                </p>
              </div>
            </div>
          )}

          {activeTab === "crew" && (
            <div className="space-y-6">
              <TypeSection title="Cockpit Rest Facility">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <FieldRow label="Class" value={acType?.crewRest?.cockpitClass ?? null} />
                  <FieldRow label="Positions" value={acType?.crewRest?.cockpitPositions ?? null} />
                </div>
              </TypeSection>
              <TypeSection title="Cabin Rest Facility">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <FieldRow label="Class" value={acType?.crewRest?.cabinClass ?? null} />
                  <FieldRow label="Positions" value={acType?.crewRest?.cabinPositions ?? null} />
                </div>
              </TypeSection>
              <div className="px-4 py-3 rounded-xl bg-hz-border/10 border border-hz-border/30">
                <p className="text-[12px] text-hz-text-secondary">
                  <Users className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Crew rest data is inherited from the aircraft type ({acType?.icaoType}). Edit it in the Aircraft Types Database.
                </p>
              </div>
            </div>
          )}

          {activeTab === "weather" && (
            <div className="space-y-6">
              <TypeSection title="Weather Limitations">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
                  <FieldRow label="Min Ceiling (ft)" value={acType?.weather?.minCeilingFt ?? null} />
                  <FieldRow label="Min RVR (m)" value={acType?.weather?.minRvrM ?? null} />
                  <FieldRow label="Min Visibility (m)" value={acType?.weather?.minVisibilityM ?? null} />
                  <FieldRow label="Max Crosswind (kt)" value={acType?.weather?.maxCrosswindKt ?? null} />
                  <FieldRow label="Max Wind (kt)" value={acType?.weather?.maxWindKt ?? null} />
                </div>
              </TypeSection>
              <TypeSection title="Approach">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <FieldRow label="ILS Category Required" value={acType?.approach?.ilsCategoryRequired ?? null} />
                  <FieldRow label="Autoland Capable" value={acType?.approach?.autolandCapable ? <span className="font-semibold" style={{ color: "#06C270" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>} />
                </div>
              </TypeSection>
              <div className="px-4 py-3 rounded-xl bg-hz-border/10 border border-hz-border/30">
                <p className="text-[12px] text-hz-text-secondary">
                  <CloudRain className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Weather data is inherited from the aircraft type ({acType?.icaoType}). Edit it in the Aircraft Types Database.
                </p>
              </div>
            </div>
          )}

          {activeTab === "location" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <FieldRow label="Current Location (ICAO)"
                  value={registration.currentLocationIcao ? <span className="font-mono font-bold">{registration.currentLocationIcao}</span> : null}
                  editing={editing} fieldKey="currentLocationIcao" editValue={getVal("currentLocationIcao")} onChange={handleFieldChange} />
                <FieldRow label="Last Updated" value={registration.currentLocationUpdatedAt} />
              </div>
              <div className="px-4 py-3 rounded-xl bg-hz-border/10 border border-hz-border/30">
                <p className="text-[12px] text-hz-text-secondary">
                  <MapPin className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Current location is updated automatically by the Operations module when flights are completed.
                </p>
              </div>
            </div>
          )}

          {activeTab === "maintenance" && (
            <div className="space-y-4">
              <div className="px-4 py-3 rounded-xl bg-hz-border/10 border border-hz-border/30">
                <p className="text-[12px] text-hz-text-secondary">
                  <Wrench className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                  Maintenance tracking will be available in the Maintenance module. This tab will show maintenance checks, due dates, and work orders for this aircraft.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mini input ──
function ImageDropZone({ registration, acType, onSave }: {
  registration: AircraftRegistrationRef;
  acType: AircraftTypeRef;
  onSave?: (id: string, data: Partial<AircraftRegistrationRef>) => Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const hasCustomImage = !!registration.imageUrl;
  const imgSrc = hasCustomImage ? `http://localhost:3002${registration.imageUrl}` : `/assets/aircraft/${acType.icaoType}.png`;

  const handleUpload = async (file: File) => {
    if (!onSave) return;
    setUploading(true);
    try {
      const result = await api.uploadAircraftImage(registration._id, file);
      if (result.success) await onSave(registration._id, {} as any);
    } catch (err) { console.error("Upload failed:", err); }
    finally { setUploading(false); }
  };

  const handleRemove = async () => {
    if (!onSave) return;
    try {
      await onSave(registration._id, { imageUrl: null } as Partial<AircraftRegistrationRef>);
    } catch (err) { console.error("Remove failed:", err); }
  };

  return (
    <div
      className={`group relative shrink-0 mb-10 overflow-hidden bg-gradient-to-b from-hz-border/5 to-hz-bg transition-colors ${
        dragging ? "ring-2 ring-module-accent ring-inset bg-module-accent/5" : ""
      }`}
      style={{ maxHeight: 200 }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) await handleUpload(file);
      }}
    >
      <img
        src={imgSrc}
        alt={registration.registration}
        className="w-full h-full object-contain opacity-75"
        style={{ maxHeight: 200 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {/* Hover overlay */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
        dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}>
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
        <div className="relative flex items-center gap-3">
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            id={`ac-img-upload-${registration._id}`}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await handleUpload(file);
              e.target.value = "";
            }}
          />
          <label htmlFor={`ac-img-upload-${registration._id}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-hz-bg/90 text-hz-text border border-hz-border shadow-md cursor-pointer hover:bg-hz-bg transition-colors">
            <Camera className="h-4 w-4" />
            <span className="text-[13px] font-semibold">{uploading ? "Uploading..." : hasCustomImage ? "Change Photo" : "Add Photo"}</span>
          </label>
          {hasCustomImage && (
            <button onClick={handleRemove}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-hz-bg/90 text-red-500 border border-hz-border shadow-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <Trash2 className="h-4 w-4" />
              <span className="text-[13px] font-semibold">Remove</span>
            </button>
          )}
        </div>
      </div>

      {/* Drag indicator */}
      {dragging && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-module-accent/10" />
          <div className="relative flex items-center gap-2 text-module-accent">
            <Camera className="h-6 w-6" />
            <span className="text-[15px] font-bold">Drop image here</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[16px] font-bold text-hz-text-secondary uppercase tracking-wider mb-2">{title}</h3>
      {children}
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
