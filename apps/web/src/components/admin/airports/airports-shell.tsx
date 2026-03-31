"use client";

import { useEffect, useState, useMemo } from "react";
import { api, setApiBaseUrl, type AirportRef } from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { AirportList } from "./airport-list";
import { AirportDetail } from "./airport-detail";

setApiBaseUrl("http://localhost:3002");

export function AirportsShell() {
  const [airports, setAirports] = useState<AirportRef[]>([]);
  const [selected, setSelected] = useState<AirportRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAirports()
      .then((data) => {
        setAirports(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group airports by country
  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? airports.filter(
          (a) =>
            a.icaoCode.toLowerCase().includes(q) ||
            (a.iataCode?.toLowerCase().includes(q) ?? false) ||
            a.name.toLowerCase().includes(q) ||
            (a.city?.toLowerCase().includes(q) ?? false)
        )
      : airports;

    const map = new Map<string, AirportRef[]>();
    for (const a of filtered) {
      const key = a.country ?? "Unknown";
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }

    // Sort groups alphabetically, sort airports within each group by IATA
    const groups = Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [, arr] of groups) {
      arr.sort((a, b) => (a.iataCode ?? "").localeCompare(b.iataCode ?? ""));
    }

    return { filtered, groups };
  }, [airports, search]);

  return (
    <MasterDetailLayout
      left={
        <AirportList
          groups={groups}
          totalCount={airports.length}
          filteredCount={filtered.length}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
        />
      }
      center={
        selected ? (
          <AirportDetail airport={selected} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-hz-text-secondary text-sm">
            Select an airport
          </div>
        )
      }
    />
  );
}
