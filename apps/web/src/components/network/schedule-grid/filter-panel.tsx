"use client";

import { useState } from "react";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

interface FilterPanelProps {
  seasonCode: string;
  onSeasonChange: (code: string) => void;
  onApplyFilters: (filters: FilterParams) => void;
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

export function FilterPanel({ seasonCode, onSeasonChange, onApplyFilters }: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [depStation, setDepStation] = useState("");
  const [arrStation, setArrStation] = useState("");
  const [aircraftType, setAircraftType] = useState("");
  const [status, setStatus] = useState("");

  const inputClass = "w-full px-2 py-1.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-1 focus:ring-module-accent/30 focus:border-module-accent text-hz-text transition-colors";

  const handleGo = () => {
    onApplyFilters({ seasonCode, dateFrom, dateTo, depStation, arrStation, aircraftType, status });
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4">
        <button onClick={() => setCollapsed(false)} className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors" title="Expand filters">
          <ChevronRight size={14} className="text-hz-text-secondary" />
        </button>
        <div className="mt-2 -rotate-90 whitespace-nowrap text-[11px] font-medium text-hz-text-tertiary uppercase tracking-wider">
          Filters
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 border-r border-hz-border bg-hz-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-hz-border">
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-module-accent" />
          <span className="text-[13px] font-semibold">Filters</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1 rounded hover:bg-hz-border/30 transition-colors">
          <ChevronLeft size={13} className="text-hz-text-tertiary" />
        </button>
      </div>

      {/* Filter fields */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Season */}
        <div>
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1 block">Season</label>
          <select value={seasonCode} onChange={(e) => onSeasonChange(e.target.value)} className={inputClass}>
            <option value="S25">S25</option>
            <option value="W25">W25</option>
            <option value="S26">S26</option>
            <option value="W26">W26</option>
          </select>
        </div>

        {/* Date range */}
        <div>
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1 block">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1 block">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>

        {/* Departure */}
        <div>
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1 block">Departure</label>
          <input type="text" value={depStation} onChange={(e) => setDepStation(e.target.value.toUpperCase())} placeholder="ICAO/IATA" maxLength={4} className={inputClass} />
        </div>

        {/* Arrival */}
        <div>
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1 block">Arrival</label>
          <input type="text" value={arrStation} onChange={(e) => setArrStation(e.target.value.toUpperCase())} placeholder="ICAO/IATA" maxLength={4} className={inputClass} />
        </div>

        {/* Aircraft Type */}
        <div>
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1 block">AC Type</label>
          <input type="text" value={aircraftType} onChange={(e) => setAircraftType(e.target.value.toUpperCase())} placeholder="e.g. A321" maxLength={4} className={inputClass} />
        </div>

        {/* Status */}
        <div>
          <label className="text-[11px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1 block">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Go button */}
      <div className="px-3 py-3 border-t border-hz-border">
        <button
          onClick={handleGo}
          className="w-full py-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-colors"
        >
          <Search size={13} className="inline mr-1.5 -mt-0.5" />
          Go
        </button>
      </div>
    </div>
  );
}
