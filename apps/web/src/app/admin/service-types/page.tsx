"use client";

import { useEffect, useState, useCallback } from "react";
import { api, setApiBaseUrl, type FlightServiceTypeRef } from "@skyhub/api";
import { DataTable, type Column } from "@/components/admin/data-table";

setApiBaseUrl("http://localhost:3001");

const columns: Column<FlightServiceTypeRef>[] = [
  {
    key: "code",
    label: "Code",
    render: (r) => <span className="font-bold">{r.code}</span>,
    sortValue: (r) => r.code,
  },
  {
    key: "name",
    label: "Name",
    render: (r) => <span className="font-medium">{r.name}</span>,
    sortValue: (r) => r.name,
  },
  {
    key: "description",
    label: "Description",
    render: (r) => <span className="text-hz-text-secondary">{r.description ?? "—"}</span>,
    sortValue: (r) => r.description ?? "",
  },
];

const filterFn = (r: FlightServiceTypeRef, q: string) =>
  r.code.toLowerCase().includes(q) ||
  r.name.toLowerCase().includes(q) ||
  (r.description?.toLowerCase().includes(q) ?? false);

export default function ServiceTypesPage() {
  const [data, setData] = useState<FlightServiceTypeRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFlightServiceTypes().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const keyFn = useCallback((r: FlightServiceTypeRef) => r._id, []);

  return (
    <DataTable
      title="Flight Service Types"
      data={data}
      columns={columns}
      loading={loading}
      searchPlaceholder="Search code, name, description…"
      filterFn={filterFn}
      keyFn={keyFn}
    />
  );
}
