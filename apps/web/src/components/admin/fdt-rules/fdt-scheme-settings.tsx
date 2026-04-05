"use client";

import { useState } from "react";
import type { FdtlSchemeRef } from "@skyhub/api";
import { Save, Clock, BedDouble, Moon, Shield, Radio } from "lucide-react";
import { ACCENT } from "./fdt-rules-shell";

interface Props {
  scheme: FdtlSchemeRef;
  onUpdate: (data: Partial<FdtlSchemeRef>) => Promise<void>;
}

export function FdtSchemeSettings({ scheme, onUpdate }: Props) {
  const [draft, setDraft] = useState<Partial<FdtlSchemeRef>>({});
  const [saving, setSaving] = useState(false);

  const val = <K extends keyof FdtlSchemeRef>(key: K): FdtlSchemeRef[K] =>
    key in draft ? (draft as any)[key] : scheme[key];

  const set = (key: string, value: unknown) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const hasChanges = Object.keys(draft).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await onUpdate(draft);
      setDraft({});
    } catch (err) {
      // error handled by parent shell
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Reporting Defaults */}
      <SettingsSection icon={Clock} title="Reporting & Debrief Defaults">
        <SettingsRow label="Report time before STD" unit="min">
          <NumberInput value={val("reportTimeMinutes")} onChange={v => set("reportTimeMinutes", v)} />
        </SettingsRow>
        <SettingsRow label="Post-flight time after STA" unit="min">
          <NumberInput value={val("postFlightMinutes")} onChange={v => set("postFlightMinutes", v)} />
        </SettingsRow>
        <SettingsRow label="Debrief time" unit="min">
          <NumberInput value={val("debriefMinutes")} onChange={v => set("debriefMinutes", v)} />
        </SettingsRow>
        <SettingsRow label="Standby response time" unit="min">
          <NumberInput value={val("standbyResponseMinutes")} onChange={v => set("standbyResponseMinutes", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* WOCL */}
      <SettingsSection icon={Moon} title="Window of Circadian Low (WOCL)">
        <SettingsRow label="WOCL start">
          <TimeInput value={val("woclStart")} onChange={v => set("woclStart", v)} />
        </SettingsRow>
        <SettingsRow label="WOCL end">
          <TimeInput value={val("woclEnd")} onChange={v => set("woclEnd", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* Crew Complements */}
      <SettingsSection icon={BedDouble} title="Augmented Crew Mapping">
        <SettingsRow label="3-pilot complement key">
          <TextInput value={val("augmentedComplementKey")} onChange={v => set("augmentedComplementKey", v)} placeholder="aug1" />
        </SettingsRow>
        <SettingsRow label="4-pilot complement key">
          <TextInput value={val("doubleCrewComplementKey")} onChange={v => set("doubleCrewComplementKey", v)} placeholder="aug2" />
        </SettingsRow>
      </SettingsSection>

      {/* FRMS */}
      <SettingsSection icon={Shield} title="Fatigue Risk Management">
        <SettingsRow label="FRMS enabled">
          <ToggleInput value={val("frmsEnabled")} onChange={v => set("frmsEnabled", v)} />
        </SettingsRow>
        <SettingsRow label="FRMS approval reference">
          <TextInput
            value={val("frmsApprovalReference") ?? ""}
            onChange={v => set("frmsApprovalReference", v || null)}
            placeholder="e.g. CAAV/FRMS/2024-001"
          />
        </SettingsRow>
      </SettingsSection>

      {/* Cabin Crew */}
      <SettingsSection icon={Radio} title="Cabin Crew Rules">
        <SettingsRow label="Separate cabin crew rules">
          <ToggleInput value={val("cabinCrewSeparateRules")} onChange={v => set("cabinCrewSeparateRules", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* Save */}
      {hasChanges && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ─── */

function SettingsSection({ icon: Icon, title, children }: { icon: React.ComponentType<any>; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 rounded-full shrink-0" style={{ backgroundColor: ACCENT }} />
        <Icon size={14} style={{ color: ACCENT }} />
        <span className="text-[13px] font-semibold">{title}</span>
      </div>
      <div className="space-y-2 pl-5">{children}</div>
    </div>
  );
}

function SettingsRow({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-[13px] text-hz-text flex-1">{label}</span>
      <div className="flex items-center gap-1.5">
        {children}
        {unit && <span className="text-[13px] text-hz-text-tertiary w-6">{unit}</span>}
      </div>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      className="w-16 h-7 text-center text-[13px] font-mono font-medium rounded-lg border border-hz-border bg-hz-bg text-hz-text outline-none focus:border-hz-accent focus:ring-2 focus:ring-module-accent/30"
    />
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="HH:MM"
      className="w-16 h-7 text-center text-[13px] font-mono font-medium rounded-lg border border-hz-border bg-hz-bg text-hz-text outline-none focus:border-hz-accent focus:ring-2 focus:ring-module-accent/30"
    />
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-40 h-7 px-2 text-[13px] font-mono rounded-lg border border-hz-border bg-hz-bg text-hz-text outline-none focus:border-hz-accent focus:ring-2 focus:ring-module-accent/30"
    />
  );
}

function ToggleInput({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`h-7 px-3 text-[13px] font-semibold rounded-lg transition-colors ${
        value
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-red-500/10 text-red-500 dark:text-red-400"
      }`}
    >
      {value ? "Yes" : "No"}
    </button>
  );
}
