"use client";

import { useEffect, useState, useCallback } from "react";
import { api, setApiBaseUrl, type DelayCodeRef } from "@skyhub/api";
import { DataTable, type Column } from "@/components/admin/data-table";

setApiBaseUrl("http://localhost:3002");

const columns: Column<DelayCodeRef>[] = [
  {
    key: "code",
    label: "Code",
    render: (r) => <span className="font-bold font-mono">{r.code}</span>,
    sortValue: (r) => r.code,
  },
  {
    key: "name",
    label: "Description",
    render: (r) => <span className="font-medium">{r.name}</span>,
    sortValue: (r) => r.name,
  },
  {
    key: "category",
    label: "Category",
    render: (r) => (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
        {r.category}
      </span>
    ),
    sortValue: (r) => r.category,
  },
];

const filterFn = (r: DelayCodeRef, q: string) =>
  r.code.toLowerCase().includes(q) ||
  r.name.toLowerCase().includes(q) ||
  r.category.toLowerCase().includes(q);

export default function DelayCodesPage() {
  const [data, setData] = useState<DelayCodeRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDelayCodes().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const keyFn = useCallback((r: DelayCodeRef) => r._id, []);

  return (
    <DataTable
      title="Delay Codes"
      data={data}
      columns={columns}
      loading={loading}
      searchPlaceholder="Search code, description, category…"
      filterFn={filterFn}
      keyFn={keyFn}
    />
  );
}
