"use client";

import type { CountryRef } from "@skyhub/api";
import { Search } from "lucide-react";
import { CountryFlag } from "@/components/ui/country-flag";

interface CountryListProps {
  countries: CountryRef[];
  totalCount: number;
  filteredCount: number;
  selected: CountryRef | null;
  onSelect: (country: CountryRef) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
}

export function CountryList({
  countries,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
}: CountryListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Countries</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder="Search name, ISO code, region…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading…</div>
        ) : countries.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No countries found</div>
        ) : (
          <div className="space-y-0.5">
            {countries.map((country) => {
              const isSelected = selected?._id === country._id;
              return (
                <button
                  key={country._id}
                  onClick={() => onSelect(country)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? "border-l-[3px] border-l-module-accent bg-module-accent/[0.08]"
                      : "border-l-[3px] border-l-transparent hover:bg-hz-border/30"
                  }`}
                >
                  <span className="shrink-0 w-6 flex items-center justify-center">
                    {country.isoCode2 ? (
                      <CountryFlag iso2={country.isoCode2} size={20} />
                    ) : (
                      <span className="text-[11px] text-hz-text-secondary">—</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{country.name}</div>
                    <div className="text-[12px] text-hz-text-secondary truncate">
                      {country.isoCode2} · {country.isoCode3}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
