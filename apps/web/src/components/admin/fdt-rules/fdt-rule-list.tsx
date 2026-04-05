"use client";

import { useState, useRef, useEffect } from "react";
import type { FdtlRuleRef } from "@skyhub/api";
import { RotateCcw, AlertTriangle, Scale } from "lucide-react";
import { ACCENT } from "./fdt-rules-shell";

interface Props {
  rules: FdtlRuleRef[];
  showHeader?: boolean;
  onRuleChange: (id: string, value: string) => Promise<void>;
  onRuleReset: (id: string) => Promise<void>;
}

export function FdtRuleList({ rules, showHeader, onRuleChange, onRuleReset }: Props) {
  // Group by subcategory
  const groups = new Map<string, FdtlRuleRef[]>();
  for (const r of rules) {
    const key = r.subcategory;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-2 mb-3 mt-2">
          <Scale size={14} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold">Rule Parameters</span>
        </div>
      )}

      {[...groups.entries()].map(([sub, items]) => (
        <div key={sub} className="mb-4">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: ACCENT }} />
            <span className="text-[13px] font-bold uppercase tracking-wider text-hz-text-tertiary">
              {sub.replace(/_/g, " ")}
            </span>
          </div>
          <div className="space-y-1">
            {items.map(rule => (
              <RuleRow key={rule._id} rule={rule} onRuleChange={onRuleChange} onRuleReset={onRuleReset} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Rule Row ─── */

function RuleRow({
  rule,
  onRuleChange,
  onRuleReset,
}: {
  rule: FdtlRuleRef;
  onRuleChange: (id: string, value: string) => Promise<void>;
  onRuleReset: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rule.value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  const isModified = !rule.isTemplateDefault;

  // Check restrictiveness
  const isLessRestrictive = isModified && rule.templateValue && rule.directionality && checkRestrictiveness(rule);

  const commit = async () => {
    setEditing(false);
    if (draft.trim() !== rule.value) {
      await onRuleChange(rule._id, draft.trim());
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-hz-border/50 hover:border-hz-border transition-colors group">
      {/* Source badge */}
      <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
        rule.source === "government"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
          : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
      }`}>
        {rule.source === "government" ? "GOV" : "CO"}
      </span>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-hz-text">{rule.label}</span>
          {rule.crewType !== "all" && (
            <span className={`text-[13px] font-semibold px-1.5 py-0.5 rounded-full ${
              rule.crewType === "cockpit"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                : "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
            }`}>
              {rule.crewType === "cockpit" ? "FD" : "CC"}
            </span>
          )}
          {isLessRestrictive && (
            <AlertTriangle size={12} className="text-amber-500 shrink-0" />
          )}
        </div>
        {rule.legalReference && (
          <span className="text-[13px] text-hz-text-tertiary">{rule.legalReference}</span>
        )}
      </div>

      {/* Value — click to edit */}
      <div className="text-right shrink-0">
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(rule.value); setEditing(false); }
            }}
            className="w-20 h-7 text-center text-[13px] font-bold font-mono rounded-md border-2 outline-none bg-hz-bg text-hz-text"
            style={{ borderColor: ACCENT }}
          />
        ) : (
          <button
            onClick={() => { setDraft(rule.value); setEditing(true); }}
            className="text-[14px] font-bold font-mono tabular-nums hover:underline"
            style={isModified ? { color: ACCENT } : undefined}
            title="Click to edit"
          >
            {rule.value}
          </button>
        )}
        {rule.unit && !editing && (
          <span className="text-[13px] text-hz-text-tertiary ml-1">{rule.unit}</span>
        )}
      </div>

      {/* Reset button (only when modified) */}
      {isModified && !editing && (
        <button
          onClick={() => onRuleReset(rule._id)}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-lg hover:bg-amber-500/10 shrink-0"
          title={`Reset to ${rule.templateValue}`}
        >
          <RotateCcw size={12} className="text-amber-600" />
        </button>
      )}

      {/* Modified dot */}
      {isModified && !editing && (
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ACCENT }} />
      )}
    </div>
  );
}

/* ─── Restrictiveness Check ─── */

function checkRestrictiveness(rule: FdtlRuleRef): boolean {
  if (!rule.templateValue || !rule.directionality) return false;

  const current = parseFloat(rule.value.replace(":", ".")) || 0;
  const template = parseFloat(rule.templateValue.replace(":", ".")) || 0;

  if (rule.directionality === "MAX_LIMIT") {
    // Higher value = less restrictive (more hours allowed)
    return current > template;
  }
  if (rule.directionality === "MIN_LIMIT") {
    // Lower value = less restrictive (less rest required)
    return current < template;
  }
  return false;
}
