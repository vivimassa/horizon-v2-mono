"use client";

import { useEffect, useState, useCallback } from "react";
import { api, setApiBaseUrl, type CrewPositionRef } from "@skyhub/api";
import { DataTable, type Column } from "@/components/admin/data-table";

setApiBaseUrl("http://localhost:3002");

const columns: Column<CrewPositionRef>[] = [
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
    key: "category",
    label: "Category",
    render: (r) => (
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          r.category === "cockpit"
            ? "bg-blue-50 text-blue-700"
            : "bg-purple-50 text-purple-700"
        }`}
      >
        {r.category}
      </span>
    ),
    sortValue: (r) => r.category,
  },
  {
    key: "rankOrder",
    label: "Rank Order",
    render: (r) => <span className="text-hz-text-secondary">{r.rankOrder}</span>,
    sortValue: (r) => r.rankOrder,
  },
];

const filterFn = (r: CrewPositionRef, q: string) =>
  r.code.toLowerCase().includes(q) ||
  r.name.toLowerCase().includes(q) ||
  r.category.toLowerCase().includes(q);

export default function CrewPositionsPage() {
  const [data, setData] = useState<CrewPositionRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCrewPositions().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const keyFn = useCallback((r: CrewPositionRef) => r._id, []);

  return (
    <DataTable
      title="Crew Positions"
      data={data}
      columns={columns}
      loading={loading}
      searchPlaceholder="Search code, name, category…"
      filterFn={filterFn}
      keyFn={keyFn}
    />
  );
}
