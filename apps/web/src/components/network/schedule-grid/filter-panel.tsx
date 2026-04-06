"use client";

import { useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Filter, Search, Loader2, CalendarDays, Plane, MapPin } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface FilterPanelProps {
  seasonCode: string;
  onSeasonChange: (code: string) => void;
  onApplyFilters: (filters: FilterParams) => void;
  loading?: boolean;
}

export interface FilterParams {
  seasonCode: string;
  dateFrom: string;
  dateTo: string;
  depStation: string;
  arrStation: string;
  aircraftType: string;
  status: string;
}

const SEASONS = ["S25", "W25", "S26", "W26", "S27", "W27"];
const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
];

export function FilterPanel({ seasonCode, onSeasonChange, onApplyFilters, loading }: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [depStation, setDepStation] = useState("");
  const [arrStation, setArrStation] = useState("");
  const [aircraftType, setAircraftType] = useState("");
  const [status, setStatus] = useState("");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const glassBg = isDark ? "rgba(25,25,33,0.85)" : "rgba(255,255,255,0.85)";
  const glassBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const sectionBorder = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  const handleGo = useCallback(() => {
    onApplyFilters({ seasonCode, dateFrom, dateTo, depStation, arrStation, aircraftType, status });
    setCollapsed(true);
  }, [seasonCode, dateFrom, dateTo, depStation, arrStation, aircraftType, status, onApplyFilters]);

  const activeCount = [dateFrom, dateTo, depStation, arrStation, aircraftType, status].filter(Boolean).length;

  // ── Collapsed state ──
  if (collapsed) {
    return (
      <div
        className="shrink-0 flex flex-col items-center rounded-2xl overflow-hidden"
        style={{ width: 44, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: "blur(20px)" }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="h-12 w-full flex items-center justify-center hover:bg-hz-border/20 transition-colors"
        >
          <ChevronRight size={16} className="text-hz-text-secondary" />
        </button>
        <div
          className="flex-1 flex items-center justify-center"
          style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
        >
          <span className="text-[12px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap">
            Filters
          </span>
        </div>
      </div>
    );
  }

  // ── Expanded state ──
  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden"
      style={{ width: 300, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 shrink-0"
        style={{ minHeight: 48, borderBottom: `1px solid ${sectionBorder}` }}
      >
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-module-accent" />
          <span className="text-[15px] font-bold">Filters</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-module-accent text-white text-[11px] font-bold">{activeCount}</span>
          )}
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1 rounded-md hover:bg-hz-border/30 transition-colors">
          <ChevronLeft size={16} className="text-hz-text-tertiary" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

        {/* Date Range */}
        <FilterSection label="Period">
          <div className="grid grid-cols-2 gap-1.5">
            <DateInput label="From" value={dateFrom} onChange={setDateFrom} isDark={isDark} />
            <DateInput label="To" value={dateTo} onChange={setDateTo} isDark={isDark} />
          </div>
        </FilterSection>

        {/* Departure */}
        <FilterSection label="Departure">
          <StationInput value={depStation} onChange={setDepStation} placeholder="ICAO code" isDark={isDark} />
        </FilterSection>

        {/* Arrival */}
        <FilterSection label="Arrival">
          <StationInput value={arrStation} onChange={setArrStation} placeholder="ICAO code" isDark={isDark} />
        </FilterSection>

        {/* AC Type */}
        <FilterSection label="AC Type">
          <StationInput value={aircraftType} onChange={setAircraftType} placeholder="e.g. A321" isDark={isDark} />
        </FilterSection>

        {/* Status */}
        <FilterSection label="Status">
          <FilterSelect
            value={status}
            options={STATUSES}
            onChange={setStatus}
            isDark={isDark}
          />
        </FilterSection>
      </div>

      {/* Go Button */}
      <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
        <button
          onClick={handleGo}
          disabled={loading}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? "Loading..." : "Go"}
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[12px] font-semibold uppercase tracking-wider text-hz-text-tertiary block">{label}</label>
      {children}
    </div>
  );
}

function FilterSelect({ value, options, onChange, isDark }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  isDark: boolean;
}) {
  const bg = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)";
  const border = isDark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.20)";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-2 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text transition-colors"
      style={{ background: bg, border: `1px solid ${border}`, minHeight: 36 }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function DateInput({ label, value, onChange, isDark }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
}) {
  const bg = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)";
  const border = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const activeBorder = value ? "rgba(62,123,250,0.40)" : border;
  const activeBg = value ? (isDark ? "rgba(62,123,250,0.10)" : "rgba(62,123,250,0.05)") : bg;

  // Format YYYY-MM-DD → DD/MM/YYYY for display
  const displayValue = value
    ? value.split("-").reverse().join("/")
    : "";

  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    try { inputRef.current?.showPicker(); }
    catch { inputRef.current?.focus(); }
  };

  return (
    <div className="relative cursor-pointer" onClick={handleClick}>
      {/* Visible display */}
      <div
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] font-mono font-medium transition-all"
        style={{ background: activeBg, border: `1px solid ${activeBorder}`, minHeight: 32,
          color: value ? undefined : (isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"),
        }}
      >
        <CalendarDays size={12} className={value ? "text-module-accent" : "opacity-40"} />
        <span>{displayValue || label.toUpperCase()}</span>
      </div>
      {/* Hidden native date input */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        tabIndex={-1}
      />
    </div>
  );
}

function StationInput({ value, onChange, placeholder, isDark }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isDark: boolean;
}) {
  const bg = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)";
  const border = isDark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.20)";
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      placeholder={placeholder}
      maxLength={4}
      className="w-full px-2.5 py-2 rounded-xl text-[13px] font-mono outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text transition-colors placeholder:text-hz-text-tertiary"
      style={{ background: bg, border: `1px solid ${border}`, minHeight: 36 }}
    />
  );
}
