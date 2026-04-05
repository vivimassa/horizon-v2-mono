"use client";

import { useMemo } from "react";
import { EXPIRY_FORMULAS, type FormulaField } from "@skyhub/logic";
import { accentTint } from "@skyhub/ui/theme";
import { Beaker } from "lucide-react";
import { ACCENT } from "./expiry-codes-shell";

/* ─── Formula Section (edit mode) ─── */

export function FormulaSection({ formula, formulaParams, acTypeScope, onFormulaChange, onParamsChange, onAcTypeScopeChange, isDark }: {
  formula: string;
  formulaParams: Record<string, any>;
  acTypeScope: string;
  onFormulaChange: (f: string) => void;
  onParamsChange: (p: Record<string, any>) => void;
  onAcTypeScopeChange: (s: "none" | "family" | "variant") => void;
  isDark: boolean;
}) {
  const formulaDef = EXPIRY_FORMULAS.find(f => f.id === formula);

  const setParam = (key: string, value: any) => {
    onParamsChange({ ...formulaParams, [key]: value });
  };

  return (
    <div className="rounded-2xl p-5"
      style={{ background: isDark ? accentTint(ACCENT, 0.06) : accentTint(ACCENT, 0.04), border: `1px solid ${accentTint(ACCENT, isDark ? 0.15 : 0.15)}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Beaker size={14} color={isDark ? "#e0e0e0" : ACCENT} strokeWidth={1.8} />
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: isDark ? "#e0e0e0" : ACCENT }}>Formula Configuration</span>
      </div>

      <div className="mb-4">
        <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Formula Type</label>
        <select value={formula} onChange={(e) => onFormulaChange(e.target.value)}
          className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
          {EXPIRY_FORMULAS.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        {formulaDef && (
          <p className="text-[11px] text-hz-text-secondary mt-1">{formulaDef.description}</p>
        )}
      </div>

      {formulaDef && formulaDef.fields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {formulaDef.fields.map(field => (
            <FormulaFieldInput key={field.key} field={field}
              value={formulaParams[field.key] ?? ""}
              onChange={(v) => setParam(field.key, v)} />
          ))}
        </div>
      )}

      {formulaDef?.supportsAcType && (
        <div className="mt-3 py-2.5 border-t border-hz-border/30">
          <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">Aircraft Type Scope</label>
          <select value={acTypeScope} onChange={(e) => onAcTypeScopeChange(e.target.value as any)}
            className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
            <option value="none">Not type-specific</option>
            <option value="family">By type family (e.g. A320 family)</option>
            <option value="variant">By exact variant (e.g. A321neo)</option>
          </select>
        </div>
      )}
    </div>
  );
}

function FormulaFieldInput({ field, value, onChange }: {
  field: FormulaField; value: any; onChange: (v: any) => void;
}) {
  if (field.type === "select" && field.options) {
    return (
      <div className="py-2.5 border-b border-hz-border/50">
        <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">{field.label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text">
          <option value="">Select...</option>
          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="py-2.5 border-b border-hz-border/50">
      <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1 block">
        {field.label}{field.unit ? ` (${field.unit})` : ""}
      </label>
      <input
        type={field.type === "number" ? "number" : "text"}
        value={value}
        placeholder={field.placeholder ?? ""}
        onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
        className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
      />
    </div>
  );
}
