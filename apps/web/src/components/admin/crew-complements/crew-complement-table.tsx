"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import type {
  AircraftTypeRef,
  CrewComplementRef,
  CrewPositionRef,
} from "@skyhub/api";
import {
  COMPLEMENT_TEMPLATES,
  POSITION_DEFAULT_COLORS,
} from "@skyhub/logic";
import {
  BedDouble,
  AlertTriangle,
  ChevronRight,
  Gauge,
  Star,
  Plus,
  Trash2,
  Sparkles,
  Info,
} from "lucide-react";
import { ACCENT } from "./crew-complements-shell";

// ── Helpers ──

function posVal(counts: Record<string, number>, code: string): number {
  return counts[code.toUpperCase()] ?? 0;
}

function totalCrew(
  counts: Record<string, number>,
  positions: CrewPositionRef[]
): number {
  return positions.reduce((sum, p) => sum + posVal(counts, p.code), 0);
}

function posColor(p: CrewPositionRef): string {
  return p.color || POSITION_DEFAULT_COLORS[p.code] || "#888888";
}

function getTemplateDisplay(key: string) {
  const known = COMPLEMENT_TEMPLATES.find((t) => t.key === key);
  if (known) return known;
  return {
    key,
    badge: key.toUpperCase().replace(/[_-]/g, " "),
    badgeColor: "#6B7280",
    label: key
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    description: "Custom crew complement",
  };
}

const PROTECTED_KEYS = new Set(["standard", "aug1", "aug2"]);

// ── Props ──

interface Props {
  aircraftType: AircraftTypeRef;
  complements: CrewComplementRef[];
  cockpitPositions: CrewPositionRef[];
  cabinPositions: CrewPositionRef[];
  onCountChange: (id: string, counts: Record<string, number>) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onLabelChange: (id: string, templateKey: string) => void;
  onSeedForType: (icaoType: string) => void;
  onAddRow: (icaoType: string, templateKey: string) => void;
  onDeleteRow: (id: string) => void;
}

