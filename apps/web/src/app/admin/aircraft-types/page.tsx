"use client";

import { useEffect, useState, useCallback } from "react";
import { api, setApiBaseUrl, type AircraftTypeRef } from "@skyhub/api";
import { DataTable, type Column } from "@/components/admin/data-table";

setApiBaseUrl("http://localhost:3002");

const columns: Column<AircraftTypeRef>[] = [
  {
    key: "icaoType",
    label: "ICAO Type",
    render: (r) => <span className="font-bold">{r.icaoType}</span>,
    sortValue: (r) => r.icaoType,
  },
  {
    key: "name",
    label: "Name",
    render: (r) => <span className="font-medium">{r.name}</span>,
    sortValue: (r) => r.name,
  },
  {
    key: "family",
    label: "Family",
    render: (r) => <span className="text-hz-text-secondary">{r.family ?? "—"}</span>,
    sortValue: (r) => r.family ?? "",
  },
  {
    key: "category",
    label: "Category",
    render: (r) => (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 capitalize">
        {r.category.replace("_", " ")}
      </span>
    ),
    sortValue: (r) => r.category,
  },
  {
    key: "pax",
    label: "Pax Capacity",
    render: (r) => <span>{r.paxCapacity ?? "—"}</span>,
    sortValue: (r) => r.paxCapacity ?? 0,
  },
];

const filterFn = (r: AircraftTypeRef, q: string) =>
  r.icaoType.toLowerCase().includes(q) ||
  r.name.toLowerCase().includes(q) ||
  (r.family?.toLowerCase().includes(q) ?? false) ||
  r.category.toLowerCase().includes(q);

export default function AircraftTypesPage() {
  const [data, setData] = useState<AircraftTypeRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAircraftTypes().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const keyFn = useCallback((r: AircraftTypeRef) => r._id, []);

  return (
    <DataTable
      title="Aircraft Types"
      data={data}
      columns={columns}
      loading={loading}
      searchPlaceholder="Search type, name, family…"
      filterFn={filterFn}
      keyFn={keyFn}
    />
  );
}
