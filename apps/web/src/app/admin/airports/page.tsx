"use client";

import { useEffect, useState, useCallback } from "react";
import { api, setApiBaseUrl, type AirportRef } from "@skyhub/api";
import { DataTable, type Column } from "@/components/admin/data-table";

setApiBaseUrl("http://localhost:3001");

const columns: Column<AirportRef>[] = [
  {
    key: "icao",
    label: "ICAO",
    render: (r) => <span className="font-mono text-hz-text-secondary">{r.icaoCode}</span>,
    sortValue: (r) => r.icaoCode,
  },
  {
    key: "iata",
    label: "IATA",
    render: (r) => <span className="font-bold text-hz-accent">{r.iataCode ?? "—"}</span>,
    sortValue: (r) => r.iataCode ?? "",
  },
  {
    key: "name",
    label: "Airport Name",
    render: (r) => <span className="font-medium">{r.name}</span>,
    sortValue: (r) => r.name,
  },
  {
    key: "city",
    label: "City",
    render: (r) => <span className="text-hz-text-secondary">{r.city ?? "—"}</span>,
    sortValue: (r) => r.city ?? "",
  },
  {
    key: "country",
    label: "Country",
    render: (r) => (
      <span>
        {r.countryFlag && <span className="mr-1.5">{r.countryFlag}</span>}
        {r.country ?? "—"}
      </span>
    ),
    sortValue: (r) => r.country ?? "",
  },
  {
    key: "timezone",
    label: "Timezone",
    render: (r) => <span className="text-hz-text-secondary text-xs">{r.timezone}</span>,
    sortValue: (r) => r.timezone,
  },
  {
    key: "crewBase",
    label: "Crew Base",
    render: (r) =>
      r.isCrewBase ? (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
          Yes
        </span>
      ) : (
        <span className="text-[11px] text-hz-text-secondary/50">No</span>
      ),
    sortValue: (r) => (r.isCrewBase ? 1 : 0),
  },
];

const filterFn = (r: AirportRef, q: string) =>
  r.icaoCode.toLowerCase().includes(q) ||
  (r.iataCode?.toLowerCase().includes(q) ?? false) ||
  r.name.toLowerCase().includes(q) ||
  (r.city?.toLowerCase().includes(q) ?? false) ||
  (r.country?.toLowerCase().includes(q) ?? false);

export default function AirportsPage() {
  const [data, setData] = useState<AirportRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAirports().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const keyFn = useCallback((r: AirportRef) => r._id, []);

  return (
    <DataTable
      title="Airports"
      data={data}
      columns={columns}
      loading={loading}
      searchPlaceholder="Search ICAO, IATA, name, city, country…"
      filterFn={filterFn}
      keyFn={keyFn}
    />
  );
}