export function CrewComplementTable({
  aircraftType,
  complements,
  cockpitPositions,
  cabinPositions,
  onCountChange,
  onNotesChange,
  onLabelChange,
  onSeedForType,
  onAddRow,
  onDeleteRow,
}: Props) {
  const allPositions = [...cockpitPositions, ...cabinPositions];
  const hasRest =
    aircraftType.crewRest?.cockpitClass != null ||
    aircraftType.crewRest?.cabinClass != null;

  const stdRow = complements.find((c) => c.templateKey === "standard");

  // ── Seed empty state ──
  if (complements.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <TypeHeader aircraftType={aircraftType} count={0} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-center">
            <h3 className="text-[15px] font-semibold text-hz-text mb-1">
              No complements for {aircraftType.icaoType}
            </h3>
            <p className="text-[13px] text-hz-text-secondary max-w-sm">
              Seed Standard, Augmented 1, and Augmented 2 defaults based on your{" "}
              <a
                href="/admin/crew-positions"
                className="font-semibold underline"
                style={{ color: ACCENT }}
              >
                crew positions
              </a>
              .
            </p>
          </div>
          <button
            onClick={() => onSeedForType(aircraftType.icaoType)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            <Sparkles className="h-4 w-4" />
            Seed Defaults for {aircraftType.icaoType}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TypeHeader aircraftType={aircraftType} count={complements.length} />
      <RestFacilityBar aircraftType={aircraftType} hasRest={hasRest} />

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pt-3 pb-6">
        <table
          className="w-full"
          style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0 }}
        >
          <thead>
            {/* Group labels row */}
            <tr>
              <th
                className="w-[240px] text-left pr-4"
                rowSpan={2}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
                  Complement
                </span>
              </th>

              {/* Flight Deck group label */}
              {cockpitPositions.length > 0 && (
                <th
                  colSpan={cockpitPositions.length}
                  className="pt-1 pb-1 text-center border-t border-l border-r border-blue-200/60 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/5"
                  style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
                >
                  <div className="flex items-center justify-center py-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Flight Deck
                    </span>
                  </div>
                </th>
              )}

              {/* Spacer between groups */}
              {cockpitPositions.length > 0 && cabinPositions.length > 0 && (
                <th className="w-3" rowSpan={2} />
              )}

              {/* Cabin group label */}
              {cabinPositions.length > 0 && (
                <th
                  colSpan={cabinPositions.length}
                  className="pt-1 pb-1 text-center border-t border-l border-r border-amber-200/60 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/5"
                  style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
                >
                  <div className="flex items-center justify-center py-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Cabin Crew
                    </span>
                  </div>
                </th>
              )}

              <th className="w-4" rowSpan={2} />
              <th className="w-[60px] text-center align-bottom">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
                  Total
                </span>
              </th>
              <th className="w-8" rowSpan={2} />
              <th className="text-left align-bottom" rowSpan={2}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
                  Diff vs Standard
                </span>
              </th>
              <th className="w-8" rowSpan={2} />
            </tr>

            {/* Position badges row */}
            <tr>
              {allPositions.map((pos, i) => {
                const isCockpit = i < cockpitPositions.length;
                const isFirst = isCockpit ? i === 0 : i === cockpitPositions.length;
                const isLast = isCockpit ? i === cockpitPositions.length - 1 : i === allPositions.length - 1;
                return (
                  <th
                    key={pos.code}
                    className={`text-center pt-2 pb-3 px-0 ${
                      isCockpit
                        ? 'border-blue-200/60 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/5'
                        : 'border-amber-200/60 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/5'
                    } border-b ${isFirst ? 'border-l' : ''} ${isLast ? 'border-r' : ''}`}
                    style={{
                      width: 70,
                      ...(isLast ? { borderBottomLeftRadius: isFirst ? 12 : 0, borderBottomRightRadius: 12 } : {}),
                      ...(isFirst ? { borderBottomLeftRadius: 12, borderBottomRightRadius: isLast ? 12 : 0 } : {}),
                    }}
                  >
                    <div className="flex justify-center">
                      <span
                        className="inline-flex items-center justify-center h-8 px-2 min-w-[42px] rounded-lg text-[12px] font-bold font-mono text-white dark:[filter:saturate(0.60)]"
                        style={{ backgroundColor: posColor(pos) }}
                        title={pos.name}
                      >
                        {pos.code}
                      </span>
                    </div>
                  </th>
                );
              })}
              {/* Empty cell under TOTAL (not rowSpan'd anymore) */}
              <th />
            </tr>
          </thead>

          <tbody>
            {complements.map((comp, idx) => (
              <ComplementRow
                key={comp._id}
                comp={comp}
                stdRow={stdRow}
                allPositions={allPositions}
                cockpitPositions={cockpitPositions}
                cabinPositions={cabinPositions}
                onCountChange={onCountChange}
                onLabelChange={onLabelChange}
                onDeleteRow={onDeleteRow}
                isFirst={idx === 0}
              />
            ))}
          </tbody>
        </table>

        {/* Add custom row */}
        <div className="mt-4 flex items-center gap-3">
          <AddRowButton
            icaoType={aircraftType.icaoType}
            existingKeys={complements.map((c) => c.templateKey)}
            onAdd={onAddRow}
          />
          <div className="flex-1 h-px bg-hz-border/30" />
          <span className="text-[11px] text-hz-text-tertiary">
            Position columns from{" "}
            <a
              href="/admin/crew-positions"
              className="underline"
              style={{ color: ACCENT }}
            >
              5.4.2 Crew Positions
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Type Header ──

function TypeHeader({
  aircraftType,
  count,
}: {
  aircraftType: AircraftTypeRef;
  count: number;
}) {
  return (
    <div className="shrink-0 px-6 py-4 border-b border-hz-border">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${ACCENT}15` }}
        >
          <span
            className="text-[13px] font-bold font-mono"
            style={{ color: ACCENT }}
          >
            {aircraftType.icaoType}
          </span>
        </div>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold text-hz-text">
            {aircraftType.name}
          </h2>
          <p className="text-[12px] text-hz-text-tertiary">
            {count} complement template{count !== 1 ? "s" : ""} ·{" "}
            {aircraftType.family ?? aircraftType.category}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Rest Facility Bar ──

function RestFacilityBar({
  aircraftType,
  hasRest,
}: {
  aircraftType: AircraftTypeRef;
  hasRest: boolean;
}) {
  const rest = aircraftType.crewRest;
  const acTypeUrl = `/admin/aircraft-registrations?type=${aircraftType.icaoType}`;

  if (hasRest) {
    const parts: string[] = [];
    if (rest?.cockpitClass) {
      parts.push(
        `Cockpit: ${rest.cockpitClass}` +
          (rest.cockpitPositions ? ` · ${rest.cockpitPositions} pos` : "")
      );
    }
    if (rest?.cabinClass) {
      parts.push(
        `Cabin: ${rest.cabinClass}` +
          (rest.cabinPositions ? ` · ${rest.cabinPositions} pos` : "")
      );
    }
    return (
      <div className="shrink-0 flex items-center gap-3 px-6 py-2.5 bg-violet-500/10 border-b border-violet-200/30 dark:border-violet-400/20">
        <BedDouble className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
        <span className="text-[12px] text-violet-700 dark:text-violet-300 flex-1">
          {parts.join(" · ")} — Rest facility present. Augmented templates
          applicable.
        </span>
        <a
          href={acTypeUrl}
          className="shrink-0 flex items-center gap-1 text-[12px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          Aircraft Database <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex items-center gap-3 px-6 py-2.5 bg-amber-500/10 border-b border-amber-200/30 dark:border-amber-400/20">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-[12px] text-amber-700 dark:text-amber-300 flex-1">
        No crew rest facility configured — Aug 1 and Aug 2 may not apply.
      </span>
      <a
        href={acTypeUrl}
        className="shrink-0 flex items-center gap-1 text-[12px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
      >
        Aircraft Database <ChevronRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// ── Complement Row ──

function ComplementRow({
  comp,
  stdRow,
  allPositions,
  cockpitPositions,
  cabinPositions,
  onCountChange,
  onLabelChange,
  onDeleteRow,
  isFirst,
}: {
  comp: CrewComplementRef;
  stdRow: CrewComplementRef | undefined;
  allPositions: CrewPositionRef[];
  cockpitPositions: CrewPositionRef[];
  cabinPositions: CrewPositionRef[];
  onCountChange: (id: string, counts: Record<string, number>) => void;
  onLabelChange: (id: string, templateKey: string) => void;
  onDeleteRow: (id: string) => void;
  isFirst: boolean;
}) {
  const display = getTemplateDisplay(comp.templateKey);
  const isStandard = comp.templateKey === "standard";
  const total = totalCrew(comp.counts, allPositions);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localCounts, setLocalCounts] = useState(comp.counts);

  // Sync external changes
  useEffect(() => {
    setLocalCounts(comp.counts);
  }, [comp.counts]);

  // Label editing
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(comp.templateKey);
  const isProtected = PROTECTED_KEYS.has(comp.templateKey);

  const commitLabel = () => {
    if (labelValue.trim() && labelValue.trim() !== comp.templateKey) {
      onLabelChange(comp._id, labelValue.trim());
    }
    setEditingLabel(false);
  };

  // Diff chips vs standard
  const diffs =
    !isStandard && stdRow
      ? allPositions
          .map((p) => {
            const d = posVal(comp.counts, p.code) - posVal(stdRow.counts, p.code);
            return d !== 0 ? { code: p.code, diff: d, color: posColor(p) } : null;
          })
          .filter(Boolean) as { code: string; diff: number; color: string }[]
      : [];

  const handleCellChange = (posCode: string, value: number) => {
    const newCounts = { ...localCounts, [posCode]: value };
    setLocalCounts(newCounts);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onCountChange(comp._id, newCounts);
    }, 500);
  };

  return (
    <tr
      className={`border-t border-hz-border/30 group ${
        !isFirst ? "bg-hz-border/[0.03]" : ""
      }`}
    >
      {/* Template label + badge */}
      <td className="py-4 pr-4 align-middle">
        <div className="flex items-center gap-2.5">
          {editingLabel && !isProtected ? (
            <input
              autoFocus
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitLabel();
                }
                if (e.key === "Escape") setEditingLabel(false);
              }}
              className="text-[11px] font-bold min-w-[80px] w-[110px] text-center px-2 py-1 rounded-full border outline-none focus:ring-2 focus:ring-[#7c3aed]/30 dark:[filter:saturate(0.60)]"
              style={{
                borderColor: display.badgeColor,
                color: display.badgeColor,
              }}
            />
          ) : (
            <button
              onClick={() => {
                if (!isProtected) {
                  setLabelValue(comp.templateKey);
                  setEditingLabel(true);
                }
              }}
              className="shrink-0 text-[11px] font-bold w-[90px] text-center py-1 rounded-full text-white dark:[filter:saturate(0.60)]"
              style={{ backgroundColor: display.badgeColor }}
              title={
                isProtected
                  ? display.description
                  : "Click to rename"
              }
            >
              {display.badge}
            </button>
          )}
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-hz-text">
              {display.label}
            </div>
          </div>
        </div>
      </td>

      {/* Position count cells */}
      {allPositions.map((pos, i) => (
        <React.Fragment key={pos.code}>
          {i === cockpitPositions.length && cabinPositions.length > 0 && <td />}
          <td className="text-center py-4 px-0 align-middle">
            <CountCell
              value={posVal(localCounts, pos.code)}
              onChange={(v) => handleCellChange(pos.code, v)}
            />
          </td>
        </React.Fragment>
      ))}

      {/* Spacer */}
      <td />

      {/* Total */}
      <td className="text-center py-4 align-middle">
        <span
          className="text-[15px] font-bold tabular-nums"
          style={{ color: ACCENT }}
        >
          {totalCrew(localCounts, allPositions)}
        </span>
      </td>

      {/* Spacer */}
      <td />

      {/* Diff vs standard */}
      <td className="py-4 align-middle">
        {diffs.length > 0 ? (
          <div className="flex flex-nowrap gap-1">
            {diffs.map((d) => (
              <span
                key={d.code}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold font-mono whitespace-nowrap"
                style={{
                  backgroundColor: d.diff > 0 ? `${d.color}18` : 'rgba(239,68,68,0.1)',
                  color: d.diff > 0 ? d.color : '#ef4444',
                  border: `1px solid ${d.diff > 0 ? `${d.color}30` : 'rgba(239,68,68,0.2)'}`,
                }}
              >
                {d.diff > 0 ? '+' : ''}{d.diff} {d.code}
              </span>
            ))}
          </div>
        ) : isStandard ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-hz-text-tertiary bg-hz-border/20">
            baseline
          </span>
        ) : (
          <span className="text-[11px] text-hz-text-tertiary">—</span>
        )}
      </td>

      {/* Delete */}
      <td className="py-4 text-center align-middle">
        {!isProtected && (
          <button
            onClick={() => onDeleteRow(comp._id)}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/10"
            title="Delete custom template"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Count Cell ──

function CountCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const commit = () => {
    const num = Math.max(0, parseInt(localVal) || 0);
    setLocalVal(String(num));
    onChange(num);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type="text"
        inputMode="numeric"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setLocalVal(String(value));
            setEditing(false);
          }
          if (e.key === "Tab") commit();
        }}
        className="w-10 h-8 text-center text-[14px] font-bold tabular-nums rounded-lg border-2 border-[#7c3aed]/40 outline-none focus:ring-2 focus:ring-[#7c3aed]/30 bg-hz-bg text-hz-text"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`w-10 h-8 rounded-lg text-[14px] font-bold tabular-nums transition-all duration-150 hover:bg-hz-border/40 ${
        value > 0
          ? "text-hz-text"
          : "text-hz-text-tertiary/50"
      }`}
    >
      {value}
    </button>
  );
}

// ── Add Row Button ──

function AddRowButton({
  icaoType,
  existingKeys,
  onAdd,
}: {
  icaoType: string;
  existingKeys: string[];
  onAdd: (icaoType: string, templateKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customKey, setCustomKey] = useState("");

  const handleAdd = () => {
    const key = customKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) return;
    if (existingKeys.includes(key)) {
      alert(`Template "${key}" already exists for this type.`);
      return;
    }
    onAdd(icaoType, key);
    setCustomKey("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-hz-border text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add Custom Template
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        type="text"
        placeholder="e.g. aug3, extended"
        value={customKey}
        onChange={(e) => setCustomKey(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") {
            setCustomKey("");
            setOpen(false);
          }
        }}
        className="w-40 px-3 py-1.5 rounded-lg text-[12px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-[#7c3aed]/30 text-hz-text"
      />
      <button
        onClick={handleAdd}
        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
        style={{ backgroundColor: ACCENT }}
      >
        Add
      </button>
      <button
        onClick={() => {
          setCustomKey("");
          setOpen(false);
        }}
        className="px-2 py-1.5 rounded-lg text-[12px] text-hz-text-secondary hover:bg-hz-border/30"
      >
        Cancel
      </button>
    </div>
  );
}
