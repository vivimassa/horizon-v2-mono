"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Filter, Search, Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Dropdown } from "@/components/ui/dropdown";

interface FilterPanelProps {
  onApplyFilters: (filters: FilterParams) => void;
  loading?: boolean;
}

export interface FilterParams {
  dateFrom: string;
  dateTo: string;
  depStation: string;
  arrStation: string;
  aircraftType: string;
  status: string;
}
const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
];

export function FilterPanel({ onApplyFilters, loading }: FilterPanelProps) {
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

  const periodMissing = !dateFrom || !dateTo;

  const handleGo = useCallback(() => {
    if (periodMissing) return;
    onApplyFilters({ dateFrom, dateTo, depStation, arrStation, aircraftType, status });
    setCollapsed(true);
  }, [periodMissing, dateFrom, dateTo, depStation, arrStation, aircraftType, status, onApplyFilters]);

  const activeCount = [dateFrom, dateTo, depStation, arrStation, aircraftType, status].filter(Boolean).length;

  // ── Collapsed state ──
  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden relative"
      style={{
        width: collapsed ? 44 : 300,
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Collapsed view — click anywhere to expand */}
      <div
        className="absolute inset-0 flex flex-col items-center cursor-pointer hover:bg-hz-border/20 transition-colors"
        onClick={() => { if (collapsed) setCollapsed(false) }}
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      >
        <div className="h-12 w-full flex items-center justify-center">
          <ChevronRight size={16} className="text-hz-text-secondary" />
        </div>
        <div
          className="flex-1 flex items-center justify-center"
          style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
        >
          <span className="text-[12px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap">
            Filters
          </span>
        </div>
      </div>

      {/* Expanded view */}
      <div
        className="flex flex-col h-full min-w-[300px]"
        style={{
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? "none" : "auto",
          transition: "opacity 200ms ease",
        }}
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
            <DateRangePicker from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} inline />
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
            <Dropdown
              value={status || null}
              options={STATUSES}
              onChange={setStatus}
              placeholder="All Statuses"
            />
          </FilterSection>
        </div>

        {/* Go Button */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
          <button
            onClick={handleGo}
            disabled={loading || periodMissing}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? "Loading..." : "Go"}
          </button>
          {periodMissing && (
            <p className="text-[11px] text-hz-text-secondary mt-1.5 text-center">Select the period to continue</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary block">{label}</label>
      {children}
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
